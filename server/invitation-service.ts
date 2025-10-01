/**
 * Invitation Service
 * Handles organization invitation creation, validation, and acceptance
 */

import { db } from './db';
import { organizationInvitations, organizationUsers, organizations, users } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface CreateInvitationInput {
  orgId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  invitedByUserId: string;
}

export interface AcceptInvitationInput {
  token: string;
  userId: string;
}

/**
 * Generate secure invitation token
 * Returns both the token and its hash for storage
 */
function generateInvitationToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  // Generate random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Hash the token for storage
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Store first 8 characters for lookup
  const tokenPrefix = token.substring(0, 8);
  
  return { token, tokenHash, tokenPrefix };
}

/**
 * Hash a token for comparison
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new organization invitation
 */
export async function createInvitation(input: CreateInvitationInput) {
  const { orgId, email, role, invitedByUserId } = input;

  // Verify organization exists
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(
      eq(organizations.id, orgId),
      sql`${organizations.deletedAt} IS NULL`
    ))
    .limit(1);

  if (!org) {
    throw new Error('Organization not found');
  }

  // Check if user is already a member
  const existingMember = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      sql`${organizationUsers.userId} IN (SELECT id FROM ${users} WHERE email = ${email})`
    ))
    .limit(1);

  if (existingMember.length > 0) {
    throw new Error('User is already a member of this organization');
  }

  // Check if there's already a pending invitation
  const existingInvitation = await db
    .select()
    .from(organizationInvitations)
    .where(and(
      eq(organizationInvitations.orgId, orgId),
      eq(organizationInvitations.email, email),
      sql`${organizationInvitations.acceptedAt} IS NULL`,
      sql`${organizationInvitations.revokedAt} IS NULL`,
      sql`${organizationInvitations.expiresAt} > NOW()`
    ))
    .limit(1);

  if (existingInvitation.length > 0) {
    throw new Error('There is already a pending invitation for this email');
  }

  // Check seat limit
  const memberCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.status, 'active')
    ));

  const currentSeats = Number(memberCount[0]?.count || 0);
  const seatLimit = org.seatLimit;

  if (seatLimit && seatLimit > 0 && currentSeats >= seatLimit) {
    throw new Error(`Organization has reached its seat limit of ${seatLimit} members`);
  }

  // Generate invitation token
  const { token, tokenHash, tokenPrefix } = generateInvitationToken();

  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create invitation
  const [invitation] = await db
    .insert(organizationInvitations)
    .values({
      orgId,
      email,
      role,
      inviterUserId: invitedByUserId,
      tokenHash,
      tokenPrefix,
      expiresAt,
    })
    .returning();

  return {
    invitation,
    token, // Return plain token only once for email
  };
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token: string) {
  const tokenHash = hashToken(token);
  const tokenPrefix = token.substring(0, 8);

  const [invitation] = await db
    .select()
    .from(organizationInvitations)
    .where(and(
      eq(organizationInvitations.tokenPrefix, tokenPrefix),
      eq(organizationInvitations.tokenHash, tokenHash),
      sql`${organizationInvitations.acceptedAt} IS NULL`,
      sql`${organizationInvitations.revokedAt} IS NULL`,
      sql`${organizationInvitations.expiresAt} > NOW()`
    ))
    .limit(1);

  return invitation;
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(input: AcceptInvitationInput) {
  const { token, userId } = input;

  // Get invitation
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }

  // Verify the user's email matches the invitation
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error('This invitation was sent to a different email address');
  }

  // Check if user is already a member
  const existingMember = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, invitation.orgId),
      eq(organizationUsers.userId, userId)
    ))
    .limit(1);

  if (existingMember.length > 0) {
    throw new Error('You are already a member of this organization');
  }

  // Add user to organization
  await db.insert(organizationUsers).values({
    orgId: invitation.orgId,
    userId,
    role: invitation.role,
    invitedByUserId: invitation.inviterUserId,
    status: 'active',
    joinedAt: new Date(),
  });

  // Mark invitation as accepted
  await db
    .update(organizationInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(organizationInvitations.id, invitation.id));

  return {
    orgId: invitation.orgId,
    role: invitation.role,
  };
}

/**
 * List pending invitations for an organization
 */
export async function listOrganizationInvitations(orgId: string) {
  const invitations = await db
    .select()
    .from(organizationInvitations)
    .where(and(
      eq(organizationInvitations.orgId, orgId),
      sql`${organizationInvitations.acceptedAt} IS NULL`,
      sql`${organizationInvitations.revokedAt} IS NULL`
    ))
    .orderBy(sql`${organizationInvitations.createdAt} DESC`);

  return invitations;
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(invitationId: string) {
  const [invitation] = await db
    .update(organizationInvitations)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(organizationInvitations.id, invitationId),
      sql`${organizationInvitations.acceptedAt} IS NULL`,
      sql`${organizationInvitations.revokedAt} IS NULL`
    ))
    .returning();

  if (!invitation) {
    throw new Error('Invitation not found or already processed');
  }

  return invitation;
}

/**
 * Get invitation with organization details
 */
export async function getInvitationDetails(token: string) {
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return null;
  }

  // Get organization details
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, invitation.orgId))
    .limit(1);

  // Get inviter details
  const [inviter] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, invitation.inviterUserId))
    .limit(1);

  return {
    invitation,
    organization: org,
    inviter,
  };
}
