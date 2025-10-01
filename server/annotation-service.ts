/**
 * Annotation Service
 * Handles creation and management of annotation threads and comments within workspaces.
 */

import { db } from './db';
import {
  annotationThreads,
  annotationComments,
  documentsToWorkspaces,
  workspaces,
  workspaceMembers,
  organizationUsers,
  users,
} from '@shared/schema';
import {
  and,
  desc,
  eq,
  sql,
} from 'drizzle-orm';
import { logActivityEvent } from './activity-service';
import { incrementOrgUsage } from './usage-service';
import { can, type OrgRole, type WorkspaceRole } from './auth/permissions';

export class AnnotationError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'ANNOTATION_ERROR') {
    super(message);
    this.name = 'AnnotationError';
    this.status = status;
    this.code = code;
  }
}

interface WorkspaceAccessContext {
  userId: string;
  workspace: {
    id: string;
    orgId: string;
    visibility: 'org' | 'private';
  };
  orgRole: OrgRole;
  workspaceRole?: WorkspaceRole;
}

function assertAnnotationPermission(
  context: WorkspaceAccessContext,
  action: 'create' | 'read' | 'update' | 'delete',
  options: { isResourceOwner?: boolean } = {}
) {
  const allowed = can(
    {
      userId: context.userId,
      orgId: context.workspace.orgId,
      orgRole: context.orgRole,
      workspaceId: context.workspace.id,
      workspaceRole: context.workspaceRole,
      workspaceVisibility: context.workspace.visibility,
      isResourceOwner: options.isResourceOwner,
    },
    action,
    'annotation'
  );

  if (!allowed) {
    throw new AnnotationError('Insufficient permissions for this annotation action', 403, 'INSUFFICIENT_PERMISSIONS');
  }
}

async function loadWorkspaceAccess(workspaceId: string, userId: string): Promise<WorkspaceAccessContext> {
  const workspaceRows = await db
    .select({
      id: workspaces.id,
      orgId: workspaces.orgId,
      visibility: workspaces.visibility,
    })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        sql`${workspaces.archivedAt} IS NULL`
      )
    )
    .limit(1);

  if (workspaceRows.length === 0) {
    throw new AnnotationError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  }

  const workspace = workspaceRows[0];

  const orgMembership = await db
    .select({ role: organizationUsers.role, status: organizationUsers.status })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.orgId, workspace.orgId),
        eq(organizationUsers.userId, userId)
      )
    )
    .limit(1);

  if (orgMembership.length === 0 || orgMembership[0].status !== 'active') {
    throw new AnnotationError('Not a member of this organization', 403, 'NOT_ORG_MEMBER');
  }

  const workspaceMembership = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

  return {
    userId,
    workspace: {
      id: workspace.id,
      orgId: workspace.orgId,
      visibility: workspace.visibility,
    },
    orgRole: orgMembership[0].role as OrgRole,
    workspaceRole: workspaceMembership[0]?.role as WorkspaceRole | undefined,
  };
}

async function ensureDocumentShared(workspaceId: string, documentId: number) {
  const link = await db
    .select({ documentId: documentsToWorkspaces.documentId })
    .from(documentsToWorkspaces)
    .where(
      and(
        eq(documentsToWorkspaces.workspaceId, workspaceId),
        eq(documentsToWorkspaces.documentId, documentId)
      )
    )
    .limit(1);

  if (link.length === 0) {
    throw new AnnotationError('Document is not shared with this workspace', 400, 'DOCUMENT_NOT_IN_WORKSPACE');
  }
}

