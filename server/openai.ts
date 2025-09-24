import OpenAI from "openai";
import type { DocumentAnalysis } from "@shared/schema";
import { securityLogger } from "./security-logger";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeDocument(
  content: string,
  title: string,
  ip?: string,
  userAgent?: string,
  sessionId?: string,
  model: string = "gpt-4o",
  userId?: string,
  extras: { includeAdvocacy?: boolean; subscriptionTierId?: string } = {}
): Promise<DocumentAnalysis> {
  try {
    const tierId = extras.subscriptionTierId || 'free';
    const shouldIncludeAdvocacy = (extras.includeAdvocacy ?? false) || tierId !== 'free';

    // Log OpenAI API usage for audit purposes
    if (ip && userAgent && sessionId) {
      securityLogger.logOpenAIUsage(ip, userAgent, sessionId, title);
    }

    // Debug what we're sending to OpenAI
    console.log(`🤖 Sending to OpenAI (${model}):`);
    console.log(`   - Document: "${title}"`);
    console.log(`   - Content length: ${content.length} characters`);
    console.log(`   - Subscription tier: ${tierId} (advocacy ${shouldIncludeAdvocacy ? 'enabled' : 'disabled'})`);
    console.log(`   - Content preview (first 500 chars): "${content.substring(0, 500).replace(/\n/g, '\\n')}"`);
    
    // Check if content seems to be garbled or has extraction issues
    const readableRatio = (content.match(/[a-zA-Z\s]/g) || []).length / content.length;
    console.log(`   - Readable character ratio: ${(readableRatio * 100).toFixed(1)}%`);
    
    if (readableRatio < 0.7) {
      console.log(`⚠️ WARNING: Content appears to have low readability (${(readableRatio * 100).toFixed(1)}% readable chars)`);
    }

    const responseStructureLines = [
      "\"summary\": \"A brief overall summary of the document in plain English\"",
      "\"overallRisk\": \"low|moderate|high\"",
      "\"keyFindings\": {\n    \"goodTerms\": [\"List of positive or fair terms found\"],\n    \"reviewNeeded\": [\"Terms that require attention but aren't necessarily bad\"],\n    \"redFlags\": [\"Concerning clauses or terms that pose significant risk\"]\n  }",
      "\"sections\": [\n    {\n      \"title\": \"Section name (e.g., Payment Terms, Privacy Policy, etc.)\",\n      \"riskLevel\": \"low|moderate|high\",\n      \"summary\": \"Plain English explanation of this section\",\n      \"concerns\": [\"List of specific concerns for this section if any\"]\n    }\n  ]"
    ];

    if (shouldIncludeAdvocacy) {
      responseStructureLines.push("\"userAdvocacy\": {\n    \"negotiationStrategies\": [\"Step-by-step negotiation moves that protect the user's interests\"],\n    \"counterOffers\": [\"Specific counter-proposals or edits to request for greater fairness\"],\n    \"fairnessReminders\": [\"Rights, oversight, or integrity principles the user can cite\"],\n    \"leverageOpportunities\": [\"Moments where the user can request concessions or more transparency\"]\n  }");
    }

    const responseStructure = `{
  ${responseStructureLines.join(',\n  ')}
}`;

    const focusTopics = [
      'Converting legal jargon to plain English',
      'Identifying unfair, unusual, or concerning terms',
      'Highlighting automatic renewals, data usage, and liability limitations',
      'Explaining payment terms, cancellation policies, and user rights',
      'Noting jurisdiction limitations or binding arbitration clauses'
    ];

    if (shouldIncludeAdvocacy) {
      focusTopics.push('Equipping the user with negotiation strategies, counteroffers, and fairness advocacy they can confidently raise');
    }

    const focusGuidance = focusTopics.map(topic => `- ${topic}`).join('\n');

    const prompt = `You are a legal document analysis expert. Analyze the following legal document and provide a comprehensive analysis in JSON format.

Document Title: ${title}
Document Content: ${content}

Please analyze this document and provide a JSON response with the following structure:
${responseStructure}

Focus on:
${focusGuidance}

Provide practical, actionable insights that help everyday users understand what they're agreeing to.${shouldIncludeAdvocacy ? ' When offering advocacy guidance, champion the user\'s fairness, integrity, and leverage with respectful, concrete recommendations.' : ''}`;

    const requestPayload = {
      model: model,
      messages: [
        {
          role: "system" as const,
          content: "You are a legal document analysis expert who specializes in making complex legal language understandable to everyday users. Always respond with valid JSON."
        },
        {
          role: "user" as const,
          content: prompt
        }
      ],
      response_format: { type: "json_object" as const },
      temperature: 0.3,
    };

    // Log the raw request payload
    console.log(`📤 RAW REQUEST PAYLOAD TO OPENAI:`);
    console.log(JSON.stringify(requestPayload, null, 2));

    const response = await openai.chat.completions.create(requestPayload);

    // Log the raw response payload
    console.log(`📥 RAW RESPONSE PAYLOAD FROM OPENAI:`);
    console.log(JSON.stringify(response, null, 2));

    // Debug the response
    console.log(`🤖 OpenAI Response received:`);
    console.log(`   - Model used: ${response.model}`);
    console.log(`   - Tokens used: ${response.usage?.total_tokens} (input: ${response.usage?.prompt_tokens}, output: ${response.usage?.completion_tokens})`);
    console.log(`   - Response length: ${response.choices[0].message.content?.length || 0} characters`);

    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new Error("No analysis content received from OpenAI");
    }

    const analysis: DocumentAnalysis = JSON.parse(analysisText);

    // Debug the parsed analysis
    console.log(`📊 Analysis Results:`);
    console.log(`   - Overall Risk: ${analysis.overallRisk}`);
    console.log(`   - Summary length: ${analysis.summary?.length || 0} chars`);
    console.log(`   - Key findings: ${analysis.keyFindings ? Object.keys(analysis.keyFindings).length : 0} categories`);
    console.log(`   - Sections analyzed: ${analysis.sections?.length || 0}`);
    console.log(`   - Summary preview: "${analysis.summary?.substring(0, 200) || 'No summary'}"`);

    // Validate the response structure
    if (!analysis.summary || !analysis.overallRisk || !analysis.keyFindings || !analysis.sections) {
      console.log(`❌ Invalid analysis structure:`, {
        hasSummary: !!analysis.summary,
        hasOverallRisk: !!analysis.overallRisk,
        hasKeyFindings: !!analysis.keyFindings,
        hasSections: !!analysis.sections
      });
      throw new Error("Invalid analysis structure received from OpenAI");
    }

    const normalizedAnalysis: DocumentAnalysis = {
      ...analysis,
      userAdvocacy: shouldIncludeAdvocacy
        ? normalizeUserAdvocacy(analysis.userAdvocacy)
        : undefined
    };

    if (shouldIncludeAdvocacy && normalizedAnalysis.userAdvocacy) {
      const advocacy = normalizedAnalysis.userAdvocacy;
      console.log(`   - Advocacy guidance: ${advocacy.negotiationStrategies.length + advocacy.counterOffers.length + advocacy.fairnessReminders.length + advocacy.leverageOpportunities.length} items`);
    }

    // Track usage if userId is provided
    if (userId && response.usage) {
      const { subscriptionService } = await import("./subscription-service");
      await subscriptionService.trackUsage(
        userId,
        response.usage.total_tokens,
        model
      );
    }

    console.log(`✅ Document analysis completed successfully`);
    return normalizedAnalysis;
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function normalizeUserAdvocacy(advocacy?: DocumentAnalysis['userAdvocacy']): DocumentAnalysis['userAdvocacy'] {
  return {
    negotiationStrategies: advocacy?.negotiationStrategies?.filter(Boolean) ?? [],
    counterOffers: advocacy?.counterOffers?.filter(Boolean) ?? [],
    fairnessReminders: advocacy?.fairnessReminders?.filter(Boolean) ?? [],
    leverageOpportunities: advocacy?.leverageOpportunities?.filter(Boolean) ?? []
  };
}
