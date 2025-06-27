import crypto from 'crypto';
import { databaseStorage } from './storage';
import { emailService } from './email-service';
import { securityLogger } from './security-logger';
import type { 
  SecurityQuestion, 
  SecurityAnswers, 
  EmailChangeRequestInput,
  InsertEmailChangeRequest,
  EmailChangeRequest 
} from '@shared/schema';

// Predefined security questions for email recovery
export const SECURITY_QUESTIONS: SecurityQuestion[] = [
  {
    id: 'childhood_pet',
    question: 'What was the name of your first pet?',
    required: true
  },
  {
    id: 'childhood_street',
    question: 'What was the name of the street where you grew up?',
    required: true
  },
  {
    id: 'first_school',
    question: 'What was the name of your elementary school?',
    required: true
  },
  {
    id: 'mothers_maiden',
    question: "What is your mother's maiden name?",
    required: true
  },
  {
    id: 'first_car',
    question: 'What was the make and model of your first car?',
    required: false
  },
  {
    id: 'birth_city',
    question: 'In what city were you born?',
    required: false
  }
];

export class EmailRecoveryService {
  private readonly ENCRYPTION_KEY = process.env.EMAIL_RECOVERY_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  private readonly REQUEST_EXPIRY_HOURS = 72; // 72 hours to process email change requests
  private readonly MAX_PENDING_REQUESTS = 3; // Maximum pending requests per user