async function fetchThreadForWorkspace(threadId: string, workspaceId: string) {
  const rows = await db
    .select({
      id: annotationThreads.id,
      orgId: annotationThreads.orgId,
      workspaceId: annotationThreads.workspaceId,
      documentId: annotationThreads.documentId,
      anchor: annotationThreads.anchor,
      isResolved: annotationThreads.isResolved,
      createdAt: annotationThreads.createdAt,
      createdByUserId: annotationThreads.createdByUserId,
      resolvedAt: annotationThreads.resolvedAt,
    })
    .from(annotationThreads)
    .where(
      and(
        eq(annotationThreads.id, threadId),
        eq(annotationThreads.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    throw new AnnotationError('Annotation thread not found', 404, 'THREAD_NOT_FOUND');
  }

  return rows[0];
}

async function loadThreadAggregates(threadId: string) {
  const rows = await db
    .select({
      createdAt: annotationThreads.createdAt,
      commentCount: sql<number>`COUNT(CASE WHEN ${annotationComments.deletedAt} IS NULL THEN 1 END)::int`,
      lastActivityAt: sql<Date>`GREATEST(${annotationThreads.createdAt}, COALESCE(MAX(${annotationComments.createdAt}), ${annotationThreads.createdAt}), COALESCE(MAX(${annotationComments.editedAt}), ${annotationThreads.createdAt}), COALESCE(MAX(${annotationComments.deletedAt}), ${annotationThreads.createdAt}))`,
    })
    .from(annotationThreads)
    .leftJoin(annotationComments, eq(annotationComments.threadId, annotationThreads.id))
    .where(eq(annotationThreads.id, threadId))
    .groupBy(annotationThreads.id, annotationThreads.createdAt)
    .limit(1);

  if (rows.length === 0) {
    return { commentCount: 0, lastActivityAt: new Date() };
  }

  return {
    commentCount: rows[0].commentCount,
    lastActivityAt: rows[0].lastActivityAt,
  };
}

export interface AnnotationThreadSummary {
  id: string;
  orgId: string;
  workspaceId: string;
  documentId: number;
  anchor: string;
  isResolved: boolean;
  createdByUserId: string;
  createdAt: Date;
  resolvedAt: Date | null;
  commentCount: number;
  lastActivityAt: Date;
}

export interface AnnotationThreadDetail {
  thread: {
    id: string;
    orgId: string;
    workspaceId: string;
    documentId: number;
    anchor: string;
    isResolved: boolean;
    createdByUserId: string;
    createdByEmail: string;
    createdAt: Date;
    resolvedAt: Date | null;
  };
  comments: AnnotationCommentRecord[];
}

export interface AnnotationCommentRecord {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  userEmail: string;
}

export interface CreateAnnotationThreadInput {
  workspaceId: string;
  userId: string;
  documentId: number;
  anchor: string;
  initialComment?: string;
}

export interface ListAnnotationThreadsOptions {
  workspaceId: string;
  userId: string;
  documentId?: number;
  includeResolved?: boolean;
  limit?: number;
  cursor?: string;
}

export interface PaginatedAnnotationThreads {
  threads: AnnotationThreadSummary[];
  nextCursor?: string;
}

export async function createAnnotationThread(input: CreateAnnotationThreadInput): Promise<AnnotationThreadDetail> {
  const { workspaceId, userId, documentId, anchor, initialComment } = input;

  const context = await loadWorkspaceAccess(workspaceId, userId);
  assertAnnotationPermission(context, 'create');

  await ensureDocumentShared(workspaceId, documentId);

  const [thread] = await db
    .insert(annotationThreads)
    .values({
      orgId: context.workspace.orgId,
      workspaceId,
      documentId,
      anchor,
      createdByUserId: userId,
    })
    .returning();

  let initialCommentRecord: AnnotationCommentRecord[] = [];

  if (initialComment && initialComment.trim().length > 0) {
    const [comment] = await db
      .insert(annotationComments)
      .values({
        threadId: thread.id,
        userId,
        body: initialComment,
      })
      .returning();

    const [commentWithAuthor] = await db
      .select({
        id: annotationComments.id,
        threadId: annotationComments.threadId,
        userId: annotationComments.userId,
        body: annotationComments.body,
        createdAt: annotationComments.createdAt,
        editedAt: annotationComments.editedAt,
        deletedAt: annotationComments.deletedAt,
        userEmail: users.email,
      })
      .from(annotationComments)
      .innerJoin(users, eq(users.id, annotationComments.userId))
      .where(eq(annotationComments.id, comment.id))
      .limit(1);

    if (commentWithAuthor) {
      initialCommentRecord = [commentWithAuthor];
    }
  }

  await logActivityEvent({
    orgId: context.workspace.orgId,
    workspaceId,
    userId,
    action: 'annotation.thread.created',
    subjectType: 'annotation_thread',
    subjectId: thread.id,
    metadata: {
      documentId,
      hasInitialComment: Boolean(initialCommentRecord.length),
    },
  });

  if (initialCommentRecord.length > 0) {
    await logActivityEvent({
      orgId: context.workspace.orgId,
      workspaceId,
      userId,
      action: 'annotation.comment.created',
      subjectType: 'annotation_comment',
      subjectId: initialCommentRecord[0].id,
      metadata: {
        threadId: thread.id,
        documentId,
      },
    });
  }

  const annotationDelta = 1 + (initialCommentRecord.length > 0 ? 1 : 0);
  try {
    await incrementOrgUsage(context.workspace.orgId, {
      annotationsCount: annotationDelta,
    });
  } catch (error) {
    console.error('Failed to record annotation usage metrics', error);
  }

  const [threadAuthor] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    thread: {
      id: thread.id,
      orgId: thread.orgId,
      workspaceId: thread.workspaceId,
      documentId: thread.documentId,
      anchor: thread.anchor,
      isResolved: thread.isResolved,
      createdByUserId: thread.createdByUserId,
      createdByEmail: threadAuthor?.email || '',
      createdAt: thread.createdAt,
      resolvedAt: thread.resolvedAt,
    },
    comments: initialCommentRecord,
  };
}

export async function listAnnotationThreads(options: ListAnnotationThreadsOptions): Promise<PaginatedAnnotationThreads> {
  const { workspaceId, userId, documentId, includeResolved, limit, cursor } = options;
  const context = await loadWorkspaceAccess(workspaceId, userId);
  assertAnnotationPermission(context, 'read');

  const filters = [eq(annotationThreads.workspaceId, workspaceId)];

  if (!includeResolved) {
    filters.push(eq(annotationThreads.isResolved, false));
  }

  if (documentId) {
    filters.push(eq(annotationThreads.documentId, documentId));
  }

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      filters.push(sql`${annotationThreads.createdAt} < ${cursorDate}`);
    }
  }

  const pageSize = Math.min(Math.max(limit ?? 25, 1), 50);

  const rows = await db
    .select({
      id: annotationThreads.id,
      orgId: annotationThreads.orgId,
      workspaceId: annotationThreads.workspaceId,
      documentId: annotationThreads.documentId,
      anchor: annotationThreads.anchor,
      isResolved: annotationThreads.isResolved,
      createdByUserId: annotationThreads.createdByUserId,
      createdAt: annotationThreads.createdAt,
      resolvedAt: annotationThreads.resolvedAt,
      commentCount: sql<number>`COUNT(CASE WHEN ${annotationComments.deletedAt} IS NULL THEN 1 END)::int`,
      lastActivityAt: sql<Date>`GREATEST(${annotationThreads.createdAt}, COALESCE(MAX(${annotationComments.createdAt}), ${annotationThreads.createdAt}), COALESCE(MAX(${annotationComments.editedAt}), ${annotationThreads.createdAt}), COALESCE(MAX(${annotationComments.deletedAt}), ${annotationThreads.createdAt}))`,
    })
    .from(annotationThreads)
    .leftJoin(annotationComments, eq(annotationComments.threadId, annotationThreads.id))
    .where(and(...filters))
    .groupBy(
      annotationThreads.id,
      annotationThreads.orgId,
      annotationThreads.workspaceId,
      annotationThreads.documentId,
      annotationThreads.anchor,
      annotationThreads.isResolved,
      annotationThreads.createdByUserId,
      annotationThreads.createdAt,
      annotationThreads.resolvedAt
    )
    .orderBy(desc(annotationThreads.createdAt))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const sliced = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].createdAt.toISOString() : undefined;

  const threads: AnnotationThreadSummary[] = sliced.map((row) => ({
    id: row.id,
    orgId: row.orgId,
    workspaceId: row.workspaceId,
    documentId: row.documentId,
    anchor: row.anchor,
    isResolved: row.isResolved,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    commentCount: row.commentCount,
    lastActivityAt: row.lastActivityAt,
  }));

  return {
    threads,
    nextCursor,
  };
}

