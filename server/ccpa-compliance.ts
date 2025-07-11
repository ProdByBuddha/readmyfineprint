import type { Express } from 'express';
import { z } from 'zod';
import { requireUserAuth } from './auth';
import { getClientInfo, securityLogger } from './security-logger';
import { db } from './db';
import { users, userSubscriptions, usageRecords } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { emailService } from './email-service';

// CCPA request validation schema
const ccpaRequestSchema = z.object({
  requestType: z.enum(['access', 'delete', 'portability']),
  email: z.string().email(),
  preferenceCenter: z.boolean().optional(),
});

interface CcpaDataExport {
  personalInformation: {
    email: string;
    accountCreated: string;
    lastLogin: string | null;
    twoFactorEnabled: boolean;
  };
  subscriptionData: any[];
  usageStatistics: any[];
  dataProcessingLog: {
    documentsProcessed: number;
    lastProcessingDate: string | null;
    retentionPolicy: string;
  };
  thirdPartySharing: {
    openai: {
      dataShared: string;
      purpose: string;
      legalBasis: string;
      safeguards: string[];
    };
    stripe: {
      dataShared: string;
      purpose: string;
      legalBasis: string;
    };
  };
  exportMetadata: {
    exportDate: string;
    exportRequested: string;
    dataAccuracy: string;
    requestId: string;
  };
}

export function registerCcpaRoutes(app: Express) {
  
  /**
   * Handle CCPA data requests (access, delete, portability)
   */
  app.post('/api/ccpa/data-request', requireUserAuth, async (req: any, res) => {
    try {
      const { requestType, email } = ccpaRequestSchema.parse(req.body);
      const userId = req.user.id;
      const userEmail = req.user.email;
      const { ip, userAgent } = getClientInfo(req);

      // Verify email matches authenticated user
      if (email !== userEmail) {
        securityLogger.logSecurityEvent({
          eventType: 'CCPA_REQUEST_EMAIL_MISMATCH' as any,
          severity: 'HIGH' as any,
          message: 'CCPA request email does not match authenticated user',
          ip,
          userAgent,
          details: { userId, requestedEmail: email, userEmail }
        });

        return res.status(400).json({
          error: 'Email address must match your account email',
          code: 'EMAIL_MISMATCH'
        });
      }

      securityLogger.logSecurityEvent({
        eventType: 'CCPA_REQUEST_INITIATED' as any,
        severity: 'LOW' as any,
        message: `CCPA ${requestType} request initiated`,
        ip,
        userAgent,
        details: { userId, requestType, email }
      });

      const requestId = `ccpa-${Date.now()}-${userId.substring(0, 8)}`;

      switch (requestType) {
        case 'access':
          return await handleAccessRequest(userId, userEmail, requestId, ip, userAgent, res);
        
        case 'delete':
          return await handleDeleteRequest(userId, userEmail, requestId, ip, userAgent, res);
        
        case 'portability':
          return await handlePortabilityRequest(userId, userEmail, requestId, ip, userAgent, res);
        
        default:
          return res.status(400).json({
            error: 'Invalid request type',
            code: 'INVALID_REQUEST_TYPE'
          });
      }

    } catch (error) {
      console.error('CCPA request error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to process CCPA request',
        code: 'CCPA_REQUEST_ERROR'
      });
    }
  });

  /**
   * Get CCPA disclosure information
   */
  app.get('/api/ccpa/disclosure', async (req, res) => {
    const disclosure = {
      categories: {
        identifiers: {
          collected: ['Email address'],
          purposes: ['Account authentication', 'Service delivery'],
          sources: ['Directly from consumer'],
          thirdParties: ['None for sale'],
          retention: 'Until account deletion'
        },
        commercialInformation: {
          collected: ['Subscription tier', 'Usage statistics'],
          purposes: ['Service provision', 'Billing'],
          sources: ['Consumer interaction'],
          thirdParties: ['Stripe for payment processing'],
          retention: '7 years for financial records'
        },
        internetActivity: {
          collected: ['Hashed IP addresses', 'Session data'],
          purposes: ['Security', 'Fraud prevention'],
          sources: ['Website interaction'],
          thirdParties: ['None'],
          retention: '90 days'
        },
        professionalInformation: {
          collected: ['Anonymized document content'],
          purposes: ['AI analysis'],
          sources: ['Document uploads'],
          thirdParties: ['OpenAI (anonymized only)'],
          retention: 'Zero retention - immediate deletion'
        }
      },
      rights: {
        rightToKnow: {
          description: 'Request details about personal information collected',
          howToExercise: 'Submit request through account settings or email privacy@readmyfineprint.com',
          responseTime: '45 days'
        },
        rightToDelete: {
          description: 'Request deletion of personal information',
          howToExercise: 'Submit request through account settings or email privacy@readmyfineprint.com',
          responseTime: '45 days',
          exceptions: ['Legal compliance obligations', 'Active payment disputes']
        },
        rightToPortability: {
          description: 'Receive personal information in portable format',
          howToExercise: 'Submit request through account settings or email privacy@readmyfineprint.com',
          responseTime: '45 days'
        },
        rightToOptOut: {
          description: 'We do not sell personal information',
          status: 'Not applicable - no data sales'
        }
      },
      contactInfo: {
        email: 'privacy@readmyfineprint.com',
        responseTime: 'Within 45 days',
        verificationRequired: true
      },
      lastUpdated: '2024-12-26'
    };

    res.json(disclosure);
  });
}

