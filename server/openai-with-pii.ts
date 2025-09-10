import OpenAI from "openai";
import type { DocumentAnalysis, PIIRedactionInfo } from "@shared/schema";
import { securityLogger } from "./security-logger";
import { piiDetectionService, type PIIDetectionResult } from "./pii-detection";
import { enhancedPiiDetectionService } from "./enhanced-pii-detection";
import { piiEntanglementService } from "./pii-entanglement-service";
import { payloadHashingService } from "./payload-hashing-service";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface AnalysisWithPII {
  analysis: DocumentAnalysis;
  redactionInfo: PIIRedactionInfo;
  payloadFingerprint?: import('./payload-hashing-service').PayloadFingerprint;
}

export async function analyzeDocumentWithPII(
  content: string, 
  title: string, 
  options: {
    ip?: string;
    userAgent?: string;
    sessionId?: string;
    model?: string;
    userId?: string;
    piiDetection?: {
      enabled: boolean;
      detectNames?: boolean;
      minConfidence?: number;
      customPatterns?: Array<{ name: string; regex: RegExp; confidence: number; }>;
      useEnhancedDetection?: boolean; // Use multi-pass enhanced detection
      aggressiveMode?: boolean; // Bias toward over-detection for privacy
    };
    enablePayloadHashing?: boolean; // Enable multi-layer Russian Doll hashing
  } = {}
): Promise<AnalysisWithPII> {
  const {
    ip,
    userAgent,
    sessionId,
    model = "gpt-4o",
    userId,
    piiDetection = { 
      enabled: true, // Always enabled for maximum privacy protection
      useEnhancedDetection: true, // Default to enhanced multi-pass detection
      aggressiveMode: true // Default to aggressive mode for maximum privacy
    },
    enablePayloadHashing = true // Default to enabled for complete forensic traceability
  } = options;

  try {
    const processingStart = performance.now();
    const stageTimings: Record<string, number> = {};

    // Log OpenAI API usage for audit purposes
    if (ip && userAgent && sessionId) {
      securityLogger.logOpenAIUsage(ip, userAgent, sessionId, title);
    }

    let analysisContent = content;
    let piiDetectionResult: any = null;

    // Choose detection method based on options
    const detectionStart = performance.now();
    
    if (piiDetection.useEnhancedDetection) {
      console.log(`🔍 Performing enhanced multi-pass PII detection on document: "${title}"`);
      console.log(`   - Mode: ${piiDetection.aggressiveMode ? 'Aggressive (privacy-first)' : 'Balanced'}`);
      
      piiDetectionResult = await enhancedPiiDetectionService.detectPIIEnhanced(content, {
        enableHashing: true,
        sessionId: sessionId,
        documentId: title || 'untitled',
        aggressiveMode: piiDetection.aggressiveMode ?? true,
        customPatterns: piiDetection.customPatterns ?? []
      });
    } else {
      console.log(`🔍 Performing standard PII detection with Argon2 hashing on document: "${title}"`);
      
      piiDetectionResult = await piiDetectionService.detectPIIWithHashing(content, {
        detectNames: piiDetection.detectNames ?? true,
        minConfidence: piiDetection.minConfidence ?? 0.7,
        customPatterns: piiDetection.customPatterns ?? [],
        enableHashing: true,
        sessionId: sessionId,
        documentId: title || 'untitled'
      });
    }
    
    stageTimings.piiDetection = performance.now() - detectionStart;

    // Create redaction info based on detection results with enhanced hashing data
    const redactionInfo: PIIRedactionInfo = {
      hasRedactions: piiDetectionResult.matches.length > 0,
      originalContent: content,
      redactedContent: piiDetectionResult.redactedText,
      matches: piiDetectionResult.matches,
      redactionMap: Object.fromEntries(piiDetectionResult.redactionMap),
      detectionSettings: {
        detectNames: piiDetection.detectNames ?? true,
        minConfidence: piiDetection.minConfidence ?? 0.7,
        customPatterns: (piiDetection.customPatterns ?? []).map(p => ({
          name: p.name,
          pattern: p.regex.source,
          confidence: p.confidence
        }))
      },
      // Include Argon2 hashed PII data for secure entanglement
      hashedMatches: piiDetectionResult.hashedMatches,
      piiAnalytics: undefined // Will be calculated separately to avoid async issues
    };

    // Calculate PII analytics if we have hashed matches
    if (piiDetectionResult.hashedMatches?.length > 0) {
      try {
        const piiHashingModule = await import('./pii-hashing-service.js');
        redactionInfo.piiAnalytics = piiHashingModule.piiHashingService.createPIIAnalyticsSummary(piiDetectionResult.hashedMatches);
      } catch (error) {
        console.warn('Could not calculate PII analytics:', error);
      }
    }

    if (piiDetectionResult.matches.length > 0) {
      console.log(`🛡️ Found ${piiDetectionResult.matches.length} PII matches, redacting for OpenAI analysis`);
      console.log(`   - Types found: ${[...new Set(piiDetectionResult.matches.map((m: any) => m.type))].join(', ')}`);
      
      // Log secure entanglement information if hashing was performed
      if (redactionInfo.piiAnalytics && redactionInfo.piiAnalytics.documentPIIFingerprint) {
        console.log(`🔗 PII Entanglement: Risk Score ${redactionInfo.piiAnalytics.riskScore}, Fingerprint ${redactionInfo.piiAnalytics.documentPIIFingerprint.substring(0, 8)}...`);
        if (redactionInfo.piiAnalytics.entanglementIds && redactionInfo.piiAnalytics.entanglementIds.length > 0) {
          console.log(`   - Entanglement IDs: ${redactionInfo.piiAnalytics.entanglementIds.map(id => id.substring(0, 12) + '...').join(', ')}`);
        }
        
        // Store entanglement data for cross-document analysis
        if (sessionId && redactionInfo.hashedMatches) {
          piiEntanglementService.storeDocumentEntanglement(
            sessionId, 
            title || 'untitled',
            redactionInfo.hashedMatches,
            piiDetectionResult.detectionMetrics // Include enhanced detection metrics
          );
          
          // Check for cross-document entanglements in this session
          const entanglementCheck = piiEntanglementService.checkCrossDocumentEntanglement(
            sessionId,
            redactionInfo.hashedMatches
          );
          
          if (entanglementCheck.hasSharedPII) {
            console.log(`⚠️ Cross-document PII detected: ${entanglementCheck.sharedEntanglementIds.length} shared entanglements with previous document`);
          }
        }
      }
      
      analysisContent = piiDetectionResult.redactedText;
    } else {
      console.log(`✅ No PII detected in document: "${title}" - proceeding with original content`);
    }

    // Debug what we're sending to OpenAI
    console.log(`🤖 Sending to OpenAI (${model}):`);
    console.log(`   - Document: "${title}"`);
    console.log(`   - Original content length: ${content.length} characters`);
    console.log(`   - Analysis content length: ${analysisContent.length} characters`);
    console.log(`   - PII redactions: ${redactionInfo.hasRedactions ? redactionInfo.matches.length : 0}`);
    
    // Check if content seems to be garbled or has extraction issues
    const readableRatio = (analysisContent.match(/[a-zA-Z\s]/g) || []).length / analysisContent.length;
    console.log(`   - Readable character ratio: ${(readableRatio * 100).toFixed(1)}%`);
    
    if (readableRatio < 0.7) {
      console.log(`⚠️ WARNING: Content appears to have low readability (${(readableRatio * 100).toFixed(1)}% readable chars)`);
    }

    // Build the prompt with PII instructions if needed
    let prompt = `You are a legal document analysis expert. Analyze the following legal document and provide a comprehensive analysis in JSON format.

Document Title: ${title}`;

    // Add PII handling instructions if redactions were made
    if (redactionInfo.hasRedactions && piiDetectionResult) {
      const instructionMethod = piiDetection.useEnhancedDetection ? 
        'generateOpenAIInstructions' : 'generateOpenAIInstructions';
      
      prompt += `\n\n${piiDetectionService.generateOpenAIInstructions(piiDetectionResult.redactionMap)}`;
    }

    prompt += `

Document Content: ${analysisContent}

Please analyze this document and provide a JSON response with the following structure:
{
  "summary": "A brief overall summary of the document in plain English",
  "overallRisk": "low|moderate|high",
  "keyFindings": {
    "goodTerms": ["List of positive or fair terms found"],
    "reviewNeeded": ["Terms that require attention but aren't necessarily bad"],
    "redFlags": ["Concerning clauses or terms that pose significant risk"]
  },
  "sections": [
    {
      "title": "Section name (e.g., Payment Terms, Privacy Policy, etc.)",
      "riskLevel": "low|moderate|high",
      "summary": "Plain English explanation of this section",
      "concerns": ["List of specific concerns for this section if any"]
    }
  ]
}

Focus on:
1. Identifying unfair, one-sided, or potentially problematic clauses
2. Highlighting terms that could be costly or restrictive
3. Finding any language that might be confusing or misleading
4. Noting important deadlines, obligations, or requirements
5. Assessing the overall fairness and balance of the agreement

Provide practical, actionable insights that help users understand what they're agreeing to.`;

    // Prepare API request payload for hashing
    const apiRequestPayload = {
      model: model,
      messages: [
        {
          role: "user" as const,
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    };

    // Log the raw request payload
    console.log(`📤 RAW REQUEST PAYLOAD TO OPENAI (WITH PII DETECTION):`);
    console.log(JSON.stringify(apiRequestPayload, null, 2));

    const apiStart = performance.now();
    const completion = await openai.chat.completions.create(apiRequestPayload);
    stageTimings.openaiCall = performance.now() - apiStart;

    // Log the raw response payload
    console.log(`📥 RAW RESPONSE PAYLOAD FROM OPENAI (WITH PII DETECTION):`);
    console.log(JSON.stringify(completion, null, 2));

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    console.log(`✅ Received response from OpenAI (${completion.usage?.total_tokens} tokens used)`);

    // Track usage if userId is provided
    if (userId && completion.usage) {
      try {
        const { subscriptionService } = await import("./subscription-service");
        await subscriptionService.trackUsage(
          userId,
          completion.usage.total_tokens,
          model
        );
        console.log(`📊 Usage tracked: +1 document, +${completion.usage.total_tokens} tokens for user ${userId}`);
      } catch (error) {
        console.error('❌ Failed to track usage:', error);
        // Don't throw - usage tracking failures shouldn't break document analysis
      }
    }

    // Parse the JSON response
    let analysisData: DocumentAnalysis;
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // Validate the structure
      if (!parsed.summary || !parsed.overallRisk || !parsed.keyFindings || !parsed.sections) {
        throw new Error("Invalid response structure from OpenAI");
      }
      
      analysisData = parsed as DocumentAnalysis;
    } catch (parseError) {
      console.error("Failed to parse OpenAI response as JSON:", parseError);
      console.log("Raw response:", response);
      
      // Fallback analysis
      analysisData = {
        summary: "Analysis completed, but there was an issue parsing the detailed results. The document has been processed.",
        overallRisk: "moderate" as const,
        keyFindings: {
          goodTerms: [],
          reviewNeeded: ["Unable to parse detailed analysis"],
          redFlags: []
        },
        sections: [{
          title: "General Analysis",
          riskLevel: "moderate" as const,
          summary: "Document analysis was completed but detailed parsing failed.",
          concerns: ["Response parsing error - manual review recommended"]
        }]
      };
    }

    // Restore PII in the analysis if redactions were made
    const restorationStart = performance.now();
    if (redactionInfo.hasRedactions && piiDetectionResult) {
      console.log(`🔄 Restoring PII in analysis response`);
      analysisData = restorePIIInAnalysis(analysisData, piiDetectionResult.redactionMap);
    }
    stageTimings.piiRestoration = performance.now() - restorationStart;

    // Create multi-layer payload fingerprint if enabled
    let payloadFingerprint = undefined;
    if (enablePayloadHashing) {
      const hashingStart = performance.now();
      console.log(`🔐 Creating multi-layer payload fingerprint for forensic traceability`);
      
      try {
        payloadFingerprint = await payloadHashingService.createPayloadFingerprint(
          content, // Original content
          analysisContent, // Redacted content sent to OpenAI
          apiRequestPayload, // Complete API request
          completion, // API response
          redactionInfo.hashedMatches || [], // PII hashes
          {
            documentId: title || 'untitled',
            sessionId: sessionId || 'unknown',
            detectionMetrics: piiDetectionResult.detectionMetrics,
            processingTimings: stageTimings
          }
        );
        
        stageTimings.payloadHashing = performance.now() - hashingStart;
        
        // Generate forensic report
        const forensicReport = payloadHashingService.createForensicReport(payloadFingerprint);
        console.log(`📊 Forensic Report ${forensicReport.reportId}:`);
        console.log(`   - Chain Integrity: ${(forensicReport.integrityAnalysis.chainIntegrity * 100).toFixed(1)}%`);
        console.log(`   - Forensic Utility: ${(forensicReport.integrityAnalysis.forensicUtility * 100).toFixed(1)}%`);
        console.log(`   - Overall Risk: ${forensicReport.securityAssessment.overallRisk}`);
        
      } catch (error) {
        console.error('❌ Failed to create payload fingerprint:', error);
        stageTimings.payloadHashing = performance.now() - hashingStart;
      }
    }

    const totalProcessingTime = performance.now() - processingStart;
    console.log(`⏱️ Complete processing time: ${totalProcessingTime.toFixed(2)}ms`);
    console.log(`   - PII Detection: ${stageTimings.piiDetection?.toFixed(2)}ms`);
    console.log(`   - OpenAI API: ${stageTimings.openaiCall?.toFixed(2)}ms`);
    console.log(`   - PII Restoration: ${stageTimings.piiRestoration?.toFixed(2)}ms`);
    if (stageTimings.payloadHashing) {
      console.log(`   - Payload Hashing: ${stageTimings.payloadHashing.toFixed(2)}ms`);
    }

    return {
      analysis: analysisData,
      redactionInfo,
      payloadFingerprint
    };

  } catch (error) {
    console.error("Error in OpenAI analysis:", error);
    
    // Return error analysis but still attempt PII detection for safety
    let fallbackRedactionInfo: PIIRedactionInfo;
    try {
      const fallbackDetection = await piiDetectionService.detectPIIWithHashing(content, {
        detectNames: piiDetection.detectNames ?? true,
        minConfidence: piiDetection.minConfidence ?? 0.7,
        customPatterns: piiDetection.customPatterns ?? [],
        enableHashing: true,
        sessionId: sessionId,
        documentId: title || 'fallback'
      });
      
      fallbackRedactionInfo = {
        hasRedactions: fallbackDetection.matches.length > 0,
        originalContent: content,
        redactedContent: fallbackDetection.redactedText,
        matches: fallbackDetection.matches,
        redactionMap: Object.fromEntries(fallbackDetection.redactionMap),
        detectionSettings: {
          detectNames: piiDetection.detectNames ?? true,
          minConfidence: piiDetection.minConfidence ?? 0.7,
          customPatterns: []
        }
      };
    } catch (piiError) {
      // Fallback to safe defaults if even PII detection fails
      fallbackRedactionInfo = {
        hasRedactions: false,
        originalContent: content,
        redactedContent: content,
        matches: [],
        redactionMap: {},
        detectionSettings: {
          detectNames: true,
          minConfidence: 0.7,
          customPatterns: []
        }
      };
    }

    const errorAnalysis: DocumentAnalysis = {
      summary: "An error occurred during document analysis. Please try again or contact support if the issue persists.",
      overallRisk: "moderate" as const,
      keyFindings: {
        goodTerms: [],
        reviewNeeded: ["Analysis failed - manual review required"],
        redFlags: ["Unable to complete automated analysis"]
      },
      sections: [{
        title: "Error",
        riskLevel: "moderate" as const,
        summary: "Document analysis could not be completed due to a technical error.",
        concerns: ["Technical analysis failure"]
      }]
    };

    return {
      analysis: errorAnalysis,
      redactionInfo: fallbackRedactionInfo
    };
  }
}

/**
 * Restore PII in the analysis response by replacing placeholders with original values
 */
function restorePIIInAnalysis(analysis: DocumentAnalysis, redactionMap: Map<string, string>): DocumentAnalysis {
  const restoreInString = (text: string): string => {
    return piiDetectionService.restoreRedactedContent(text, redactionMap);
  };

  const restoreInArray = (arr: string[]): string[] => {
    return arr.map(restoreInString);
  };

  return {
    summary: restoreInString(analysis.summary),
    overallRisk: analysis.overallRisk,
    keyFindings: {
      goodTerms: restoreInArray(analysis.keyFindings.goodTerms),
      reviewNeeded: restoreInArray(analysis.keyFindings.reviewNeeded),
      redFlags: restoreInArray(analysis.keyFindings.redFlags)
    },
    sections: analysis.sections.map(section => ({
      title: restoreInString(section.title),
      riskLevel: section.riskLevel,
      summary: restoreInString(section.summary),
      concerns: section.concerns ? restoreInArray(section.concerns) : undefined
    }))
  };
}

// Legacy function for backward compatibility
export async function analyzeDocument(
  content: string, 
  title: string, 
  ip?: string, 
  userAgent?: string, 
  sessionId?: string, 
  model: string = "gpt-4o", 
  userId?: string
): Promise<DocumentAnalysis> {
  const result = await analyzeDocumentWithPII(content, title, {
    ip,
    userAgent,
    sessionId,
    model,
    userId,
    piiDetection: { 
      enabled: true, // Always enabled for maximum privacy protection
      detectNames: true,
      minConfidence: 0.7
    }
  });
  
  return result.analysis;
}