export async function getAnnotationThread(params: { workspaceId: string; threadId: string; userId: string }): Promise<AnnotationThreadDetail> {
  const { workspaceId, threadId, userId } = params;

  const context = await loadWorkspaceAccess(workspaceId, userId);
  assertAnnotationPermission(context, 'read');

  const threadRows = await db
    .select({
      id: annotationThreads.id,
      orgId: annotationThreads.orgId,
      workspaceId: annotationThreads.workspaceId,
      documentId: annotationThreads.documentId,
      anchor: annotationThreads.anchor,
      isResolved: annotationThreads.isResolved,
      createdAt: annotationThreads.createdAt,
      createdByUserId: annotationThreads.createdByUserId,
      resolvedAt: annotationThreads.resolvedAt,
      createdByEmail: users.email,
    })
    .from(annotationThreads)
    .innerJoin(users, eq(users.id, annotationThreads.createdByUserId))
    .where(
      and(
        eq(annotationThreads.id, threadId),
        eq(annotationThreads.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (threadRows.length === 0) {
    throw new AnnotationError('Annotation thread not found', 404, 'THREAD_NOT_FOUND');
  }

  const comments = await db
    .select({
      id: annotationComments.id,
      threadId: annotationComments.threadId,
      userId: annotationComments.userId,
      body: annotationComments.body,
      createdAt: annotationComments.createdAt,
      editedAt: annotationComments.editedAt,
      deletedAt: annotationComments.deletedAt,
      userEmail: users.email,
    })
    .from(annotationComments)
    .innerJoin(users, eq(users.id, annotationComments.userId))
    .where(
      and(
        eq(annotationComments.threadId, threadId),
        sql`${annotationComments.deletedAt} IS NULL`
      )
    )
    .orderBy(annotationComments.createdAt);

  const thread = threadRows[0];

  return {
    thread: {
      id: thread.id,
      orgId: thread.orgId,
      workspaceId: thread.workspaceId,
      documentId: thread.documentId,
      anchor: thread.anchor,
      isResolved: thread.isResolved,
      createdByUserId: thread.createdByUserId,
      createdByEmail: thread.createdByEmail,
      createdAt: thread.createdAt,
      resolvedAt: thread.resolvedAt,
    },
    comments,
  };
}

export async function addAnnotationComment(params: { workspaceId: string; threadId: string; userId: string; body: string }): Promise<AnnotationCommentRecord> {
  const { workspaceId, threadId, userId, body } = params;

  const context = await loadWorkspaceAccess(workspaceId, userId);
  assertAnnotationPermission(context, 'create');

  const thread = await fetchThreadForWorkspace(threadId, workspaceId);

  const [comment] = await db
    .insert(annotationComments)
    .values({
      threadId: thread.id,
      userId,
      body,
    })
    .returning();

  await logActivityEvent({
    orgId: context.workspace.orgId,
    workspaceId,
    userId,
    action: 'annotation.comment.created',
    subjectType: 'annotation_comment',
    subjectId: comment.id,
    metadata: {
      threadId: thread.id,
      documentId: thread.documentId,
    },
  });

  try {
    await incrementOrgUsage(context.workspace.orgId, {
      annotationsCount: 1,
    });
  } catch (error) {
    console.error('Failed to record annotation usage metrics', error);
  }

  const [commentWithAuthor] = await db
    .select({
      id: annotationComments.id,
      threadId: annotationComments.threadId,
      userId: annotationComments.userId,
      body: annotationComments.body,
      createdAt: annotationComments.createdAt,
      editedAt: annotationComments.editedAt,
      deletedAt: annotationComments.deletedAt,
      userEmail: users.email,
    })
    .from(annotationComments)
    .innerJoin(users, eq(users.id, annotationComments.userId))
    .where(eq(annotationComments.id, comment.id))
    .limit(1);

  if (!commentWithAuthor) {
    throw new AnnotationError('Failed to load created comment', 500, 'COMMENT_NOT_FOUND');
  }

  return commentWithAuthor;
}

export async function updateAnnotationComment(params: { workspaceId: string; threadId: string; commentId: string; userId: string; body: string }): Promise<AnnotationCommentRecord> {
  const { workspaceId, threadId, commentId, userId, body } = params;

  const context = await loadWorkspaceAccess(workspaceId, userId);

  const commentRows = await db
    .select({
      id: annotationComments.id,
      threadId: annotationComments.threadId,
      userId: annotationComments.userId,
      deletedAt: annotationComments.deletedAt,
      documentId: annotationThreads.documentId,
    })
    .from(annotationComments)
    .innerJoin(annotationThreads, eq(annotationComments.threadId, annotationThreads.id))
    .where(
      and(
        eq(annotationComments.id, commentId),
        eq(annotationComments.threadId, threadId),
        eq(annotationThreads.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (commentRows.length === 0) {
    throw new AnnotationError('Annotation comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  const existing = commentRows[0];

  if (existing.deletedAt) {
    throw new AnnotationError('Cannot edit a deleted comment', 400, 'COMMENT_DELETED');
  }

  assertAnnotationPermission(context, 'update', { isResourceOwner: existing.userId === userId });

  const [updated] = await db
    .update(annotationComments)
    .set({ body, editedAt: new Date() })
    .where(eq(annotationComments.id, existing.id))
    .returning();

  await logActivityEvent({
    orgId: context.workspace.orgId,
    workspaceId,
    userId,
    action: 'annotation.comment.updated',
    subjectType: 'annotation_comment',
    subjectId: updated.id,
    metadata: {
      threadId,
      documentId: existing.documentId,
    },
  });

  const [commentWithAuthor] = await db
    .select({
      id: annotationComments.id,
      threadId: annotationComments.threadId,
      userId: annotationComments.userId,
      body: annotationComments.body,
      createdAt: annotationComments.createdAt,
      editedAt: annotationComments.editedAt,
      deletedAt: annotationComments.deletedAt,
      userEmail: users.email,
    })
    .from(annotationComments)
    .innerJoin(users, eq(users.id, annotationComments.userId))
    .where(eq(annotationComments.id, updated.id))
    .limit(1);

  if (!commentWithAuthor) {
    throw new AnnotationError('Failed to load updated comment', 500, 'COMMENT_NOT_FOUND');
  }

  return commentWithAuthor;
}

export async function deleteAnnotationComment(params: { workspaceId: string; threadId: string; commentId: string; userId: string }): Promise<{ success: true }> {
  const { workspaceId, threadId, commentId, userId } = params;

  const context = await loadWorkspaceAccess(workspaceId, userId);

  const commentRows = await db
    .select({
      id: annotationComments.id,
      threadId: annotationComments.threadId,
      userId: annotationComments.userId,
      deletedAt: annotationComments.deletedAt,
      documentId: annotationThreads.documentId,
    })
    .from(annotationComments)
    .innerJoin(annotationThreads, eq(annotationComments.threadId, annotationThreads.id))
    .where(
      and(
        eq(annotationComments.id, commentId),
        eq(annotationComments.threadId, threadId),
        eq(annotationThreads.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (commentRows.length === 0) {
    throw new AnnotationError('Annotation comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  const existing = commentRows[0];

  if (existing.deletedAt) {
    return { success: true };
  }

  assertAnnotationPermission(context, 'delete', { isResourceOwner: existing.userId === userId });

  await db
    .update(annotationComments)
    .set({ deletedAt: new Date() })
    .where(eq(annotationComments.id, existing.id));

  await logActivityEvent({
    orgId: context.workspace.orgId,
    workspaceId,
    userId,
    action: 'annotation.comment.deleted',
    subjectType: 'annotation_comment',
    subjectId: existing.id,
    metadata: {
      threadId,
      documentId: existing.documentId,
    },
  });

  return { success: true };
}

export async function setThreadResolution(params: { workspaceId: string; threadId: string; userId: string; resolved: boolean }): Promise<AnnotationThreadSummary> {
  const { workspaceId, threadId, userId, resolved } = params;

  const context = await loadWorkspaceAccess(workspaceId, userId);
  const thread = await fetchThreadForWorkspace(threadId, workspaceId);

  assertAnnotationPermission(context, 'update', { isResourceOwner: thread.createdByUserId === userId });

  if (thread.isResolved === resolved) {
    const aggregates = await loadThreadAggregates(thread.id);
    return {
      id: thread.id,
      orgId: thread.orgId,
      workspaceId: thread.workspaceId,
      documentId: thread.documentId,
      anchor: thread.anchor,
      isResolved: thread.isResolved,
      createdByUserId: thread.createdByUserId,
      createdAt: thread.createdAt,
      resolvedAt: thread.resolvedAt,
      commentCount: aggregates.commentCount,
      lastActivityAt: aggregates.lastActivityAt,
    };
  }

  const [updated] = await db
    .update(annotationThreads)
    .set({
      isResolved: resolved,
      resolvedAt: resolved ? new Date() : null,
    })
    .where(eq(annotationThreads.id, thread.id))
    .returning();

  await logActivityEvent({
    orgId: context.workspace.orgId,
    workspaceId,
    userId,
    action: resolved ? 'annotation.thread.resolved' : 'annotation.thread.reopened',
    subjectType: 'annotation_thread',
    subjectId: thread.id,
    metadata: {
      documentId: thread.documentId,
    },
  });

  const aggregates = await loadThreadAggregates(updated.id);

  return {
    id: updated.id,
    orgId: updated.orgId,
    workspaceId: updated.workspaceId,
    documentId: updated.documentId,
    anchor: updated.anchor,
    isResolved: updated.isResolved,
    createdByUserId: updated.createdByUserId,
    createdAt: updated.createdAt,
    resolvedAt: updated.resolvedAt,
    commentCount: aggregates.commentCount,
    lastActivityAt: aggregates.lastActivityAt,
  };
}
