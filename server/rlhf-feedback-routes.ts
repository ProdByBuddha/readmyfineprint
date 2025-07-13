/**
 * RLHF Feedback API Routes
 * Handles submission and retrieval of PII detection feedback for model improvement
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { rlhfFeedbackService } from './rlhf-feedback-service';
import { getClientInfo } from './security-logger';
import { piiDetectionFeedbackSchema } from '../shared/schema';

// Extended feedback submission schema with server-side fields
const feedbackSubmissionSchema = piiDetectionFeedbackSchema.extend({
  sessionId: z.string().min(1, 'Session ID is required'),
  documentLength: z.number().positive().optional(),
});

// Analytics query schema
const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  detectionType: z.string().optional(),
  detectionMethod: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

/**
 * Submit feedback on PII detection accuracy
 * POST /api/rlhf/feedback
 * Requires Professional tier or higher
 */
export async function submitPiiDetectionFeedback(req: Request, res: Response) {
  try {
    console.log('📝 Received RLHF feedback submission');
    
    // Check if user has Professional tier access for PII feedback
    const userId = (req as any).user?.id;
    if (userId) {
      const { validateProfessionalAccess } = await import('./tier-validation.js');
      const tierValidation = await validateProfessionalAccess(userId);
      
      if (!tierValidation.hasAccess) {
        console.log(`🚫 PII feedback blocked for user ${userId}: ${tierValidation.message}`);
        return res.status(403).json({
          error: "Professional tier required",
          message: "PII detection feedback is available for Professional tier and above",
          currentTier: tierValidation.currentTier,
          requiredTier: tierValidation.requiredTier,
          upgradeUrl: "/subscription"
        });
      }
    }
    
    // Validate request body
    const validationResult = feedbackSubmissionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.warn('❌ Invalid RLHF feedback data:', validationResult.error.issues);
      return res.status(400).json({
        error: 'Invalid feedback data',
        details: validationResult.error.issues
      });
    }
    
    const feedbackData = validationResult.data;
    const { ip, userAgent } = getClientInfo(req);
    
    // Rate limiting: Check if this session has submitted too much feedback recently
    const sessionId = feedbackData.sessionId;
    const recentSubmissionKey = `rlhf_feedback:${sessionId}`;
    
    // Submit feedback through service
    const result = await rlhfFeedbackService.submitFeedback({
      sessionId: feedbackData.sessionId,
      detectionSessionId: feedbackData.detectionSessionId,
      detectedText: feedbackData.detectedText,
      detectionType: feedbackData.detectionType,
      detectionMethod: feedbackData.detectionMethod,
      confidence: feedbackData.confidence,
      context: feedbackData.context,
      userVote: feedbackData.userVote,
      feedbackConfidence: feedbackData.feedbackConfidence,
      feedbackReason: feedbackData.feedbackReason,
      documentType: feedbackData.documentType,
      documentLength: feedbackData.documentLength,
      clientIp: ip,
      userAgent: userAgent
    });
    
    if (!result.success) {
      console.error('❌ Failed to submit RLHF feedback');
      return res.status(500).json({
        error: 'Failed to submit feedback',
        message: 'Please try again later'
      });
    }
    
    console.log(`✅ RLHF feedback submitted successfully: ${feedbackData.userVote} for ${feedbackData.detectionType}`);
    
    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId: result.feedbackId
    });
    
  } catch (error) {
    console.error('❌ Error in submitPiiDetectionFeedback:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process feedback submission'
    });
  }
}

/**
 * Get feedback analytics (admin only)
 * GET /api/rlhf/analytics
 */
export async function getFeedbackAnalytics(req: Request, res: Response) {
  try {
    console.log('📊 Fetching RLHF analytics');
    
    // Validate query parameters
    const validationResult = analyticsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validationResult.error.issues
      });
    }
    
    const params = validationResult.data;
    
    // Convert date strings to Date objects
    const options: any = {};
    if (params.startDate) options.startDate = new Date(params.startDate);
    if (params.endDate) options.endDate = new Date(params.endDate);
    if (params.detectionType) options.detectionType = params.detectionType;
    if (params.detectionMethod) options.detectionMethod = params.detectionMethod;
    
    const analytics = await rlhfFeedbackService.getFeedbackAnalytics(options);
    
    console.log(`✅ Retrieved RLHF analytics: ${analytics.totalFeedback} total feedback items`);
    
    res.json({
      success: true,
      data: analytics,
      meta: {
        query: params,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getFeedbackAnalytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve analytics'
    });
  }
}

/**
 * Get improvement suggestions based on feedback (admin only)
 * GET /api/rlhf/improvements
 */
export async function getImprovementSuggestions(req: Request, res: Response) {
  try {
    console.log('🔧 Generating improvement suggestions from RLHF data');
    
    const suggestions = await rlhfFeedbackService.generateImprovementSuggestions();
    
    console.log(`✅ Generated ${suggestions.length} improvement suggestions`);
    
    res.json({
      success: true,
      data: suggestions,
      meta: {
        count: suggestions.length,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getImprovementSuggestions:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate improvement suggestions'
    });
  }
}

/**
 * Get common false positive patterns (admin only)
 * GET /api/rlhf/false-positives/:detectionType
 */
export async function getCommonFalsePositives(req: Request, res: Response) {
  try {
    const { detectionType } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    console.log(`🔍 Fetching false positive patterns for ${detectionType}`);
    
    // Validate detection type
    const validDetectionTypes = ['ssn', 'email', 'phone', 'creditCard', 'address', 'name', 'dob', 'custom', 'attorney_client'];
    if (!validDetectionTypes.includes(detectionType)) {
      return res.status(400).json({
        error: 'Invalid detection type',
        validTypes: validDetectionTypes
      });
    }
    
    const patterns = await rlhfFeedbackService.getCommonFalsePositives(detectionType, limit);
    
    console.log(`✅ Found ${patterns.length} false positive patterns for ${detectionType}`);
    
    res.json({
      success: true,
      data: patterns,
      meta: {
        detectionType,
        limit,
        count: patterns.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getCommonFalsePositives:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve false positive patterns'
    });
  }
}

/**
 * Get feedback summary for public display
 * GET /api/rlhf/summary
 */
export async function getFeedbackSummary(req: Request, res: Response) {
  try {
    console.log('📈 Fetching public RLHF feedback summary');
    
    const analytics = await rlhfFeedbackService.getFeedbackAnalytics({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    });
    
    // Return only aggregated, non-sensitive data
    const publicSummary = {
      totalFeedback: analytics.totalFeedback,
      overallAccuracy: Math.round(analytics.accuracyRate * 100),
      totalDetectionTypes: Object.keys(analytics.detectionTypeBreakdown).length,
      recentTrends: analytics.recentTrends.map(trend => ({
        date: trend.period,
        accuracy: Math.round(trend.accuracyRate * 100),
        feedbackCount: trend.totalFeedback
      }))
    };
    
    res.json({
      success: true,
      data: publicSummary,
      meta: {
        period: 'last30days',
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getFeedbackSummary:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve feedback summary'
    });
  }
}