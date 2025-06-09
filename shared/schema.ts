import { z } from "zod";

// Remove database table definitions since we're going session-based
// Keep only the TypeScript interfaces and schemas we need

export const insertDocumentSchema = z.object({
  title: z.string().optional(),
  content: z.string(),
  fileType: z.string().optional(),
  analysis: z.any().optional(),
});

export const consentSchema = z.object({
  disclaimerAccepted: z.boolean(),
  acceptedAt: z.date(),
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Consent = z.infer<typeof consentSchema>;

export interface Document {
  id: number;
  title: string;
  content: string;
  fileType?: string | null;
  analysis?: DocumentAnalysis | null;
  createdAt: Date;
}

export interface DocumentAnalysis {
  summary: string;
  overallRisk: 'low' | 'moderate' | 'high';
  keyFindings: {
    goodTerms: string[];
    reviewNeeded: string[];
    redFlags: string[];
  };
  sections: Array<{
    title: string;
    riskLevel: 'low' | 'moderate' | 'high';
    summary: string;
    concerns?: string[];
  }>;
}