  /**
   * Encrypt security answers for storage
   */
  private encryptAnswers(answers: SecurityAnswers): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.ENCRYPTION_KEY);
    let encrypted = cipher.update(JSON.stringify(answers), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt security answers from storage
   */
  private decryptAnswers(encryptedAnswers: string): SecurityAnswers {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedAnswers, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt security answers:', error);
      return {};
    }
  }

  /**
   * Normalize answer for comparison (lowercase, trim, remove extra spaces)
   */
  private normalizeAnswer(answer: string): string {
    return answer.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Get security questions for display
   */
  getSecurityQuestions(): SecurityQuestion[] {
    return SECURITY_QUESTIONS;
  }

  /**
   * Check if user has too many pending email change requests
   */
  async checkPendingRequestsLimit(userId: string): Promise<boolean> {
    const pendingRequests = await databaseStorage.getUserPendingEmailChangeRequests(userId);
    return pendingRequests.length >= this.MAX_PENDING_REQUESTS;
  }

  /**
   * Create a new email change request
   */
  async createEmailChangeRequest(
    userId: string,
    requestData: EmailChangeRequestInput,
    clientInfo: {
      ip: string;
      userAgent: string;
      deviceFingerprint: string;
    }
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      // Check if user exists
      const user = await databaseStorage.getUser(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current email matches user's email
      if (user.email !== requestData.currentEmail) {
        securityLogger.logSuspiciousActivity(
          clientInfo.ip,
          clientInfo.userAgent,
          `Email change request with incorrect current email: ${requestData.currentEmail} vs ${user.email}`,
          { userId }
        );
        return { success: false, error: 'Current email does not match account email' };
      }

      // Check if new email is already in use
      const existingUser = await databaseStorage.getUserByEmail(requestData.newEmail);
      if (existingUser && existingUser.id !== userId) {
        return { success: false, error: 'New email address is already in use' };
      }

      // Check pending requests limit
      if (await this.checkPendingRequestsLimit(userId)) {
        return { success: false, error: 'Too many pending email change requests. Please wait for existing requests to be processed.' };
      }

      // Encrypt security answers if provided
      let encryptedAnswers: string | undefined;
      if (requestData.securityAnswers) {
        encryptedAnswers = this.encryptAnswers(requestData.securityAnswers);
      }

      // Create the request
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.REQUEST_EXPIRY_HOURS);

      const requestRecord: InsertEmailChangeRequest = {
        userId,
        currentEmail: requestData.currentEmail,
        newEmail: requestData.newEmail,
        reason: requestData.reason,
        clientIp: clientInfo.ip,
        deviceFingerprint: clientInfo.deviceFingerprint,
        userAgent: clientInfo.userAgent,
        securityAnswers: encryptedAnswers,
        status: 'pending',
        expiresAt,
        attempts: 0,
        maxAttempts: 3
      };

      const emailChangeRequest = await databaseStorage.createEmailChangeRequest(requestRecord);

      // Log the security event
      securityLogger.logEmailChangeRequest(
        clientInfo.ip,
        clientInfo.userAgent,
        userId,
        requestData.currentEmail,
        requestData.newEmail,
        requestData.reason
      );

      // Send notification emails to both addresses (if possible)
      await this.sendEmailChangeNotifications(emailChangeRequest, user.email);

      return { 
        success: true, 
        requestId: emailChangeRequest.id 
      };

    } catch (error) {
      console.error('Error creating email change request:', error);
      return { success: false, error: 'Failed to create email change request' };
    }
  }

  /**
   * Send notification emails about the email change request
   */
  private async sendEmailChangeNotifications(
    request: EmailChangeRequest,
    currentEmail: string
  ): Promise<void> {
    try {
      // Notify current email (security alert)
      await emailService.sendEmail({
        to: currentEmail,
        subject: 'Security Alert: Email Change Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d97706;">🔒 Email Change Request Submitted</h2>
            <p>A request to change your account email address has been submitted:</p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>From:</strong> ${request.currentEmail}<br>
              <strong>To:</strong> ${request.newEmail}<br>
              <strong>Request ID:</strong> ${request.id}<br>
              <strong>Status:</strong> Pending Admin Review
            </div>
            
            <p><strong>Reason provided:</strong></p>
            <blockquote style="border-left: 3px solid #d97706; padding-left: 15px; color: #666;">
              ${request.reason}
            </blockquote>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>⚠️ Important:</strong> If you did not request this email change, please contact support immediately at support@readmyfineprint.com
            </div>
            
            <p>This request will be reviewed by our security team within 72 hours. You will receive updates on the status of your request.</p>
            
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated security notification from ReadMyFinePrint.<br>
              Request submitted from IP: ${request.clientIp}
            </p>
          </div>
        `
      });

      // Try to notify new email (verification)
      try {
        await emailService.sendEmail({
          to: request.newEmail,
          subject: 'Email Change Request - Action Required',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">📧 Email Change Request</h2>
              <p>Someone has requested to change a ReadMyFinePrint account email address to this address (${request.newEmail}).</p>
              
              <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>Request ID:</strong> ${request.id}<br>
                <strong>Current Email:</strong> ${request.currentEmail}<br>
                <strong>New Email:</strong> ${request.newEmail}
              </div>
              
              <div style="background: #dbeafe; border: 1px solid #3b82f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>ℹ️ What happens next:</strong><br>
                This request is being reviewed by our security team. If approved, this email address will become the new login email for the account.
              </div>
              
              <div style="background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>🚨 If you did not request this:</strong><br>
                Please ignore this email and contact support@readmyfineprint.com if you have concerns.
              </div>
              
              <hr style="margin: 30px 0;">
              <p style="color: #666; font-size: 12px;">
                This is an automated notification from ReadMyFinePrint.
              </p>
            </div>
          `
        });
      } catch (newEmailError) {
        console.log('Could not send notification to new email address (expected if email is invalid)');
      }

    } catch (error) {
      console.error('Error sending email change notifications:', error);
      // Don't throw - this shouldn't fail the request creation
    }
  }

  /**
   * Verify security answers for an email change request
   */
  async verifySecurityAnswers(
    requestId: string,
    providedAnswers: SecurityAnswers
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await databaseStorage.getEmailChangeRequest(requestId);
      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, error: 'Request is no longer pending' };
      }

      if (new Date() > new Date(request.expiresAt)) {
        return { success: false, error: 'Request has expired' };
      }

      if (!request.securityAnswers) {
        return { success: false, error: 'No security answers on file for this request' };
      }

      // Decrypt stored answers
      const storedAnswers = this.decryptAnswers(request.securityAnswers);

      // Verify answers (normalize for comparison)
      let correctAnswers = 0;
      let totalAnswers = 0;

      for (const [questionId, storedAnswer] of Object.entries(storedAnswers)) {
        if (providedAnswers[questionId]) {
          totalAnswers++;
          const normalizedStored = this.normalizeAnswer(storedAnswer);
          const normalizedProvided = this.normalizeAnswer(providedAnswers[questionId]);
          
          if (normalizedStored === normalizedProvided) {
            correctAnswers++;
          }
        }
      }

      // Require at least 80% correct answers and minimum 2 correct
      const successThreshold = Math.max(2, Math.ceil(totalAnswers * 0.8));
      const success = correctAnswers >= successThreshold && totalAnswers >= 2;

      if (!success) {
        // Increment attempts
        await databaseStorage.incrementEmailChangeRequestAttempts(requestId);
        
        // Check if max attempts reached
        if (request.attempts + 1 >= request.maxAttempts) {
          await databaseStorage.updateEmailChangeRequestStatus(requestId, 'expired', 'Maximum verification attempts exceeded');
          return { success: false, error: 'Maximum verification attempts exceeded. Request has been expired.' };
        }
        
        return { success: false, error: 'Security answers verification failed' };
      }

      return { success: true };

    } catch (error) {
      console.error('Error verifying security answers:', error);
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Get pending email change requests for admin review
   */
  async getPendingEmailChangeRequests(limit: number = 50): Promise<EmailChangeRequest[]> {
    return await databaseStorage.getPendingEmailChangeRequests(limit);
  }

  /**
   * Admin approve or reject email change request
   */
  async reviewEmailChangeRequest(
    requestId: string,
    adminUserId: string,
    action: 'approve' | 'reject',
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await databaseStorage.getEmailChangeRequest(requestId);
      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, error: 'Request is not pending' };
      }

      if (new Date() > new Date(request.expiresAt)) {
        await databaseStorage.updateEmailChangeRequestStatus(requestId, 'expired', 'Request expired');
        return { success: false, error: 'Request has expired' };
      }

      // Update request status
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await databaseStorage.reviewEmailChangeRequest(requestId, adminUserId, newStatus, adminNotes);

      // If approved, update the user's email
      if (action === 'approve') {
        await databaseStorage.updateUser(request.userId, { email: request.newEmail });
        
        // Send confirmation emails
        await this.sendEmailChangeConfirmations(request, action);
        
        // Log the change
        securityLogger.logEmailChanged(request.clientIp, request.userAgent, request.userId, request.currentEmail, request.newEmail);
      } else {
        // Send rejection notification
        await this.sendEmailChangeConfirmations(request, action, adminNotes);
      }

      return { success: true };

    } catch (error) {
      console.error('Error reviewing email change request:', error);
      return { success: false, error: 'Failed to review request' };
    }
  }

  /**
   * Send confirmation emails after admin review
   */
  private async sendEmailChangeConfirmations(
    request: EmailChangeRequest,
    action: 'approve' | 'reject',
    adminNotes?: string
  ): Promise<void> {
    try {
      const isApproved = action === 'approve';
      const subject = isApproved 
        ? 'Email Change Approved - Action Complete'
        : 'Email Change Request Rejected';

      const currentEmailContent = isApproved ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">✅ Email Change Approved</h2>
          <p>Your email change request has been approved and processed.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Previous Email:</strong> ${request.currentEmail}<br>
            <strong>New Email:</strong> ${request.newEmail}<br>
            <strong>Request ID:</strong> ${request.id}
          </div>
          
          <div style="background: #dcfce7; border: 1px solid #16a34a; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Important:</strong> Your account email has been changed to ${request.newEmail}. Use this new email address for future logins.
          </div>
          
          <p>If you have any questions, please contact support@readmyfineprint.com</p>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">❌ Email Change Request Rejected</h2>
          <p>Your email change request has been reviewed and rejected.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Request ID:</strong> ${request.id}<br>
            <strong>Requested Change:</strong> ${request.currentEmail} → ${request.newEmail}
          </div>
          
          ${adminNotes ? `
            <div style="background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Reason:</strong> ${adminNotes}
            </div>
          ` : ''}
          
          <p>Your account email remains ${request.currentEmail}. If you have questions about this decision, please contact support@readmyfineprint.com</p>
        </div>
      `;

      // Send to current email
      await emailService.sendEmail({
        to: request.currentEmail,
        subject,
        html: currentEmailContent
      });

      // If approved, also send welcome email to new address
      if (isApproved) {
        await emailService.sendEmail({
          to: request.newEmail,
          subject: 'Welcome to your updated ReadMyFinePrint account',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">🎉 Email Change Complete</h2>
              <p>Your ReadMyFinePrint account email has been successfully updated to this address.</p>
              
              <div style="background: #dcfce7; border: 1px solid #16a34a; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>✅ Your account is now accessible with:</strong><br>
                Email: ${request.newEmail}<br>
                (Previous email: ${request.currentEmail})
              </div>
              
              <p>You can now log in using this email address. If you have any questions, please contact support@readmyfineprint.com</p>
            </div>
          `
        });
      }

    } catch (error) {
      console.error('Error sending email change confirmations:', error);
    }
  }

  /**
   * Clean up expired email change requests
   */
  async cleanupExpiredRequests(): Promise<number> {
    try {
      const expiredCount = await databaseStorage.markExpiredEmailChangeRequests();
      console.log(`🧹 Marked ${expiredCount} expired email change requests`);
      return expiredCount;
    } catch (error) {
      console.error('Error cleaning up expired email change requests:', error);
      return 0;
    }
  }

}

// Export singleton instance
export const emailRecoveryService = new EmailRecoveryService();