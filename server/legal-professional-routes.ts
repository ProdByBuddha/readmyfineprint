import type { Express } from 'express';
import { z } from 'zod';
import { requireUserAuth, optionalUserAuth } from './auth';
import { getClientInfo, securityLogger } from './security-logger';
import { legalProfessionalService } from './legal-professional-service';

// Validation schemas
const legalProfessionalProfileSchema = z.object({
  barAdmission: z.object({
    state: z.string().min(2).max(2), // Two-letter state code
    barNumber: z.string().min(1),
    admissionDate: z.string(), // ISO date string
    status: z.enum(['active', 'inactive', 'suspended'])
  }),
  lawFirm: z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    website: z.string().url().optional(),
    size: z.enum(['solo', 'small', 'medium', 'large', 'biglaw'])
  }),
  practiceAreas: z.array(z.string()).min(1),
  professionalLiability: z.object({
    carrier: z.string().min(1),
    policyNumber: z.string().min(1),
    coverageAmount: z.string().min(1),
    expirationDate: z.string() // ISO date string
  }),
  ethicsTraining: z.object({
    completed: z.boolean(),
    completionDate: z.string().optional(),
    provider: z.string().optional()
  })
});

const privilegeAnalysisSchema = z.object({
  content: z.string().min(1),
  documentType: z.string().optional(),
  isLegalProfessional: z.boolean().default(false)
});

