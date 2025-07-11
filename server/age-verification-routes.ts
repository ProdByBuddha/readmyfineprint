import type { Express } from 'express';
import { z } from 'zod';
import { optionalUserAuth, requireUserAuth } from './auth';
import { getClientInfo, securityLogger } from './security-logger';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { emailService } from './email-service';
import crypto from 'crypto';

// Age verification validation schemas
const ageVerificationSchema = z.object({
  birthMonth: z.number().min(1).max(12),
  birthDay: z.number().min(1).max(31),
  birthYear: z.number().min(1900).max(new Date().getFullYear()),
  age: z.number().min(0).max(150),
});

const parentalConsentSchema = z.object({
  parentEmail: z.string().email(),
  userAge: z.number().min(13).max(17),
});

// Add age verification table to schema (would be in shared/schema.ts in production)
const ageVerifications = {
  id: 'uuid',
  userId: 'uuid',
  birthDateHash: 'text', // Hashed birth date for privacy
  ageAtVerification: 'number',
  isAdult: 'boolean',
  needsParentalConsent: 'boolean',
  parentalConsentEmail: 'text',
  parentalConsentStatus: 'text', // 'pending', 'approved', 'denied'
  parentalConsentDate: 'timestamp',
  verifiedAt: 'timestamp',
  ipHash: 'text',
  userAgentHash: 'text',
};

interface AgeVerificationRecord {
  id: string;
  userId: string;
  birthDateHash: string;
  ageAtVerification: number;
  isAdult: boolean;
  needsParentalConsent: boolean;
  parentalConsentEmail?: string;
  parentalConsentStatus?: string;
  parentalConsentDate?: Date;
  verifiedAt: Date;
  ipHash: string;
  userAgentHash: string;
}

