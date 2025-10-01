/**
 * Organization Service
 * Handles organization CRUD operations and membership management
 */

import { db } from './db';
import { organizations, organizationUsers, workspaces, users } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { hasTeamCollaborationAccess, getDefaultSeatLimit } from './feature-flags';

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  createdByUserId: string;
  billingTier: string;
  seatLimit?: number;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  seatLimit?: number;
}

export interface AddMemberInput {
  orgId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  invitedByUserId: string;
}

/**
 * Create a new organization
 */
export async function createOrganization(input: CreateOrganizationInput) {
  const { name, slug, createdByUserId, billingTier, seatLimit } = input;

  // Verify slug is available
  const existingOrg = await db
    .select()
    .from(organizations)
    .where(and(
      eq(organizations.slug, slug),
      sql`${organizations.deletedAt} IS NULL`
    ))
    .limit(1);

  if (existingOrg.length > 0) {
    throw new Error('Organization slug already taken');
  }

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values({
      name,
      slug,
      billingTier,
      seatLimit: seatLimit || getDefaultSeatLimit(billingTier),
      createdByUserId,
    })
    .returning();

  // Add creator as admin
  await db.insert(organizationUsers).values({
    orgId: org.id,
    userId: createdByUserId,
    role: 'admin',
    status: 'active',
    joinedAt: new Date(),
  });

  // Create default workspace
  await db.insert(workspaces).values({
    orgId: org.id,
    name: 'General',
    description: 'Default workspace for all organization members',
    isDefault: true,
    visibility: 'org',
    createdByUserId,
  });

  return org;
}

/**
 * Get organization by ID
 */
export async function getOrganization(orgId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(
      eq(organizations.id, orgId),
      sql`${organizations.deletedAt} IS NULL`
    ))
    .limit(1);

  return org;
}

/**
 * Get organizations for a user
 */
export async function getUserOrganizations(userId: string) {
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      billingTier: organizations.billingTier,
      role: organizationUsers.role,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(organizationUsers, eq(organizations.id, organizationUsers.orgId))
    .where(and(
      eq(organizationUsers.userId, userId),
      eq(organizationUsers.status, 'active'),
      sql`${organizations.deletedAt} IS NULL`
    ))
    .orderBy(organizations.name);

  return orgs;
}

/**
 * Update organization
 */
export async function updateOrganization(orgId: string, updates: UpdateOrganizationInput) {
  // Check slug availability if updating slug
  if (updates.slug) {
    const existing = await db
      .select()
      .from(organizations)
      .where(and(
        eq(organizations.slug, updates.slug),
        sql`${organizations.id} != ${orgId}`,
        sql`${organizations.deletedAt} IS NULL`
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Organization slug already taken');
    }
  }

  const [updated] = await db
    .update(organizations)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId))
    .returning();

  return updated;
}

/**
 * Soft delete organization
 */
export async function deleteOrganization(orgId: string) {
  await db
    .update(organizations)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}

/**
 * Get organization members
 */
export async function getOrganizationMembers(orgId: string) {
  const members = await db
    .select({
      userId: organizationUsers.userId,
      role: organizationUsers.role,
      status: organizationUsers.status,
      joinedAt: organizationUsers.joinedAt,
      lastSeenAt: organizationUsers.lastSeenAt,
      email: users.email,
    })
    .from(organizationUsers)
    .innerJoin(users, eq(organizationUsers.userId, users.id))
    .where(eq(organizationUsers.orgId, orgId))
    .orderBy(organizationUsers.joinedAt);

  return members;
}

/**
 * Add member to organization
 */
export async function addOrganizationMember(input: AddMemberInput) {
  const { orgId, userId, role, invitedByUserId } = input;

  // Check if user is already a member
  const existing = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('User is already a member of this organization');
  }

  // Check seat limit
  const org = await getOrganization(orgId);
  if (!org) throw new Error('Organization not found');

  if (org.seatLimit && org.seatLimit > 0) {
    const memberCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.orgId, orgId),
        eq(organizationUsers.status, 'active')
      ));

    if (memberCount[0].count >= org.seatLimit) {
      throw new Error('Organization has reached its seat limit');
    }
  }

  // Add member
  await db.insert(organizationUsers).values({
    orgId,
    userId,
    role,
    status: 'active',
    invitedByUserId,
    joinedAt: new Date(),
  });
}

/**
 * Update organization member role
 */
export async function updateOrganizationMemberRole(
  orgId: string,
  userId: string,
  role: 'admin' | 'member' | 'viewer'
) {
  await db
    .update(organizationUsers)
    .set({ role })
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId)
    ));
}

/**
 * Update organization member status
 */
export async function updateOrganizationMemberStatus(
  orgId: string,
  userId: string,
  status: 'active' | 'suspended'
) {
  await db
    .update(organizationUsers)
    .set({ status })
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId)
    ));
}

/**
 * Remove member from organization
 */
export async function removeOrganizationMember(orgId: string, userId: string) {
  // Check if this is the last admin
  const admins = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.role, 'admin'),
      eq(organizationUsers.status, 'active')
    ));

  const member = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId)
    ))
    .limit(1);

  if (member[0]?.role === 'admin' && admins.length === 1) {
    throw new Error('Cannot remove the last admin from organization');
  }

  await db
    .delete(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId)
    ));
}

/**
 * Get user's organization membership
 */
export async function getUserOrgMembership(userId: string, orgId: string) {
  const [membership] = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.userId, userId),
      eq(organizationUsers.orgId, orgId)
    ))
    .limit(1);

  return membership;
}

/**
 * Update user's last seen timestamp in organization
 */
export async function updateUserLastSeen(userId: string, orgId: string) {
  await db
    .update(organizationUsers)
    .set({ lastSeenAt: new Date() })
    .where(and(
      eq(organizationUsers.userId, userId),
      eq(organizationUsers.orgId, orgId)
    ));
}

/**
 * Set user's default organization
 */
export async function setUserDefaultOrganization(userId: string, orgId: string) {
  await db
    .update(users)
    .set({ defaultOrgId: orgId })
    .where(eq(users.id, userId));
}

/**
 * Get user's default organization
 */
export async function getUserDefaultOrganization(userId: string) {
  // TODO: Implement default org ID - users.defaultOrgId doesn't exist in schema
  // const [user] = await db
  //   .select({ defaultOrgId: users.defaultOrgId })
  //   .from(users)
  //   .where(eq(users.id, userId))
  //   .limit(1);
  // return user?.defaultOrgId;
  return null;
}