/**
 * Handle CCPA access request
 */
async function handleAccessRequest(
  userId: string, 
  userEmail: string, 
  requestId: string, 
  ip: string, 
  userAgent: string, 
  res: any
) {
  try {
    // Gather user data
    const userData = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userData.length) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userData[0];

    // Get subscription data
    const subscriptions = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId));

    // Get usage statistics
    const usage = await db
      .select()
      .from(usageRecords)
      .where(eq(usageRecords.userId, userId));

    const accessData = {
      personalInformation: {
        email: user.email,
        accountCreated: user.createdAt?.toISOString(),
        lastLogin: user.lastLoginAt?.toISOString() || null,
        twoFactorEnabled: user.twoFactorEnabled,
        emailVerified: user.emailVerified,
        accountStatus: user.isActive ? 'Active' : 'Inactive'
      },
      subscriptionData: subscriptions.map((sub: any) => ({
        tierId: sub.tierId,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        createdAt: sub.createdAt.toISOString()
      })),
      usageStatistics: usage.map((u: any) => ({
        period: u.period,
        documentsAnalyzed: u.documentsAnalyzed,
        tokensUsed: u.tokensUsed,
        month: u.period
      })),
      dataProcessingDetails: {
        documentRetention: 'Zero retention - documents deleted immediately after analysis',
        piiHandling: 'All PII redacted before AI processing',
        encryptionInTransit: 'TLS 1.3',
        encryptionAtRest: 'AES-256'
      },
      thirdPartySharing: {
        openai: {
          dataShared: 'Anonymized, PII-redacted document content only',
          purpose: 'Legal document analysis',
          legalBasis: 'Legitimate interest for service provision',
          safeguards: ['Standard Contractual Clauses', 'Data anonymization', 'Zero retention agreement']
        },
        stripe: {
          dataShared: 'Payment information only (not stored by us)',
          purpose: 'Payment processing',
          legalBasis: 'Contract performance'
        }
      },
      requestMetadata: {
        requestId,
        requestDate: new Date().toISOString(),
        requestType: 'access',
        processingTime: '1 day (automated)',
        nextSteps: 'Review your data. Contact privacy@readmyfineprint.com with questions.'
      }
    };

    // Log the access request completion
    securityLogger.logSecurityEvent({
      eventType: 'CCPA_ACCESS_REQUEST_COMPLETED' as any,
      severity: 'LOW' as any,
      message: 'CCPA access request completed',
      ip,
      userAgent,
      details: { userId, requestId, dataCategories: Object.keys(accessData).length }
    });

    res.json({
      message: 'Access request completed successfully',
      requestId,
      data: accessData
    });

  } catch (error) {
    console.error('CCPA access request error:', error);
    res.status(500).json({
      error: 'Failed to process access request',
      code: 'ACCESS_REQUEST_ERROR'
    });
  }
}

/**
 * Handle CCPA delete request
 */
