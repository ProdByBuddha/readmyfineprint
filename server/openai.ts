import OpenAI from "openai";
import type { DocumentAnalysis } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export async function analyzeDocument(content: string, title: string): Promise<DocumentAnalysis> {
  try {
    const prompt = `You are a legal document analysis expert. Analyze the following legal document and provide a comprehensive analysis in JSON format.

Document Title: ${title}
Document Content: ${content}

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
- Converting legal jargon to plain English
- Identifying unfair, unusual, or concerning terms
- Highlighting automatic renewals, data usage, liability limitations
- Explaining payment terms, cancellation policies, and user rights
- Noting jurisdiction limitations or binding arbitration clauses

Provide practical, actionable insights that help everyday users understand what they're agreeing to.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a legal document analysis expert who specializes in making complex legal language understandable to everyday users. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new Error("No analysis content received from OpenAI");
    }

    const analysis: DocumentAnalysis = JSON.parse(analysisText);
    
    // Validate the response structure
    if (!analysis.summary || !analysis.overallRisk || !analysis.keyFindings || !analysis.sections) {
      throw new Error("Invalid analysis structure received from OpenAI");
    }

    return analysis;
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
