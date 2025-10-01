import crypto from 'crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { orgApiKeys } from '@shared/schema';

export type OrgApiKeyScope = string;

export interface OrgApiKeyRecord {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  scopes: OrgApiKeyScope[];
  rateLimitOverride: number | null;
  createdByUserId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreateOrgApiKeyInput {
  orgId: string;
  name: string;
  scopes?: OrgApiKeyScope[];
  rateLimitOverride?: number | null;
  createdByUserId: string;
}

export interface CreateOrgApiKeyResult {
  apiKey: OrgApiKeyRecord;
  secret: string;
}

const DEFAULT_SCOPE: OrgApiKeyScope = 'documents.read';
const API_KEY_PREFIX = 'rmpk_';

function parseScopes(value: string | null | undefined): OrgApiKeyScope[] {
  if (!value) {
    return [DEFAULT_SCOPE];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      const unique = Array.from(new Set(parsed.map((scope) => scope.trim()).filter(Boolean)));
      return unique.length > 0 ? unique : [DEFAULT_SCOPE];
    }
  } catch (error) {
    console.warn('Failed to parse API key scopes payload', error);
  }

  return [DEFAULT_SCOPE];
}

function serializeScopes(scopes: OrgApiKeyScope[] | undefined): string {
  const normalized = (scopes ?? [DEFAULT_SCOPE])
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    normalized.push(DEFAULT_SCOPE);
  }

  return JSON.stringify(Array.from(new Set(normalized)));
}

function mapRecord(record: typeof orgApiKeys.$inferSelect): OrgApiKeyRecord {
  return {
    id: record.id,
    orgId: record.orgId,
    name: record.name,
    prefix: record.prefix,
    scopes: parseScopes(record.scopes),
    rateLimitOverride: record.rateLimitOverride ?? null,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt ?? null,
    revokedAt: record.revokedAt ?? null,
  };
}

function generateSecret(): { secret: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(32).toString('base64url');
  const secret = `${API_KEY_PREFIX}${random}`;
  const prefix = secret.slice(0, 12);
  const hash = crypto.createHash('sha256').update(secret).digest('hex');

  return { secret, prefix, hash };
}

export async function listOrgApiKeys(orgId: string): Promise<OrgApiKeyRecord[]> {
  const rows = await db
    .select()
    .from(orgApiKeys)
    .where(eq(orgApiKeys.orgId, orgId))
    .orderBy(desc(orgApiKeys.createdAt));

  return rows.map(mapRecord);
}

export async function createOrgApiKey(input: CreateOrgApiKeyInput): Promise<CreateOrgApiKeyResult> {
  const { secret, prefix, hash } = generateSecret();
  const scopes = serializeScopes(input.scopes);

  const [record] = await db
    .insert(orgApiKeys)
    .values({
      orgId: input.orgId,
      name: input.name,
      keyHash: hash,
      prefix,
      scopes,
      rateLimitOverride: input.rateLimitOverride ?? null,
      createdByUserId: input.createdByUserId,
    })
    .returning();

  return {
    apiKey: mapRecord(record),
    secret,
  };
}

export async function getOrgApiKey(orgId: string, apiKeyId: string): Promise<OrgApiKeyRecord | null> {
  const [record] = await db
    .select()
    .from(orgApiKeys)
    .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.id, apiKeyId)))
    .limit(1);

  return record ? mapRecord(record) : null;
}

export async function revokeOrgApiKey(orgId: string, apiKeyId: string): Promise<OrgApiKeyRecord | null> {
  const [record] = await db
    .update(orgApiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.id, apiKeyId), isNull(orgApiKeys.revokedAt)))
    .returning();

  return record ? mapRecord(record) : null;
}

export async function markApiKeyUsed(orgId: string, prefix: string): Promise<void> {
  try {
    await db
      .update(orgApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.prefix, prefix)));
  } catch (error) {
    console.warn('Failed to update API key usage timestamp', error);
  }
}
