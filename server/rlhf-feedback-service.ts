/**
 * RLHF (Reinforcement Learning from Human Feedback) Service
 * Handles collection and analysis of user feedback on PII detection accuracy
 */

import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { hashIpAddress, hashUserAgent } from './argon2';
import type { 
  PiiDetectionFeedback,
  InsertPiiDetectionFeedback,
  PiiDetectionMetrics,
  InsertPiiDetectionMetrics,
  PiiDetectionPattern,
  PiiDetectionFeedbackInput
} from '../shared/schema';

export interface RlhfFeedbackSubmission {
  sessionId: string;
  detectionSessionId: string;
  detectedText: string;
  detectionType: string;
  detectionMethod: string;
  confidence: number;
  context?: string;
  userVote: 'correct' | 'incorrect' | 'partially_correct';
  feedbackConfidence?: number;
  feedbackReason?: string;
  documentType?: 'lease' | 'contract' | 'legal' | 'other';
  documentLength?: number;
  clientIp: string;
  userAgent: string;
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  accuracyRate: number;
  falsePositiveRate: number;
  detectionTypeBreakdown: Record<string, {
    total: number;
    correct: number;
    incorrect: number;
    partiallyCorrect: number;
    accuracyRate: number;
  }>;
  methodPerformance: Record<string, {
    total: number;
    accuracyRate: number;
    averageConfidence: number;
  }>;
  recentTrends: {
    period: string;
    accuracyRate: number;
    totalFeedback: number;
  }[];
}

export interface ImprovementSuggestion {
  patternType: string;
  description: string;
  currentAccuracy: number;
  suggestedChanges: string[];
  priority: 'high' | 'medium' | 'low';
}

class RlhfFeedbackService {
  
  /**
   * Submit user feedback on PII detection accuracy
   */
  async submitFeedback(submission: RlhfFeedbackSubmission): Promise<{ success: boolean; feedbackId?: string }> {
    try {
      const db = await initializeDatabase();
      
      // Create session pseudonym (consistent per session but anonymous)
      const sessionPseudonym = crypto
        .createHash('sha256')
        .update(`${submission.sessionId}:${submission.clientIp}:${submission.userAgent}`)
        .digest('hex')
        .substring(0, 16);
      
      // Hash IP and user agent for privacy
      const ipHash = await hashIpAddress(submission.clientIp);
      const userAgentHash = await hashUserAgent(submission.userAgent);
      
      // Insert feedback record
      const feedbackRecord: InsertPiiDetectionFeedback = {
        sessionPseudonym,
        detectionSessionId: submission.detectionSessionId,
        detectedText: submission.detectedText,
        detectionType: submission.detectionType,
        detectionMethod: submission.detectionMethod,
        confidence: submission.confidence.toString(),
        context: submission.context,
        userVote: submission.userVote,
        feedbackConfidence: submission.feedbackConfidence,
        feedbackReason: submission.feedbackReason,
        documentType: submission.documentType,
        documentLength: submission.documentLength,
        ipHash,
        userAgentHash
      };
      
      const result = await db.execute(sql`
        INSERT INTO pii_detection_feedback (
          session_pseudonym, detection_session_id, detected_text, detection_type, 
          detection_method, confidence, context, user_vote, feedback_confidence, 
          feedback_reason, document_type, document_length, ip_hash, user_agent_hash
        ) VALUES (
          ${feedbackRecord.sessionPseudonym}, ${feedbackRecord.detectionSessionId}, 
          ${feedbackRecord.detectedText}, ${feedbackRecord.detectionType}, 
          ${feedbackRecord.detectionMethod}, ${feedbackRecord.confidence}, 
          ${feedbackRecord.context}, ${feedbackRecord.userVote}, 
          ${feedbackRecord.feedbackConfidence}, ${feedbackRecord.feedbackReason}, 
          ${feedbackRecord.documentType}, ${feedbackRecord.documentLength}, 
          ${feedbackRecord.ipHash}, ${feedbackRecord.userAgentHash}
        ) RETURNING id
      `);
      
      const feedbackId = result[0]?.id;
      
      // Trigger async metrics update (don't wait for it)
      this.updateMetricsAsync(submission.detectionType, submission.detectionMethod);
      
      console.log(`📝 RLHF feedback submitted: ${submission.userVote} for ${submission.detectionType} (${submission.detectionMethod})`);
      
      return { success: true, feedbackId };
      
    } catch (error) {
      console.error('❌ Failed to submit RLHF feedback:', error);
      return { success: false };
    }
  }
  
