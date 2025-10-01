/**
 * Activity Events Service
 * Provides logging and retrieval helpers for organization and workspace activity.
 */

import { db } from './db';
import {
  activityEvents,
  workspaces,
  users,
} from '@shared/schema';
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  sql,
} from 'drizzle-orm';

export interface LogActivityEventInput {
  orgId: string;
  workspaceId?: string | null;
  userId?: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata?: Record<string, unknown>;
}

export interface GetActivityEventsOptions {
  orgId: string;
  workspaceId?: string;
  limit?: number;
  cursor?: string;
  actions?: string[];
}

export interface ActivityEventRecord {
  id: string;
  orgId: string;
  workspaceId: string | null;
  userId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  workspaceName: string | null;
  userEmail: string | null;
}

export interface PaginatedActivityResponse {
  events: ActivityEventRecord[];
  nextCursor?: string;
}

/**
 * Persist a new activity event for auditing.
 */
export async function logActivityEvent(input: LogActivityEventInput) {
  const metadataString = input.metadata ? JSON.stringify(input.metadata) : '{}';

  const [event] = await db
    .insert(activityEvents)
    .values({
      orgId: input.orgId,
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      metadata: metadataString,
    })
    .returning();

  return event;
}

/**
 * Fetch a paginated list of activity events for an organization.
 */
export async function getOrgActivityEvents(options: GetActivityEventsOptions): Promise<PaginatedActivityResponse> {
  const { orgId, workspaceId, cursor, actions } = options;
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);

  const filters = [eq(activityEvents.orgId, orgId)];

  if (workspaceId) {
    filters.push(eq(activityEvents.workspaceId, workspaceId));
  }

  if (actions && actions.length > 0) {
    filters.push(inArray(activityEvents.action, actions));
  }

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      filters.push(sql`${activityEvents.createdAt} < ${cursorDate}`);
    }
  }

  const rows = await db
    .select({
      id: activityEvents.id,
      orgId: activityEvents.orgId,
      workspaceId: activityEvents.workspaceId,
      userId: activityEvents.userId,
      action: activityEvents.action,
      subjectType: activityEvents.subjectType,
      subjectId: activityEvents.subjectId,
      metadata: activityEvents.metadata,
      createdAt: activityEvents.createdAt,
      workspaceName: workspaces.name,
      userEmail: users.email,
    })
    .from(activityEvents)
    .leftJoin(workspaces, eq(activityEvents.workspaceId, workspaces.id))
    .leftJoin(users, eq(activityEvents.userId, users.id))
    .where(and(...filters))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  const events: ActivityEventRecord[] = sliced.map((row) => ({
    ...row,
    metadata: parseMetadata(row.metadata),
  }));

  const nextCursor = hasMore
    ? rows[limit - 1].createdAt.toISOString()
    : undefined;

  return {
    events,
    nextCursor,
  };
}

/**
 * Summaries activity volume over the last N days grouped by action.
 */
export async function getOrgActivitySummary(orgId: string, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      action: activityEvents.action,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(activityEvents)
    .where(and(
      eq(activityEvents.orgId, orgId),
      gt(activityEvents.createdAt, since),
    ))
    .groupBy(activityEvents.action);

  return {
    since,
    totals: rows,
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return { raw };
  }
}
