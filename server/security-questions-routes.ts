import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { requireUserAuth } from './auth';
import { securityQuestionsService } from './security-questions-service';
import { securityQuestionsSetupSchema, SECURITY_QUESTIONS } from '@shared/schema';
import { securityLogger, getClientInfo, SecurityEventType, SecuritySeverity } from './security-logger';

export function registerSecurityQuestionsRoutes(app: Express) {

/**
 * GET /api/security-questions/available
 * Get available security questions for setup
 */
app.get('/api/security-questions/available', async (req: Request, res: Response) => {
  try {
    const questions = securityQuestionsService.getAvailableQuestions();
    res.json({ questions });
  } catch (error) {
    console.error('Error fetching available security questions:', error);
    res.status(500).json({ error: 'Failed to fetch security questions' });
  }
});

/**
 * GET /api/security-questions/user
 * Get user's security questions (without answers)
 */
app.get('/api/security-questions/user', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Check user's subscription tier to determine if security questions are required
    let requiresSecurityQuestions = false;
    let userTier = 'free';
    
    try {
      const { subscriptionService } = await import('./subscription-service');
      const subscriptionData = await subscriptionService.getUserSubscriptionWithUsage(userId);
      
      if (subscriptionData && subscriptionData.tier.id !== 'free') {
        requiresSecurityQuestions = true;
        userTier = subscriptionData.tier.id;
      }
    } catch (tierError) {
      console.log('Could not determine user tier, assuming free tier');
    }
    
    const questions = await securityQuestionsService.getUserSecurityQuestions(userId);
    const hasQuestions = await securityQuestionsService.hasSecurityQuestions(userId);
    
    res.json({ 
      questions,
      hasSecurityQuestions: hasQuestions,
      count: questions.length,
      requiresSecurityQuestions,
      userTier
    });
  } catch (error) {
    console.error('Error fetching user security questions:', error);
    res.status(500).json({ error: 'Failed to fetch security questions' });
  }
});

/**
 * POST /api/security-questions/setup
 * Set up security questions for a user
 */
app.post('/api/security-questions/setup', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { ip, userAgent } = getClientInfo(req);

    // Validate request body
    const validation = securityQuestionsSetupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const { questions } = validation.data;

    // Validate question IDs
    const validQuestionIds = SECURITY_QUESTIONS.map(q => q.id);
    for (const q of questions) {
      if (!validQuestionIds.includes(q.questionId)) {
        return res.status(400).json({
          error: `Invalid question ID: ${q.questionId}`
        });
      }
    }

    // Check for duplicate question IDs
    const questionIds = questions.map(q => q.questionId);
    const uniqueIds = new Set(questionIds);
    if (questionIds.length !== uniqueIds.size) {
      return res.status(400).json({
        error: 'Duplicate security questions are not allowed'
      });
    }

    // Save security questions
    await securityQuestionsService.saveSecurityQuestions(userId, { questions });

    // Log security event
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.MEDIUM,
      message: `User ${userId} set up ${questions.length} security questions`,
      ip,
      userAgent,
      endpoint: req.path,
      details: { userId, questionCount: questions.length }
    });

    res.json({ 
      success: true, 
      message: 'Security questions saved successfully',
      questionCount: questions.length
    });
  } catch (error) {
    const { ip, userAgent } = getClientInfo(req);
    console.error('Error setting up security questions:', error);
    securityLogger.logSecurityError(
      ip,
      userAgent,
      'Failed to set up security questions',
      req.path
    );
    res.status(500).json({ error: 'Failed to save security questions' });
  }
});

/**
 * PUT /api/security-questions/update
 * Update existing security questions for a user
 */
app.put('/api/security-questions/update', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { ip, userAgent } = getClientInfo(req);

    // Check if user has existing security questions
    const hasExisting = await securityQuestionsService.hasSecurityQuestions(userId);
    if (!hasExisting) {
      return res.status(400).json({
        error: 'No security questions found. Use /setup endpoint instead.'
      });
    }

    // Validate request body
    const validation = securityQuestionsSetupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues
      });
    }

    const { questions } = validation.data;

    // Update security questions (this replaces existing ones)
    await securityQuestionsService.updateSecurityQuestions(userId, { questions });

    // Log security event
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.MEDIUM,
      message: `User ${userId} updated their security questions`,
      ip,
      userAgent,
      endpoint: req.path,
      details: { userId, questionCount: questions.length }
    });

    res.json({ 
      success: true, 
      message: 'Security questions updated successfully',
      questionCount: questions.length
    });
  } catch (error) {
    const { ip, userAgent } = getClientInfo(req);
    console.error('Error updating security questions:', error);
    securityLogger.logSecurityError(
      ip,
      userAgent,
      'Failed to update security questions',
      req.path
    );
    res.status(500).json({ error: 'Failed to update security questions' });
  }
});

/**
 * POST /api/security-questions/verify
 * Verify security question answers
 */
app.post('/api/security-questions/verify', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { ip, userAgent } = getClientInfo(req);

    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Security question answers are required' });
    }

    // Verify the answers
    const isValid = await securityQuestionsService.verifySecurityQuestions(userId, answers);

    if (isValid) {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.MEDIUM,
        message: `User ${userId} successfully verified security questions`,
        ip,
        userAgent,
        endpoint: req.path,
        details: { userId }
      });
      res.json({ verified: true, message: 'Security questions verified successfully' });
    } else {
      securityLogger.logSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION,
        severity: SecuritySeverity.HIGH,
        message: `User ${userId} failed security questions verification`,
        ip,
        userAgent,
        endpoint: req.path,
        details: { userId }
      });
      res.status(401).json({ verified: false, error: 'Invalid security question answers' });
    }
  } catch (error) {
    const { ip, userAgent } = getClientInfo(req);
    console.error('Error verifying security questions:', error);
    securityLogger.logSecurityError(
      ip,
      userAgent,
      'Security questions verification error',
      req.path
    );
    res.status(500).json({ error: 'Failed to verify security questions' });
  }
});

/**
 * DELETE /api/security-questions
 * Delete all security questions for a user
 */
app.delete('/api/security-questions', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { ip, userAgent } = getClientInfo(req);

    await securityQuestionsService.deleteSecurityQuestions(userId);

    // Log security event
    securityLogger.logSecurityEvent({
      eventType: SecurityEventType.AUTHENTICATION,
      severity: SecuritySeverity.HIGH,
      message: `User ${userId} deleted their security questions`,
      ip,
      userAgent,
      endpoint: req.path,
      details: { userId }
    });

    res.json({ 
      success: true, 
      message: 'Security questions deleted successfully' 
    });
  } catch (error) {
    const { ip, userAgent } = getClientInfo(req);
    console.error('Error deleting security questions:', error);
    securityLogger.logSecurityError(
      ip,
      userAgent,
      'Failed to delete security questions',
      req.path
    );
    res.status(500).json({ error: 'Failed to delete security questions' });
  }
});

}