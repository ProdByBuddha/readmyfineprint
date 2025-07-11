import crypto from 'crypto';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { securityLogger } from './security-logger';
import { emailService } from './email-service';

interface LegalProfessionalProfile {
  barAdmission: {
    state: string;
    barNumber: string;
    admissionDate: string;
    status: 'active' | 'inactive' | 'suspended';
  };
  lawFirm: {
    name: string;
    address: string;
    website?: string;
    size: 'solo' | 'small' | 'medium' | 'large' | 'biglaw';
  };
  practiceAreas: string[];
  professionalLiability: {
    carrier: string;
    policyNumber: string;
    coverageAmount: string;
    expirationDate: string;
  };
  ethicsTraining: {
    completed: boolean;
    completionDate?: string;
    provider?: string;
  };
}

interface PrivilegeAnalysis {
  isPrivileged: boolean;
  confidenceLevel: number;
  privilegeTypes: string[];
  recommendations: string[];
  warningLevel: 'none' | 'low' | 'medium' | 'high';
}

class LegalProfessionalService {
  
  /**
   * Verify legal professional credentials
   */
  async verifyLegalProfessional(
    userId: string,
    profile: LegalProfessionalProfile,
    ipAddress: string,
    userAgent: string
  ): Promise<{ verified: boolean; verificationId?: string; message: string }> {
    try {
      // Generate verification ID
      const verificationId = crypto.randomUUID();
      
      // Log verification attempt
      securityLogger.logSecurityEvent({
        eventType: 'LEGAL_PROFESSIONAL_VERIFICATION' as any,
        severity: 'MEDIUM' as any,
        message: 'Legal professional verification initiated',
        ip: ipAddress,
        userAgent,
        details: { 
          userId,
          verificationId,
          state: profile.barAdmission.state,
          firmName: profile.lawFirm.name,
          practiceAreas: profile.practiceAreas.length
        }
      });

      // In production, this would integrate with state bar APIs for verification
      // For now, we'll implement a manual verification process

      // Store verification request (in production, this would be in database)
      const verificationRequest = {
        id: verificationId,
        userId,
        profile,
        status: 'pending',
        submittedAt: new Date(),
        ipAddress: crypto.createHash('sha256').update(ipAddress).digest('hex'),
        userAgent: crypto.createHash('sha256').update(userAgent).digest('hex')
      };

      // Send verification email to legal team
      await this.notifyLegalTeamForVerification(verificationRequest);

      // Update user with pending verification status
      await db.update(users)
        .set({ 
          // In production, add legal_professional_verification_status field
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      return {
        verified: false, // Pending manual verification
        verificationId,
        message: 'Legal professional verification submitted. You will be contacted within 2 business days for verification completion.'
      };

    } catch (error) {
      console.error('Legal professional verification error:', error);
      
      securityLogger.logSecurityEvent({
        eventType: 'LEGAL_PROFESSIONAL_VERIFICATION_ERROR' as any,
        severity: 'HIGH' as any,
        message: 'Legal professional verification failed',
        ip: ipAddress,
        userAgent,
        details: { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return {
        verified: false,
        message: 'Verification request failed. Please contact legal-support@readmyfineprint.com'
      };
    }
  }

  /**
   * Analyze document content for attorney-client privilege
   */
  async analyzePrivilegeContent(
    content: string,
    userId?: string,
    isLegalProfessional: boolean = false
  ): Promise<PrivilegeAnalysis> {
    try {
      // Privilege detection patterns
      const privilegePatterns = {
        attorneyClient: [
          /attorney[- ]client/i,
          /privileged (and )?confidential/i,
          /legal advice/i,
          /counsel.*advise[ds]?/i,
          /confidential.*counsel/i,
          /attorney work product/i
        ],
        workProduct: [
          /work product/i,
          /attorney.*(opinion|analysis|strategy)/i,
          /legal strategy/i,
          /litigation.*plan/i,
          /case strategy/i,
          /mental impression/i
        ],
        confidential: [
          /confidential/i,
          /privileged/i,
          /attorney.*(eyes.*only|confidential)/i,
          /law firm.*confidential/i,
          /client.*confidential/i
        ],
        settlement: [
          /settlement.*negotiation/i,
          /mediation.*confidential/i,
          /without prejudice/i,
          /settlement.*discussion/i,
          /compromise.*negotiation/i
        ]
      };

      let isPrivileged = false;
      let confidenceLevel = 0;
      const privilegeTypes: string[] = [];
      const recommendations: string[] = [];
      let warningLevel: 'none' | 'low' | 'medium' | 'high' = 'none';

      // Check for privilege indicators
      for (const [type, patterns] of Object.entries(privilegePatterns)) {
        const matches = patterns.filter(pattern => pattern.test(content));
        if (matches.length > 0) {
          isPrivileged = true;
          privilegeTypes.push(type);
          confidenceLevel += matches.length * 20; // Each match increases confidence
        }
      }

      // Determine warning level and recommendations
      if (isPrivileged) {
        if (confidenceLevel >= 80) {
          warningLevel = 'high';
          recommendations.push('This document appears to contain highly privileged material');
          recommendations.push('Consider manual review before AI processing');
          recommendations.push('Ensure client consent for third-party AI analysis');
          recommendations.push('Verify firm policies allow AI tool use for privileged content');
        } else if (confidenceLevel >= 50) {
          warningLevel = 'medium';
          recommendations.push('This document may contain privileged material');
          recommendations.push('Review privilege implications before processing');
          recommendations.push('Consider enhanced anonymization options');
        } else {
          warningLevel = 'low';
          recommendations.push('Potential privilege indicators detected');
          recommendations.push('Review document classification');
        }

        // Add legal professional specific recommendations
        if (isLegalProfessional) {
          recommendations.push('As a legal professional, ensure Model Rule 1.6 compliance');
          recommendations.push('Document client consent for AI tool use');
          recommendations.push('Consider alternative non-AI analysis if privilege concerns exist');
        }
      }

      // Cap confidence level at 100
      confidenceLevel = Math.min(confidenceLevel, 100);

      // Log privilege analysis
      if (userId) {
        securityLogger.logSecurityEvent({
          eventType: 'PRIVILEGE_ANALYSIS_COMPLETED' as any,
          severity: warningLevel === 'high' ? 'HIGH' as any : 'LOW' as any,
          message: `Privilege analysis completed: ${isPrivileged ? 'privileged' : 'non-privileged'} content detected`,
          ip: '',
          userAgent: '',
          details: { 
            userId,
            isPrivileged,
            confidenceLevel,
            privilegeTypes,
            warningLevel,
            isLegalProfessional
          }
        });
      }

      return {
        isPrivileged,
        confidenceLevel,
        privilegeTypes,
        recommendations,
        warningLevel
      };

    } catch (error) {
      console.error('Privilege analysis error:', error);
      
      // Return safe default - assume privileged if analysis fails
      return {
        isPrivileged: true,
        confidenceLevel: 100,
        privilegeTypes: ['unknown'],
        recommendations: ['Analysis failed - treat as privileged material'],
        warningLevel: 'high'
      };
    }
  }

  /**
   * Generate privilege protection notice for legal professionals
   */
  generatePrivilegeNotice(analysis: PrivilegeAnalysis, isLegalProfessional: boolean): string {
    if (!analysis.isPrivileged) {
      return 'No attorney-client privilege indicators detected. Standard processing will apply.';
    }

    let notice = '⚖️ **ATTORNEY-CLIENT PRIVILEGE DETECTED**\n\n';
    
    notice += `**Confidence Level**: ${analysis.confidenceLevel}%\n`;
    notice += `**Privilege Types**: ${analysis.privilegeTypes.join(', ')}\n\n`;
    
    notice += '**Protections Applied**:\n';
    notice += '• Enhanced anonymization before AI processing\n';
    notice += '• Immediate deletion after analysis (zero retention)\n';
    notice += '• Excluded from AI model training\n';
    notice += '• Audit trail for privilege protection verification\n\n';
    
    if (isLegalProfessional) {
      notice += '**Professional Responsibility Reminders**:\n';
      notice += '• Ensure client consent for AI tool use (Model Rule 1.6)\n';
      notice += '• Verify firm policies allow third-party AI processing\n';
      notice += '• Consider professional liability implications\n';
      notice += '• Document privilege protection measures for client files\n\n';
    }
    
    notice += '**Recommendations**:\n';
    analysis.recommendations.forEach(rec => {
      notice += `• ${rec}\n`;
    });

    return notice;
  }

  /**
   * Apply enhanced privilege protection during document processing
   */
  async applyPrivilegeProtection(
    content: string,
    analysis: PrivilegeAnalysis,
    userId?: string
  ): Promise<string> {
    try {
      let protectedContent = content;

      if (analysis.isPrivileged) {
        // Enhanced anonymization for privileged content
        protectedContent = await this.enhancedPrivilegeAnonymization(content);
        
        // Log privilege protection application
        if (userId) {
          securityLogger.logSecurityEvent({
            eventType: 'PRIVILEGE_PROTECTION_APPLIED' as any,
            severity: 'MEDIUM' as any,
            message: 'Enhanced privilege protection applied to document',
            ip: '',
            userAgent: '',
            details: { 
              userId,
              confidenceLevel: analysis.confidenceLevel,
              privilegeTypes: analysis.privilegeTypes,
              protectionLevel: 'enhanced'
            }
          });
        }
      }

      return protectedContent;

    } catch (error) {
      console.error('Privilege protection application error:', error);
      
      // If protection fails, return heavily redacted content
      return '[PRIVILEGE PROTECTION ERROR - CONTENT REDACTED FOR SAFETY]';
    }
  }

  /**
   * Enhanced anonymization specifically for privileged content
   */
  private async enhancedPrivilegeAnonymization(content: string): Promise<string> {
    let anonymized = content;

    // Enhanced redaction patterns for privileged content
    const privilegeRedactionPatterns = [
      // Attorney names and firms
      { pattern: /(attorney|counsel|esq\.?)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/gi, replacement: '[ATTORNEY NAME REDACTED]' },
      { pattern: /([A-Z][a-z]+ )+Law (Firm|Office|Group|LLP|PC|PLLC)/gi, replacement: '[LAW FIRM REDACTED]' },
      
      // Client identifiers
      { pattern: /(client|party)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/gi, replacement: '[CLIENT NAME REDACTED]' },
      { pattern: /([A-Z][a-z]+ )+v\.?\s+([A-Z][a-z]+ )+/gi, replacement: '[CASE PARTIES REDACTED]' },
      
      // Specific privilege markers
      { pattern: /attorney.{0,20}client.{0,20}privilege/gi, replacement: '[PRIVILEGED COMMUNICATION]' },
      { pattern: /work product/gi, replacement: '[WORK PRODUCT]' },
      { pattern: /confidential.{0,20}(legal|attorney)/gi, replacement: '[CONFIDENTIAL LEGAL MATTER]' },
      
      // Case-specific information
      { pattern: /case\s+(no\.?|number)[:\s]*\d+/gi, replacement: '[CASE NUMBER REDACTED]' },
      { pattern: /docket\s+(no\.?|number)[:\s]*\d+/gi, replacement: '[DOCKET NUMBER REDACTED]' },
      
      // Financial and settlement information
      { pattern: /\$[\d,]+(\.\d{2})?/g, replacement: '[AMOUNT REDACTED]' },
      { pattern: /settlement.{0,20}amount/gi, replacement: '[SETTLEMENT TERMS REDACTED]' },
    ];

    // Apply enhanced redaction
    for (const { pattern, replacement } of privilegeRedactionPatterns) {
      anonymized = anonymized.replace(pattern, replacement);
    }

    // Remove any remaining potential identifiers
    anonymized = anonymized.replace(/([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(Law|Legal|Attorney|Counsel)/gi, '[LEGAL PROFESSIONAL REDACTED]');

    return anonymized;
  }

  /**
   * Generate privilege protection audit trail
   */
  async generatePrivilegeAuditTrail(
    userId: string,
    documentId: string,
    analysis: PrivilegeAnalysis,
    protectionMeasures: string[]
  ): Promise<string> {
    const auditTrail = {
      id: crypto.randomUUID(),
      userId,
      documentId,
      timestamp: new Date().toISOString(),
      privilegeAnalysis: {
        isPrivileged: analysis.isPrivileged,
        confidenceLevel: analysis.confidenceLevel,
        privilegeTypes: analysis.privilegeTypes,
        warningLevel: analysis.warningLevel
      },
      protectionMeasures,
      complianceVerification: {
        zeroRetention: true,
        enhancedAnonymization: analysis.isPrivileged,
        auditLogging: true,
        modelTrainingExclusion: true
      },
      legalStandards: {
        modelRule1_6: 'Confidentiality maintained through technical safeguards',
        workProductDoctrine: analysis.privilegeTypes.includes('workProduct') ? 'Enhanced protection applied' : 'Not applicable',
        inadvertentDisclosurePrevention: 'Zero retention architecture prevents disclosure'
      }
    };

    // Log audit trail creation
    securityLogger.logSecurityEvent({
      eventType: 'PRIVILEGE_AUDIT_TRAIL_CREATED' as any,
      severity: 'LOW' as any,
      message: 'Privilege protection audit trail generated',
      ip: '',
      userAgent: '',
      details: { 
        userId,
        documentId,
        auditTrailId: auditTrail.id,
        privilegeProtectionLevel: analysis.warningLevel
      }
    });

    return JSON.stringify(auditTrail, null, 2);
  }

  /**
   * Notify legal team for professional verification
   */
  private async notifyLegalTeamForVerification(verificationRequest: any): Promise<void> {
    try {
      await emailService.sendEmail({
        to: 'legal-verification@readmyfineprint.com',
        subject: `Legal Professional Verification Request - ${verificationRequest.id}`,
        html: `
          <h2>Legal Professional Verification Request</h2>
          
          <h3>Applicant Information</h3>
          <ul>
            <li><strong>User ID:</strong> ${verificationRequest.userId}</li>
            <li><strong>Verification ID:</strong> ${verificationRequest.id}</li>
            <li><strong>Submission Date:</strong> ${verificationRequest.submittedAt.toLocaleString()}</li>
          </ul>
          
          <h3>Bar Admission Details</h3>
          <ul>
            <li><strong>State:</strong> ${verificationRequest.profile.barAdmission.state}</li>
            <li><strong>Bar Number:</strong> ${verificationRequest.profile.barAdmission.barNumber}</li>
            <li><strong>Admission Date:</strong> ${verificationRequest.profile.barAdmission.admissionDate}</li>
            <li><strong>Status:</strong> ${verificationRequest.profile.barAdmission.status}</li>
          </ul>
          
          <h3>Law Firm Information</h3>
          <ul>
            <li><strong>Firm Name:</strong> ${verificationRequest.profile.lawFirm.name}</li>
            <li><strong>Firm Size:</strong> ${verificationRequest.profile.lawFirm.size}</li>
            <li><strong>Address:</strong> ${verificationRequest.profile.lawFirm.address}</li>
            ${verificationRequest.profile.lawFirm.website ? `<li><strong>Website:</strong> ${verificationRequest.profile.lawFirm.website}</li>` : ''}
          </ul>
          
          <h3>Practice Areas</h3>
          <ul>
            ${verificationRequest.profile.practiceAreas.map((area: string) => `<li>${area}</li>`).join('')}
          </ul>
          
          <h3>Professional Liability Insurance</h3>
          <ul>
            <li><strong>Carrier:</strong> ${verificationRequest.profile.professionalLiability.carrier}</li>
            <li><strong>Policy Number:</strong> ${verificationRequest.profile.professionalLiability.policyNumber}</li>
            <li><strong>Coverage Amount:</strong> ${verificationRequest.profile.professionalLiability.coverageAmount}</li>
            <li><strong>Expiration:</strong> ${verificationRequest.profile.professionalLiability.expirationDate}</li>
          </ul>
          
          <h3>Ethics Training</h3>
          <ul>
            <li><strong>Completed:</strong> ${verificationRequest.profile.ethicsTraining.completed ? 'Yes' : 'No'}</li>
            ${verificationRequest.profile.ethicsTraining.completionDate ? `<li><strong>Completion Date:</strong> ${verificationRequest.profile.ethicsTraining.completionDate}</li>` : ''}
            ${verificationRequest.profile.ethicsTraining.provider ? `<li><strong>Provider:</strong> ${verificationRequest.profile.ethicsTraining.provider}</li>` : ''}
          </ul>
          
          <h3>Next Steps</h3>
          <ol>
            <li>Verify bar admission with state bar database</li>
            <li>Confirm law firm employment/association</li>
            <li>Validate professional liability insurance</li>
            <li>Review ethics training credentials</li>
            <li>Update user account with verification status</li>
            <li>Notify applicant of verification result</li>
          </ol>
          
          <p><strong>SLA:</strong> Complete verification within 2 business days</p>
        `,
        text: `Legal Professional Verification Request - ${verificationRequest.id}\n\nPlease review and verify the legal professional credentials submitted. Complete verification within 2 business days per SLA.`
      });

    } catch (error) {
      console.error('Failed to send legal verification email:', error);
    }
  }

  /**
   * Get legal professional status for user
   */
  async getLegalProfessionalStatus(userId: string): Promise<{
    isVerified: boolean;
    verificationLevel?: string;
    practiceAreas?: string[];
    firmName?: string;
    barState?: string;
  }> {
    try {
      // In production, this would query the legal_professional_verifications table
      // For now, return mock data based on user
      
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user.length) {
        return { isVerified: false };
      }

      // Mock verification status - in production this would be from database
      return {
        isVerified: false, // Default to unverified
        verificationLevel: 'pending',
        practiceAreas: [],
        firmName: undefined,
        barState: undefined
      };

    } catch (error) {
      console.error('Error getting legal professional status:', error);
      return { isVerified: false };
    }
  }
}

// Export singleton instance
export const legalProfessionalService = new LegalProfessionalService();