export function registerLegalProfessionalRoutes(app: Express) {
  
  /**
   * Submit legal professional verification
   */
  app.post('/api/legal/verify-professional', requireUserAuth, async (req: any, res) => {
    try {
      const profile = legalProfessionalProfileSchema.parse(req.body);
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Submit verification request
      const result = await legalProfessionalService.verifyLegalProfessional(
        userId,
        profile,
        ip,
        userAgent
      );

      if (result.verified) {
        res.json({
          message: result.message,
          verified: true,
          verificationId: result.verificationId
        });
      } else {
        res.json({
          message: result.message,
          verified: false,
          verificationId: result.verificationId,
          nextSteps: [
            'Our legal team will review your credentials',
            'You will be contacted within 2 business days',
            'Verification typically takes 1-3 business days',
            'You will receive email confirmation once approved'
          ]
        });
      }

    } catch (error) {
      console.error('Legal professional verification error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid verification data',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to submit verification request',
        code: 'VERIFICATION_SUBMISSION_ERROR'
      });
    }
  });

  /**
   * Get legal professional verification status
   */
  app.get('/api/legal/professional-status', requireUserAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const status = await legalProfessionalService.getLegalProfessionalStatus(userId);

      res.json({
        isVerified: status.isVerified,
        verificationLevel: status.verificationLevel,
        practiceAreas: status.practiceAreas,
        firmName: status.firmName,
        barState: status.barState,
        privilegeProtectionEnabled: status.isVerified,
        enhancedSecurityFeatures: status.isVerified
      });

    } catch (error) {
      console.error('Legal professional status error:', error);
      res.status(500).json({
        error: 'Failed to get professional status',
        code: 'STATUS_RETRIEVAL_ERROR'
      });
    }
  });

  /**
   * Analyze document content for attorney-client privilege
   */
  app.post('/api/legal/analyze-privilege', optionalUserAuth, async (req: any, res) => {
    try {
      const { content, documentType, isLegalProfessional } = privilegeAnalysisSchema.parse(req.body);
      const userId = req.user?.id;
      const { ip, userAgent } = getClientInfo(req);

      // Perform privilege analysis
      const analysis = await legalProfessionalService.analyzePrivilegeContent(
        content,
        userId,
        isLegalProfessional
      );

      // Generate privilege notice
      const privilegeNotice = legalProfessionalService.generatePrivilegeNotice(
        analysis,
        isLegalProfessional
      );

      // Log privilege analysis request
      securityLogger.logSecurityEvent({
        eventType: 'PRIVILEGE_ANALYSIS_REQUESTED' as any,
        severity: analysis.warningLevel === 'high' ? 'MEDIUM' as any : 'LOW' as any,
        message: `Privilege analysis completed: ${analysis.isPrivileged ? 'privileged' : 'non-privileged'} content`,
        ip,
        userAgent,
        details: { 
          userId: userId || 'anonymous',
          isPrivileged: analysis.isPrivileged,
          confidenceLevel: analysis.confidenceLevel,
          warningLevel: analysis.warningLevel,
          isLegalProfessional
        }
      });

      res.json({
        analysis: {
          isPrivileged: analysis.isPrivileged,
          confidenceLevel: analysis.confidenceLevel,
          privilegeTypes: analysis.privilegeTypes,
          warningLevel: analysis.warningLevel
        },
        recommendations: analysis.recommendations,
        privilegeNotice,
        protectionMeasures: analysis.isPrivileged ? [
          'Enhanced anonymization applied',
          'Zero retention policy enforced',
          'Excluded from AI model training',
          'Audit trail generated',
          'Immediate deletion after processing'
        ] : [
          'Standard anonymization applied',
          'Zero retention policy enforced',
          'Standard audit logging'
        ],
        legalGuidance: isLegalProfessional ? {
          modelRule1_6: 'Ensure client consent for AI tool use',
          ethicsOpinions: 'Review applicable state bar technology opinions',
          professionalLiability: 'Verify coverage for AI tool use',
          clientCommunication: 'Document AI tool use in client files'
        } : undefined
      });

    } catch (error) {
      console.error('Privilege analysis error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid analysis request',
          code: 'INVALID_INPUT',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to analyze privilege content',
        code: 'PRIVILEGE_ANALYSIS_ERROR'
      });
    }
  });

  /**
   * Apply privilege protection to content
   */
  app.post('/api/legal/apply-privilege-protection', optionalUserAuth, async (req: any, res) => {
    try {
      const { content, analysis } = req.body;
      const userId = req.user?.id;
      const { ip, userAgent } = getClientInfo(req);

      if (!analysis || typeof analysis.isPrivileged !== 'boolean') {
        return res.status(400).json({
          error: 'Valid privilege analysis required',
          code: 'INVALID_ANALYSIS'
        });
      }

      // Apply privilege protection
      const protectedContent = await legalProfessionalService.applyPrivilegeProtection(
        content,
        analysis,
        userId
      );

      // Generate audit trail if privileged content
      let auditTrail = null;
      if (analysis.isPrivileged && userId) {
        const documentId = crypto.randomUUID();
        const protectionMeasures = [
          'Enhanced anonymization',
          'Zero retention enforcement',
          'Model training exclusion',
          'Audit trail generation'
        ];

        auditTrail = await legalProfessionalService.generatePrivilegeAuditTrail(
          userId,
          documentId,
          analysis,
          protectionMeasures
        );
      }

      // Log protection application
      securityLogger.logSecurityEvent({
        eventType: 'PRIVILEGE_PROTECTION_APPLIED' as any,
        severity: analysis.isPrivileged ? 'MEDIUM' as any : 'LOW' as any,
        message: `Privilege protection ${analysis.isPrivileged ? 'enhanced' : 'standard'} applied`,
        ip,
        userAgent,
        details: { 
          userId: userId || 'anonymous',
          isPrivileged: analysis.isPrivileged,
          protectionLevel: analysis.isPrivileged ? 'enhanced' : 'standard'
        }
      });

      res.json({
        protectedContent,
        protectionApplied: analysis.isPrivileged,
        protectionLevel: analysis.isPrivileged ? 'enhanced' : 'standard',
        auditTrail: auditTrail ? JSON.parse(auditTrail) : null,
        compliance: {
          zeroRetention: true,
          enhancedAnonymization: analysis.isPrivileged,
          auditLogging: true,
          modelTrainingExclusion: analysis.isPrivileged
        }
      });

    } catch (error) {
      console.error('Privilege protection application error:', error);
      res.status(500).json({
        error: 'Failed to apply privilege protection',
        code: 'PRIVILEGE_PROTECTION_ERROR'
      });
    }
  });

  /**
   * Get attorney-client privilege information and guidelines
   */
  app.get('/api/legal/privilege-information', async (req, res) => {
    const privilegeInfo = {
      overview: {
        title: 'Attorney-Client Privilege Protection',
        description: 'Comprehensive safeguards for privileged legal communications',
        applicableLaws: [
          'ABA Model Rules of Professional Conduct Rule 1.6',
          'Federal Rules of Evidence Rule 502',
          'State Bar Ethics Opinions on Technology Use',
          'Restatement (Third) of the Law Governing Lawyers'
        ]
      },
      protections: {
        technical: [
          'Zero retention architecture - immediate deletion after analysis',
          'Enhanced anonymization for privileged content',
          'Exclusion from AI model training',
          'Comprehensive audit trails',
          'End-to-end encryption during processing'
        ],
        procedural: [
          'Client consent verification procedures',
          'Legal professional verification system',
          'Ethics compliance monitoring',
          'Privilege detection and warning system',
          'Alternative processing options for sensitive content'
        ]
      },
      legalStandards: {
        modelRule1_6: {
          requirement: 'Confidentiality of Information',
          compliance: 'Technical safeguards exceed "reasonable efforts" standard',
          documentation: 'Comprehensive privilege protection documentation available'
        },
        workProductDoctrine: {
          requirement: 'Protection of attorney work product',
          compliance: 'Enhanced anonymization for strategic and opinion work product',
          safeguards: 'Separate processing queues for work product materials'
        },
        inadvertentDisclosure: {
          prevention: 'Zero retention eliminates long-term disclosure risks',
          safeguards: 'Technical controls prevent accidental disclosure',
          recovery: 'No recovery needed - documents not retained'
        }
      },
      recommendedProcedures: {
        beforeUse: [
          'Obtain client consent for AI tool use',
          'Review firm policies on third-party technology',
          'Verify professional liability insurance coverage',
          'Complete legal professional verification'
        ],
        duringUse: [
          'Review privilege warnings and recommendations',
          'Document privilege protection measures in client files',
          'Use enhanced anonymization for sensitive content',
          'Monitor audit trails for compliance verification'
        ],
        afterUse: [
          'Verify document deletion confirmation',
          'Review audit trail for privilege protection',
          'Update client files with AI tool use documentation',
          'Maintain compliance records for bar association review'
        ]
      },
      supportResources: {
        ethicsHotline: 'legal-ethics@readmyfineprint.com',
        complianceDocumentation: '/legal/compliance-resources',
        barAssociationLiaison: 'Available for ethics opinion clarification',
        trainingResources: 'Continuing education credits available'
      }
    };

    res.json(privilegeInfo);
  });

  /**
   * Generate client consent form for AI tool use
   */
  app.post('/api/legal/generate-client-consent', requireUserAuth, async (req: any, res) => {
    try {
      const { clientName, matterDescription, firmName, attorneyName } = req.body;
      const userId = req.user.id;
      const { ip, userAgent } = getClientInfo(req);

      // Generate consent form template
      const consentForm = `
CLIENT CONSENT FOR AI DOCUMENT ANALYSIS TOOL USE

Client: ${clientName || '[CLIENT NAME]'}
Matter: ${matterDescription || '[MATTER DESCRIPTION]'}
Law Firm: ${firmName || '[LAW FIRM NAME]'}
Attorney: ${attorneyName || '[ATTORNEY NAME]'}
Date: ${new Date().toLocaleDateString()}

CONSENT TO USE OF ARTIFICIAL INTELLIGENCE DOCUMENT ANALYSIS

I, ${clientName || '[CLIENT NAME]'}, hereby consent to ${firmName || '[LAW FIRM NAME]'}'s use of ReadMyFinePrint, an artificial intelligence-powered document analysis service, in connection with my legal matter.

I understand and acknowledge:

1. NATURE OF SERVICE: ReadMyFinePrint uses artificial intelligence to analyze legal documents and provide plain-English summaries and risk assessments.

2. THIRD-PARTY PROCESSING: Documents will be processed by OpenAI's systems after anonymization and removal of personally identifiable information.

3. PRIVILEGE PROTECTION: The service implements comprehensive technical safeguards to protect attorney-client privilege:
   • Immediate deletion of documents after analysis (zero retention)
   • Enhanced anonymization before AI processing
   • Exclusion from AI model training
   • Comprehensive audit trails
   • End-to-end encryption during processing

4. CONFIDENTIALITY MEASURES: All confidential information will be anonymized before third-party processing, and no documents will be permanently stored by the service.

5. ALTERNATIVE OPTIONS: I understand that traditional manual document review remains available as an alternative to AI-assisted analysis.

6. PROFESSIONAL RESPONSIBILITY: My attorney has informed me that use of this tool complies with applicable professional responsibility rules, including ABA Model Rule 1.6.

7. RISKS AND BENEFITS: I understand both the potential benefits (enhanced efficiency and analysis) and risks (third-party processing) of using AI document analysis tools.

By signing below, I provide my informed consent for the use of ReadMyFinePrint in connection with my legal matter, understanding that my attorney will maintain all professional responsibilities and ethical obligations.

Client Signature: ___________________________ Date: _______________

${clientName || '[CLIENT NAME]'}


Attorney Signature: _________________________ Date: _______________

${attorneyName || '[ATTORNEY NAME]'}
${firmName || '[LAW FIRM NAME]'}

This consent form complies with ABA Model Rule 1.6 and applicable state bar ethics opinions regarding the use of technology in legal practice.
      `;

      // Log consent form generation
      securityLogger.logSecurityEvent({
        eventType: 'CLIENT_CONSENT_FORM_GENERATED' as any,
        severity: 'LOW' as any,
        message: 'Client consent form generated for AI tool use',
        ip,
        userAgent,
        details: { 
          userId,
          firmName: firmName || 'unspecified',
          hasClientName: !!clientName,
          hasMatterDescription: !!matterDescription
        }
      });

      res.json({
        consentForm: consentForm.trim(),
        generatedAt: new Date().toISOString(),
        formVersion: '1.0',
        complianceStandards: [
          'ABA Model Rule 1.6',
          'State Bar Technology Ethics Opinions',
          'Federal Rules of Evidence Rule 502'
        ],
        instructions: [
          'Review form with client before signing',
          'Explain AI processing and safeguards',
          'Discuss alternative options available',
          'Maintain signed copy in client file',
          'Document AI tool use in matter records'
        ]
      });

    } catch (error) {
      console.error('Client consent form generation error:', error);
      res.status(500).json({
        error: 'Failed to generate client consent form',
        code: 'CONSENT_FORM_GENERATION_ERROR'
      });
    }
  });
}