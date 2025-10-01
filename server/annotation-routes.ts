/**
 * Annotation API Routes
 * Exposes endpoints for managing annotation threads and comments within workspaces.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireUserAuth } from './auth';
import { isFeatureEnabled } from './feature-flags';
import * as annotationService from './annotation-service';

const router = Router();

const requireAnnotationsFeature = (req: Request, res: Response, next: Function) => {
  if (!isFeatureEnabled('workspaces') || !isFeatureEnabled('annotations')) {
    return res.status(503).json({
      error: 'Annotations feature is not yet available',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }
  next();
};

const createThreadSchema = z.object({
  documentId: z.number().int().positive(),
  anchor: z.string().min(1),
  initialComment: z.string().min(1).max(10000).optional(),
});

const listThreadsQuerySchema = z.object({
  documentId: z.coerce.number().int().positive().optional(),
  includeResolved: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

const commentBodySchema = z.object({
  body: z.string().min(1).max(10000),
});

const resolveThreadSchema = z.object({
  resolved: z.boolean(),
});

function handleError(res: Response, error: unknown) {
  if (error instanceof annotationService.AnnotationError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
    });
  }

  console.error('Annotation route error:', error);
  return res.status(500).json({ error: 'Unexpected annotation error' });
}

router.post(
  '/workspaces/:workspaceId/annotations/threads',
  requireUserAuth,
  requireAnnotationsFeature,
  async (req: Request, res: Response) => {
    const parseResult = createThreadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues,
      });
    }

    try {
      const result = await annotationService.createAnnotationThread({
        workspaceId: req.params.workspaceId,
        userId: req.user!.id,
        ...parseResult.data,
      });

      return res.status(201).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/workspaces/:workspaceId/annotations/threads',
  requireUserAuth,
  requireAnnotationsFeature,
  async (req: Request, res: Response) => {
    const parseResult = listThreadsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
    }

    try {
      const threads = await annotationService.listAnnotationThreads({
        workspaceId: req.params.workspaceId,
        userId: req.user!.id,
        ...parseResult.data,
      });

      return res.json(threads);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.get(
  '/workspaces/:workspaceId/annotations/threads/:threadId',
  requireUserAuth,
  requireAnnotationsFeature,
  async (req: Request, res: Response) => {
    try {
      const thread = await annotationService.getAnnotationThread({
        workspaceId: req.params.workspaceId,
        threadId: req.params.threadId,
        userId: req.user!.id,
      });

      return res.json(thread);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.post(
  '/workspaces/:workspaceId/annotations/threads/:threadId/comments',
  requireUserAuth,
  requireAnnotationsFeature,
  async (req: Request, res: Response) => {
    const parseResult = commentBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues,
      });
    }

    try {
      const comment = await annotationService.addAnnotationComment({
        workspaceId: req.params.workspaceId,
        threadId: req.params.threadId,
        userId: req.user!.id,
        body: parseResult.data.body,
      });

      return res.status(201).json(comment);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.patch(
  '/workspaces/:workspaceId/annotations/threads/:threadId/comments/:commentId',
  requireUserAuth,
  requireAnnotationsFeature,
  async (req: Request, res: Response) => {
    const parseResult = commentBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues,
      });
    }

    try {
      const comment = await annotationService.updateAnnotationComment({
        workspaceId: req.params.workspaceId,
        threadId: req.params.threadId,
        commentId: req.params.commentId,
        userId: req.user!.id,
        body: parseResult.data.body,
      });

      return res.json(comment);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.delete(
  '/workspaces/:workspaceId/annotations/threads/:threadId/comments/:commentId',
  requireUserAuth,
  requireAnnotationsFeature,
  async (req: Request, res: Response) => {
    try {
      const result = await annotationService.deleteAnnotationComment({
        workspaceId: req.params.workspaceId,
        threadId: req.params.threadId,
        commentId: req.params.commentId,
        userId: req.user!.id,
      });

      return res.json(result);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

router.patch(
  '/workspaces/:workspaceId/annotations/threads/:threadId/resolve',
  requireUserAuth,
  requireAnnotationsFeature,
  async (req: Request, res: Response) => {
    const parseResult = resolveThreadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parseResult.error.issues,
      });
    }

    try {
      const thread = await annotationService.setThreadResolution({
        workspaceId: req.params.workspaceId,
        threadId: req.params.threadId,
        userId: req.user!.id,
        resolved: parseResult.data.resolved,
      });

      return res.json(thread);
    } catch (error) {
      return handleError(res, error);
    }
  }
);

export default router;