  /**
   * Get feedback analytics for admin dashboard
   */
  async getFeedbackAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    detectionType?: string;
    detectionMethod?: string;
  } = {}): Promise<FeedbackAnalytics> {
    try {
      const db = await initializeDatabase();
      const { startDate, endDate, detectionType, detectionMethod } = options;
      
      // Build WHERE clause conditions
      const conditions: string[] = [];
      const params: any[] = [];
      
      if (startDate) {
        conditions.push(`created_at >= $${params.length + 1}`);
        params.push(startDate.toISOString());
      }
      if (endDate) {
        conditions.push(`created_at <= $${params.length + 1}`);
        params.push(endDate.toISOString());
      }
      if (detectionType) {
        conditions.push(`detection_type = $${params.length + 1}`);
        params.push(detectionType);
      }
      if (detectionMethod) {
        conditions.push(`detection_method = $${params.length + 1}`);
        params.push(detectionMethod);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Get overall metrics  
      const overallQuery = `
        SELECT 
          COUNT(*) as total_feedback,
          COUNT(CASE WHEN user_vote = 'correct' THEN 1 END) as correct_votes,
          COUNT(CASE WHEN user_vote = 'incorrect' THEN 1 END) as incorrect_votes,
          COUNT(CASE WHEN user_vote = 'partially_correct' THEN 1 END) as partially_correct_votes
        FROM pii_detection_feedback 
        ${whereClause}
      `;
      const overallResult = await db.execute(sql.raw(overallQuery));
      
      const overall = overallResult[0];
      const totalFeedback = parseInt(overall.total_feedback || '0');
      const correctVotes = parseInt(overall.correct_votes || '0');
      const incorrectVotes = parseInt(overall.incorrect_votes || '0');
      const partiallyCorrectVotes = parseInt(overall.partially_correct_votes || '0');
      
      const accuracyRate = totalFeedback > 0 
        ? (correctVotes + partiallyCorrectVotes * 0.5) / totalFeedback 
        : 0;
      const falsePositiveRate = totalFeedback > 0 ? incorrectVotes / totalFeedback : 0;
      
      // Get breakdown by detection type
      const typeBreakdownQuery = `
        SELECT 
          detection_type,
          COUNT(*) as total,
          COUNT(CASE WHEN user_vote = 'correct' THEN 1 END) as correct,
          COUNT(CASE WHEN user_vote = 'incorrect' THEN 1 END) as incorrect,
          COUNT(CASE WHEN user_vote = 'partially_correct' THEN 1 END) as partially_correct
        FROM pii_detection_feedback 
        ${whereClause}
        GROUP BY detection_type
      `;
      const typeBreakdownResult = await db.execute(sql.raw(typeBreakdownQuery));
      
      const detectionTypeBreakdown: FeedbackAnalytics['detectionTypeBreakdown'] = {};
      for (const row of typeBreakdownResult) {
        const total = parseInt((row as any).total || '0');
        const correct = parseInt((row as any).correct || '0');
        const incorrect = parseInt((row as any).incorrect || '0');
        const partiallyCorrect = parseInt((row as any).partially_correct || '0');
        
        detectionTypeBreakdown[(row as any).detection_type] = {
          total,
          correct,
          incorrect,
          partiallyCorrect,
          accuracyRate: total > 0 ? (correct + partiallyCorrect * 0.5) / total : 0
        };
      }
      
      // Get method performance
      const methodPerformanceQuery = `
        SELECT 
          detection_method,
          COUNT(*) as total,
          COUNT(CASE WHEN user_vote = 'correct' THEN 1 END) as correct,
          COUNT(CASE WHEN user_vote = 'partially_correct' THEN 1 END) as partially_correct,
          AVG(CAST(confidence AS DECIMAL)) as avg_confidence
        FROM pii_detection_feedback 
        ${whereClause}
        GROUP BY detection_method
      `;
      const methodPerformanceResult = await db.execute(sql.raw(methodPerformanceQuery));
      
      const methodPerformance: FeedbackAnalytics['methodPerformance'] = {};
      for (const row of methodPerformanceResult) {
        const total = parseInt((row as any).total || '0');
        const correct = parseInt((row as any).correct || '0');
        const partiallyCorrect = parseInt((row as any).partially_correct || '0');
        
        methodPerformance[(row as any).detection_method] = {
          total,
          accuracyRate: total > 0 ? (correct + partiallyCorrect * 0.5) / total : 0,
          averageConfidence: parseFloat((row as any).avg_confidence || '0')
        };
      }
      
      // Get recent trends (last 7 days)
      const trendsQuery = `
        SELECT 
          DATE(created_at) as period,
          COUNT(*) as total_feedback,
          COUNT(CASE WHEN user_vote = 'correct' THEN 1 END) as correct,
          COUNT(CASE WHEN user_vote = 'partially_correct' THEN 1 END) as partially_correct
        FROM pii_detection_feedback 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY period DESC
        LIMIT 7
      `;
      const trendsResult = await db.execute(sql.raw(trendsQuery));
      
      const recentTrends = trendsResult.map((row: any) => {
        const totalFeedback = parseInt(row.total_feedback || '0');
        const correct = parseInt(row.correct || '0');
        const partiallyCorrect = parseInt(row.partially_correct || '0');
        
        return {
          period: row.period,
          totalFeedback,
          accuracyRate: totalFeedback > 0 ? (correct + partiallyCorrect * 0.5) / totalFeedback : 0
        };
      });
      
      return {
        totalFeedback,
        accuracyRate,
        falsePositiveRate,
        detectionTypeBreakdown,
        methodPerformance,
        recentTrends
      };
      
    } catch (error) {
      console.error('❌ Failed to get feedback analytics:', error);
      throw error;
    }
  }
  
  /**
   * Generate improvement suggestions based on feedback data
   */
  async generateImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    try {
      const analytics = await this.getFeedbackAnalytics();
      const suggestions: ImprovementSuggestion[] = [];
      
      // Analyze detection types with low accuracy
      for (const [detectionType, breakdown] of Object.entries(analytics.detectionTypeBreakdown)) {
        if (breakdown.total >= 10 && breakdown.accuracyRate < 0.7) {
          suggestions.push({
            patternType: detectionType,
            description: `${detectionType} detection has ${(breakdown.accuracyRate * 100).toFixed(1)}% accuracy`,
            currentAccuracy: breakdown.accuracyRate,
            suggestedChanges: [
              'Review and refine regex patterns',
              'Improve contextual validation rules',
              'Add more training examples',
              'Adjust confidence thresholds'
            ],
            priority: breakdown.accuracyRate < 0.5 ? 'high' : 'medium'
          });
        }
      }
      
      // Analyze methods with poor performance
      for (const [method, performance] of Object.entries(analytics.methodPerformance)) {
        if (performance.total >= 10 && performance.accuracyRate < 0.6) {
          suggestions.push({
            patternType: `${method}_method`,
            description: `${method} detection method has ${(performance.accuracyRate * 100).toFixed(1)}% accuracy`,
            currentAccuracy: performance.accuracyRate,
            suggestedChanges: [
              `Optimize ${method} algorithm parameters`,
              'Combine with other detection methods',
              'Add method-specific validation rules'
            ],
            priority: performance.accuracyRate < 0.4 ? 'high' : 'medium'
          });
        }
      }
      
      return suggestions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
    } catch (error) {
      console.error('❌ Failed to generate improvement suggestions:', error);
      return [];
    }
  }
  
  /**
   * Update aggregated metrics for a detection type/method (async)
   */
  private async updateMetricsAsync(detectionType: string, detectionMethod: string): Promise<void> {
    try {
      const db = await initializeDatabase();
      
      // Calculate daily metrics for today
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      
      const metricsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_feedback,
          COUNT(CASE WHEN user_vote = 'correct' THEN 1 END) as correct_votes,
          COUNT(CASE WHEN user_vote = 'incorrect' THEN 1 END) as incorrect_votes,
          COUNT(CASE WHEN user_vote = 'partially_correct' THEN 1 END) as partially_correct_votes,
          AVG(CAST(confidence AS DECIMAL)) as avg_confidence
        FROM pii_detection_feedback 
        WHERE detection_type = ${detectionType} 
          AND detection_method = ${detectionMethod}
          AND created_at >= ${startOfDay.toISOString()}
          AND created_at < ${endOfDay.toISOString()}
      `);
      
      if (metricsResult.length === 0) return;
      
      const metrics = metricsResult[0];
      const totalFeedback = parseInt(metrics.total_feedback || '0');
      
      if (totalFeedback === 0) return;
      
      const correctVotes = parseInt(metrics.correct_votes || '0');
      const incorrectVotes = parseInt(metrics.incorrect_votes || '0');
      const partiallyCorrectVotes = parseInt(metrics.partially_correct_votes || '0');
      const avgConfidence = parseFloat(metrics.avg_confidence || '0');
      
      const accuracyRate = (correctVotes + partiallyCorrectVotes * 0.5) / totalFeedback;
      const falsePositiveRate = incorrectVotes / totalFeedback;
      
      // Upsert daily metrics
      await db.execute(sql`
        INSERT INTO pii_detection_metrics (
          period, period_start, period_end, detection_type, detection_method,
          total_feedback, correct_votes, incorrect_votes, partially_correct_votes,
          accuracy_rate, false_positive_rate, confidence_average
        ) VALUES (
          'daily', ${startOfDay.toISOString()}, ${endOfDay.toISOString()}, 
          ${detectionType}, ${detectionMethod}, ${totalFeedback}, 
          ${correctVotes}, ${incorrectVotes}, ${partiallyCorrectVotes},
          ${accuracyRate.toString()}, ${falsePositiveRate.toString()}, ${avgConfidence.toString()}
        )
        ON CONFLICT (period, period_start, detection_type, detection_method) 
        DO UPDATE SET
          total_feedback = EXCLUDED.total_feedback,
          correct_votes = EXCLUDED.correct_votes,
          incorrect_votes = EXCLUDED.incorrect_votes,
          partially_correct_votes = EXCLUDED.partially_correct_votes,
          accuracy_rate = EXCLUDED.accuracy_rate,
          false_positive_rate = EXCLUDED.false_positive_rate,
          confidence_average = EXCLUDED.confidence_average,
          last_updated = NOW()
      `);
      
    } catch (error) {
      console.error('❌ Failed to update RLHF metrics:', error);
    }
  }
  
  /**
   * Get common false positive patterns for a detection type
   */
  async getCommonFalsePositives(detectionType: string, limit: number = 10): Promise<Array<{
    pattern: string;
    count: number;
    examples: string[];
  }>> {
    try {
      const db = await initializeDatabase();
      
      const result = await db.execute(sql`
        SELECT 
          detected_text,
          COUNT(*) as count,
          array_agg(DISTINCT SUBSTRING(context, 1, 100)) as context_examples
        FROM pii_detection_feedback 
        WHERE detection_type = ${detectionType} 
          AND user_vote = 'incorrect'
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY detected_text
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT ${limit}
      `);
      
      return result.map((row: any) => ({
        pattern: row.detected_text,
        count: parseInt(row.count || '0'),
        examples: row.context_examples ? row.context_examples.slice(0, 3) : []
      }));
      
    } catch (error) {
      console.error('❌ Failed to get false positive patterns:', error);
      return [];
    }
  }
}

export const rlhfFeedbackService = new RlhfFeedbackService();