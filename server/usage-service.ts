/**
 * Usage Tracking Service
 * Aggregates daily organization usage metrics and exposes helper utilities
 * for recording and querying adoption signals.
 */

import { db } from './db';
import { orgUsageDaily } from '@shared/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

export interface UsageIncrement {
  tokensUsed?: number;
  analysesCount?: number;
  annotationsCount?: number;
  apiCallsCount?: number;
}

export interface GetOrgUsageOptions {
  from?: string;
  to?: string;
  days?: number;
}

export interface OrgUsageRecord {
  date: string;
  tokensUsed: number;
  analysesCount: number;
  annotationsCount: number;
  apiCallsCount: number;
}

export interface UsageTotals {
  tokensUsed: number;
  analysesCount: number;
  annotationsCount: number;
  apiCallsCount: number;
}

export interface OrgUsageResponse {
  usage: OrgUsageRecord[];
  totals: UsageTotals;
  period: {
    from: string;
    to: string;
    days: number;
  };
}

export interface OrgUsageSummaryResponse {
  totals: UsageTotals;
  period: {
    from: string;
    to: string;
    days: number;
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LOOKBACK_DAYS = 30;

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(key: string): Date {
  if (!DATE_PATTERN.test(key)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const [year, month, day] = key.split('-').map((part) => Number(part));
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(utcDate.getTime())) {
    throw new Error('Invalid date value');
  }

  return utcDate;
}

function clampLookbackDays(days?: number): number {
  if (!days || Number.isNaN(days)) {
    return DEFAULT_LOOKBACK_DAYS;
  }

  return Math.min(Math.max(Math.floor(days), 1), 180);
}

function resolvePeriod(options: GetOrgUsageOptions = {}): { from: string; to: string; days: number } {
  const toKey = options.to ? sanitizeDateKey(options.to) : formatDateKey(new Date());
  const lookback = options.from ? undefined : clampLookbackDays(options.days);

  if (options.from) {
    const fromKey = sanitizeDateKey(options.from);
    const fromDate = parseDateKey(fromKey);
    const toDate = parseDateKey(toKey);

    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error('`from` date must be before or equal to `to` date');
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;

    return { from: fromKey, to: toKey, days: diffDays };
  }

  const toDate = parseDateKey(toKey);
  const days = lookback ?? DEFAULT_LOOKBACK_DAYS;
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  const fromKey = formatDateKey(fromDate);

  return { from: fromKey, to: toKey, days };
}

function sanitizeDateKey(key: string): string {
  if (!DATE_PATTERN.test(key)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  return key;
}

function calculateTotals(records: OrgUsageRecord[]): UsageTotals {
  return records.reduce<UsageTotals>(
    (acc, record) => ({
      tokensUsed: acc.tokensUsed + record.tokensUsed,
      analysesCount: acc.analysesCount + record.analysesCount,
      annotationsCount: acc.annotationsCount + record.annotationsCount,
      apiCallsCount: acc.apiCallsCount + record.apiCallsCount,
    }),
    { tokensUsed: 0, analysesCount: 0, annotationsCount: 0, apiCallsCount: 0 },
  );
}

/**
 * Increment daily usage counters for an organization.
 */
export async function incrementOrgUsage(
  orgId: string,
  counts: UsageIncrement,
  at: Date = new Date(),
): Promise<void> {
  const normalized = {
    tokensUsed: counts.tokensUsed ?? 0,
    analysesCount: counts.analysesCount ?? 0,
    annotationsCount: counts.annotationsCount ?? 0,
    apiCallsCount: counts.apiCallsCount ?? 0,
  };

  const totalDelta =
    Math.abs(normalized.tokensUsed) +
    Math.abs(normalized.analysesCount) +
    Math.abs(normalized.annotationsCount) +
    Math.abs(normalized.apiCallsCount);

  if (totalDelta === 0) {
    return;
  }

  const dateKey = formatDateKey(at);

  await db
    .insert(orgUsageDaily)
    .values({
      orgId,
      date: dateKey,
      tokensUsed: normalized.tokensUsed,
      analysesCount: normalized.analysesCount,
      annotationsCount: normalized.annotationsCount,
      apiCallsCount: normalized.apiCallsCount,
    })
    .onConflictDoUpdate({
      target: [orgUsageDaily.orgId, orgUsageDaily.date],
      set: {
        tokensUsed: sql`${orgUsageDaily.tokensUsed} + ${normalized.tokensUsed}`,
        analysesCount: sql`${orgUsageDaily.analysesCount} + ${normalized.analysesCount}`,
        annotationsCount: sql`${orgUsageDaily.annotationsCount} + ${normalized.annotationsCount}`,
        apiCallsCount: sql`${orgUsageDaily.apiCallsCount} + ${normalized.apiCallsCount}`,
      },
    });
}

/**
 * Retrieve a normalized list of daily usage totals for an organization.
 */
export async function getOrgUsage(orgId: string, options: GetOrgUsageOptions = {}): Promise<OrgUsageResponse> {
  const period = resolvePeriod(options);
  const filters = [eq(orgUsageDaily.orgId, orgId)];

  if (period.from) {
    filters.push(gte(orgUsageDaily.date, period.from));
  }

  if (period.to) {
    filters.push(lte(orgUsageDaily.date, period.to));
  }

  const rows = await db
    .select({
      date: orgUsageDaily.date,
      tokensUsed: orgUsageDaily.tokensUsed,
      analysesCount: orgUsageDaily.analysesCount,
      annotationsCount: orgUsageDaily.annotationsCount,
      apiCallsCount: orgUsageDaily.apiCallsCount,
    })
    .from(orgUsageDaily)
    .where(and(...filters))
    .orderBy(orgUsageDaily.date);

  const startDate = parseDateKey(period.from);
  const endDate = parseDateKey(period.to);

  const recordsMap = new Map(rows.map((row) => [row.date, row] as const));
  const usage: OrgUsageRecord[] = [];

  for (
    let cursor = new Date(startDate);
    cursor.getTime() <= endDate.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const key = formatDateKey(cursor);
    const existing = recordsMap.get(key);

    usage.push(
      existing ?? {
        date: key,
        tokensUsed: 0,
        analysesCount: 0,
        annotationsCount: 0,
        apiCallsCount: 0,
      },
    );
  }

  const totals = calculateTotals(usage);

  return {
    usage,
    totals,
    period: { ...period, days: usage.length },
  };
}

/**
 * Summarize usage totals over a recent time window.
 */
export async function getOrgUsageSummary(orgId: string, days = DEFAULT_LOOKBACK_DAYS): Promise<OrgUsageSummaryResponse> {
  const period = resolvePeriod({ days });

  const [row] = await db
    .select({
      tokensUsed: sql<number>`COALESCE(SUM(${orgUsageDaily.tokensUsed}), 0)::int`,
      analysesCount: sql<number>`COALESCE(SUM(${orgUsageDaily.analysesCount}), 0)::int`,
      annotationsCount: sql<number>`COALESCE(SUM(${orgUsageDaily.annotationsCount}), 0)::int`,
      apiCallsCount: sql<number>`COALESCE(SUM(${orgUsageDaily.apiCallsCount}), 0)::int`,
    })
    .from(orgUsageDaily)
    .where(and(
      eq(orgUsageDaily.orgId, orgId),
      gte(orgUsageDaily.date, period.from),
      lte(orgUsageDaily.date, period.to),
    ));

  const totals: UsageTotals = row ?? {
    tokensUsed: 0,
    analysesCount: 0,
    annotationsCount: 0,
    apiCallsCount: 0,
  };

  return {
    totals,
    period,
  };
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}