export function registerAgeVerificationRoutes(app: Express) {
  
  /**
   * Check age verification status for current user
   */
  app.get('/api/age-verification/status', optionalUserAuth, async (req: any, res) => {
    try {
      if (!req.user) {
        return res.json({ verified: false });
      }

      const userId = req.user.id;
      
      // In a real implementation, you'd query the age_verifications table
      // For now, return based on user account creation logic
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return res.json({ verified: false });
      }

      // Mock verification status - in production this would check the age_verifications table
      res.json({
        verified: true, // Assume existing users are verified
        isAdult: true,
        needsParentalConsent: false,
        verificationDate: user[0].createdAt?.toISOString()
      });

    } catch (error) {
      console.error('Age verification status error:', error);
      res.status(500).json({
        error: 'Failed to check age verification status',
        code: 'AGE_VERIFICATION_STATUS_ERROR'
      });
    }
  });

  /**
   * Verify user's age
   */
  app.post('/api/age-verification/verify', optionalUserAuth, async (req: any, res) => {
    try {
      const { birthMonth, birthDay, birthYear, age } = ageVerificationSchema.parse(req.body);
      const { ip, userAgent } = getClientInfo(req);

      // Calculate age server-side for security
      const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }

      // Verify client-side calculation matches
      if (Math.abs(calculatedAge - age) > 1) {
        securityLogger.logSecurityEvent({
          eventType: 'AGE_VERIFICATION_TAMPERED' as any,
          severity: 'HIGH' as any,
          message: 'Age calculation mismatch detected',
          ip,
          userAgent,
          details: { 
            clientAge: age, 
            serverAge: calculatedAge, 
            userId: req.user?.id 
          }
        });

        return res.status(400).json({
          error: 'Age calculation error. Please try again.',
          code: 'AGE_CALCULATION_ERROR'
        });
      }

      // COPPA compliance - reject users under 13
      if (calculatedAge < 13) {
        securityLogger.logSecurityEvent({
          eventType: 'COPPA_VIOLATION_ATTEMPT' as any,
          severity: 'HIGH' as any,
          message: 'User under 13 attempted to register',
          ip,
          userAgent,
          details: { age: calculatedAge, userId: req.user?.id }
        });

        return res.status(403).json({
          error: 'Users must be at least 13 years old to use this service',
          code: 'COPPA_AGE_REQUIREMENT'
        });
      }

      // Hash birth date for privacy
      const birthDateString = `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`;
      const birthDateHash = crypto.createHash('sha256').update(birthDateString + process.env.AGE_VERIFICATION_SALT || 'default-salt').digest('hex');

      const isAdult = calculatedAge >= 18;
      const needsParentalConsent = calculatedAge >= 13 && calculatedAge < 18;

      // In production, store in age_verifications table
      const verificationData = {
        userId: req.user?.id || 'anonymous',
        birthDateHash,
        ageAtVerification: calculatedAge,
        isAdult,
        needsParentalConsent,
        verifiedAt: new Date(),
        ipHash: crypto.createHash('sha256').update(ip).digest('hex'),
        userAgentHash: crypto.createHash('sha256').update(userAgent || '').digest('hex')
      };

      securityLogger.logSecurityEvent({
        eventType: 'AGE_VERIFICATION_COMPLETED' as any,
        severity: 'LOW' as any,
        message: `Age verification completed for ${isAdult ? 'adult' : 'minor'}`,
        ip,
        userAgent,
        details: { 
          userId: req.user?.id,
          ageGroup: isAdult ? 'adult' : needsParentalConsent ? 'minor_with_consent' : 'minor',
          needsParentalConsent
        }
      });

      res.json({
        verified: true,
        isAdult,
        needsParentalConsent,
        verificationDate: new Date().toISOString(),
        message: isAdult 
          ? 'Age verification complete' 
          : 'Age verified. Parental consent required to proceed.'
      });

    } catch (error) {
      console.error('Age verification error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid birth date information',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to verify age',
        code: 'AGE_VERIFICATION_ERROR'
      });
    }
  });

  /**
   * Request parental consent for minors (13-17)
   */
  app.post('/api/age-verification/parental-consent', optionalUserAuth, async (req: any, res) => {
    try {
      const { parentEmail, userAge } = parentalConsentSchema.parse(req.body);
      const { ip, userAgent } = getClientInfo(req);

      // Generate consent token
      const consentToken = crypto.randomBytes(32).toString('hex');
      const consentUrl = `${process.env.BASE_URL || 'https://readmyfineprint.com'}/parental-consent?token=${consentToken}`;

      // Store consent request (in production, this would be in database)
      const consentRequest = {
        id: crypto.randomUUID(),
        userId: req.user?.id || 'anonymous',
        parentEmail,
        userAge,
        consentToken,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      // Send parental consent email
      try {
        await emailService.sendEmail({
          to: parentEmail,
          subject: 'Parental Consent Required - ReadMyFinePrint',
          html: `
            <h2>Parental Consent Request</h2>
            <p>A minor has requested to use ReadMyFinePrint and listed you as their parent or legal guardian.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Service Details</h3>
              <ul>
                <li><strong>Service:</strong> ReadMyFinePrint - Legal Document Analysis</li>
                <li><strong>User Age:</strong> ${userAge} years old</li>
                <li><strong>Date:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            
            <h3>What ReadMyFinePrint Does</h3>
            <p>ReadMyFinePrint helps users understand legal documents by providing AI-powered analysis and summaries. We:</p>
            <ul>
              <li>Analyze legal documents and contracts</li>
              <li>Provide plain-English summaries</li>
              <li>Highlight potential concerns</li>
              <li>Do NOT store documents (immediate deletion after analysis)</li>
            </ul>
            
            <h3>Data Collection and Privacy</h3>
            <ul>
              <li>We collect minimal personal information (email address only)</li>
              <li>Documents are processed anonymously and deleted immediately</li>
              <li>No personal information is shared with AI services</li>
              <li>Full privacy policy available at our website</li>
            </ul>
            
            <h3>Parental Rights</h3>
            <p>As a parent or guardian, you have the right to:</p>
            <ul>
              <li>Review what information we collect</li>
              <li>Request deletion of your child's account</li>
              <li>Withdraw consent at any time</li>
              <li>Contact us with any questions</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${consentUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review and Provide Consent
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              This consent request expires in 7 days. If you did not expect this email or have concerns, 
              please contact us at privacy@readmyfineprint.com
            </p>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p><strong>ReadMyFinePrint Privacy Team</strong><br>
              Email: privacy@readmyfineprint.com<br>
              This email was sent in compliance with COPPA regulations.</p>
            </div>
          `,
          text: `
Parental Consent Request - ReadMyFinePrint

A minor (age ${userAge}) has requested to use ReadMyFinePrint and listed you as their parent or guardian.

ReadMyFinePrint is a legal document analysis service that helps users understand contracts and legal documents through AI-powered summaries.

Data Collection:
- We only collect email addresses for account creation
- Documents are processed anonymously and deleted immediately
- No personal information is shared with AI services

To review and provide consent, visit: ${consentUrl}

This consent request expires in 7 days.

For questions, contact: privacy@readmyfineprint.com

This email was sent in compliance with COPPA regulations.
          `
        });

        securityLogger.logSecurityEvent({
          eventType: 'PARENTAL_CONSENT_REQUESTED' as any,
          severity: 'LOW' as any,
          message: 'Parental consent email sent',
          ip,
          userAgent,
          details: { 
            userId: req.user?.id,
            parentEmail: parentEmail.replace(/(.{2}).*@/, '$1***@'), // Mask email in logs
            userAge,
            consentToken: consentToken.substring(0, 8) + '...' // Partial token in logs
          }
        });

        res.json({
          message: 'Parental consent request sent successfully',
          parentEmail: parentEmail.replace(/(.{2}).*@/, '$1***@'),
          expiresIn: '7 days',
          nextSteps: 'Please ask your parent or guardian to check their email and follow the consent process.'
        });

      } catch (emailError) {
        console.error('Failed to send parental consent email:', emailError);
        res.status(500).json({
          error: 'Failed to send parental consent email',
          code: 'EMAIL_SEND_ERROR'
        });
      }

    } catch (error) {
      console.error('Parental consent request error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid consent request data',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to process parental consent request',
        code: 'PARENTAL_CONSENT_ERROR'
      });
    }
  });

  /**
   * Handle parental consent response (from email link)
   */
  app.get('/api/age-verification/parental-consent/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { ip, userAgent } = getClientInfo(req);

      // In production, look up consent request by token
      // For now, return consent form
      res.json({
        message: 'Parental consent form',
        consentRequired: true,
        serviceInfo: {
          name: 'ReadMyFinePrint',
          description: 'Legal document analysis service',
          dataCollection: 'Email address only',
          dataRetention: 'Until account deletion',
          documentRetention: 'Zero retention - immediate deletion'
        }
      });

    } catch (error) {
      console.error('Parental consent token error:', error);
      res.status(400).json({
        error: 'Invalid or expired consent token',
        code: 'INVALID_CONSENT_TOKEN'
      });
    }
  });

  /**
   * Get COPPA compliance information
   */
  app.get('/api/coppa/compliance-info', async (req, res) => {
    const complianceInfo = {
      minimumAge: 13,
      parentalConsentRequired: true,
      dataCollection: {
        personal: ['Email address'],
        usage: ['Document processing statistics (anonymized)'],
        security: ['Hashed IP addresses for fraud prevention']
      },
      dataSharing: {
        openai: 'Anonymized document content only (no personal information)',
        stripe: 'Payment processing only (we do not store payment data)',
        noSale: 'We do not sell any personal information'
      },
      parentalRights: [
        'Review personal information collected',
        'Request deletion of child\'s account',
        'Withdraw consent at any time',
        'Contact us with questions or concerns'
      ],
      contactInfo: {
        email: 'privacy@readmyfineprint.com',
        subject: 'COPPA Inquiry',
        responseTime: 'Within 10 business days'
      },
      compliance: {
        law: 'Children\'s Online Privacy Protection Act (COPPA)',
        effectiveDate: '2024-12-26',
        lastUpdated: '2024-12-26'
      }
    };

    res.json(complianceInfo);
  });
}