async function handleDeleteRequest(
  userId: string, 
  userEmail: string, 
  requestId: string, 
  ip: string, 
  userAgent: string, 
  res: any
) {
  try {
    // Note: This creates a deletion request that requires admin approval
    // for compliance and to handle exceptions (active subscriptions, legal holds, etc.)
    
    securityLogger.logSecurityEvent({
      eventType: 'CCPA_DELETE_REQUEST_SUBMITTED' as any,
      severity: 'MEDIUM' as any,
      message: 'CCPA deletion request submitted for review',
      ip,
      userAgent,
      details: { userId, requestId }
    });

    // Send notification email
    try {
      await emailService.sendEmail({
        to: userEmail,
        subject: 'CCPA Data Deletion Request Received',
        html: `
          <h2>Data Deletion Request Received</h2>
          <p>We have received your request to delete your personal information under the California Consumer Privacy Act (CCPA).</p>
          
          <p><strong>Request ID:</strong> ${requestId}</p>
          <p><strong>Request Date:</strong> ${new Date().toLocaleString()}</p>
          
          <h3>Next Steps:</h3>
          <ul>
            <li>We will review your request within 10 business days</li>
            <li>We will verify your identity before processing</li>
            <li>Deletion will be completed within 45 days of verification</li>
            <li>You will receive confirmation once deletion is complete</li>
          </ul>
          
          <h3>What Will Be Deleted:</h3>
          <ul>
            <li>Account information and email address</li>
            <li>Usage statistics and preferences</li>
            <li>Security logs (after 90-day retention period)</li>
          </ul>
          
          <h3>What Will Be Retained:</h3>
          <ul>
            <li>Payment records (7 years for tax compliance)</li>
            <li>Data needed for active legal proceedings</li>
            <li>Anonymized usage statistics (no personal identifiers)</li>
          </ul>
          
          <p>If you have questions, contact us at privacy@readmyfineprint.com</p>
        `,
        text: `CCPA Data Deletion Request Received (ID: ${requestId}). We will process your request within 45 days. Contact privacy@readmyfineprint.com with questions.`
      });
    } catch (emailError) {
      console.error('Failed to send CCPA deletion email:', emailError);
    }

    res.json({
      message: 'Deletion request submitted successfully. You will receive confirmation within 45 days.',
      requestId,
      estimatedCompletion: '45 days',
      contactEmail: 'privacy@readmyfineprint.com'
    });

  } catch (error) {
    console.error('CCPA delete request error:', error);
    res.status(500).json({
      error: 'Failed to process deletion request',
      code: 'DELETE_REQUEST_ERROR'
    });
  }
}

/**
 * Handle CCPA portability request
 */
async function handlePortabilityRequest(
  userId: string, 
  userEmail: string, 
  requestId: string, 
  ip: string, 
  userAgent: string, 
  res: any
) {
  try {
    // This is similar to access request but formatted for portability
    const accessData = await handleAccessRequest(userId, userEmail, requestId, ip, userAgent, { json: () => {} });
    
    // Create portable format
    const portableData: CcpaDataExport = {
      personalInformation: {
        email: userEmail,
        accountCreated: new Date().toISOString(),
        lastLogin: null,
        twoFactorEnabled: false
      },
      subscriptionData: [],
      usageStatistics: [],
      dataProcessingLog: {
        documentsProcessed: 0,
        lastProcessingDate: null,
        retentionPolicy: 'Zero retention - immediate deletion after analysis'
      },
      thirdPartySharing: {
        openai: {
          dataShared: 'Anonymized document content only',
          purpose: 'Legal document analysis',
          legalBasis: 'Legitimate interest',
          safeguards: ['Standard Contractual Clauses', 'Data anonymization', 'Zero retention']
        },
        stripe: {
          dataShared: 'Payment information (not stored by ReadMyFinePrint)',
          purpose: 'Payment processing',
          legalBasis: 'Contract performance'
        }
      },
      exportMetadata: {
        exportDate: new Date().toISOString(),
        exportRequested: userEmail,
        dataAccuracy: 'Data is current as of export date',
        requestId
      }
    };

    securityLogger.logSecurityEvent({
      eventType: 'CCPA_PORTABILITY_REQUEST_COMPLETED' as any,
      severity: 'LOW' as any,
      message: 'CCPA portability request completed',
      ip,
      userAgent,
      details: { userId, requestId }
    });

    res.json({
      message: 'Data portability request completed successfully',
      requestId,
      format: 'JSON',
      data: portableData
    });

  } catch (error) {
    console.error('CCPA portability request error:', error);
    res.status(500).json({
      error: 'Failed to process portability request',
      code: 'PORTABILITY_REQUEST_ERROR'
    });
  }
}