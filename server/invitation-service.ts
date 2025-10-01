import crypto from 'crypto';
import { db } from './db';
import { organizationInvitations, organizationUsers, organizations } from '../shared/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { sendInvitationEmail } from './email-service';

const TOKEN_LENGTH = 32;
const PREFIX_LENGTH = 8;
const EXPIRY_DAYS = 7;

// Server secret for HMAC - should be in environment variable
const getServerSecret = (): string => {
  const secret = process.env.INVITATION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('INVITATION_SECRET or SESSION_SECRET must be set');
  }
  return secret;
};

// Generate a secure random token
const generateToken = (): { token: string; tokenHash: string; tokenPrefix: string } => {
  const token = crypto.randomBytes(TOKEN_LENGTH).toString('base64url');
  const tokenHash = crypto
    .createHmac('sha256', getServerSecret())
    .update(token)
    .digest('hex');
  const tokenPrefix = token.substring(0, PREFIX_LENGTH);
  
  return { token, tokenHash, tokenPrefix };
};

// Hash a token for lookup
const hashToken = (token: string): string => {
  return crypto
    .createHmac('sha256', getServerSecret())
    .update(token)
    .digest('hex');
};

export interface CreateInvitationParams {
  orgId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  inviterUserId: string;
  inviterName: string;
}

export interface InvitationResult {
  id: string;
  token: string; // Only returned once at creation
  email: string;
  role: string;
  expiresAt: Date;
}

export const invitationService = {
  /**
   * Create a new invitation
   * Enforces seat limits and prevents duplicate active invitations
   */
  async createInvitation(params: CreateInvitationParams): Promise<InvitationResult> {
    const { orgId, email, role, inviterUserId, inviterName } = params;

    // Check if organization exists and get seat limit
    const [org] = await db
      .select()
      .from(organizations)
      .where(and(
        eq(organizations.id, orgId),
        isNull(organizations.deleted_at)
      ))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    // Check seat limits
    if (org.seat_limit !== null) {
      const [currentMembers] = await db
        .select({ count: db.raw<number>('count(*)::int') })
        .from(organizationUsers)
        .where(and(
          eq(organizationUsers.org_id, orgId),
          eq(organizationUsers.status, 'active')
        ));

      const [pendingInvitations] = await db
        .select({ count: db.raw<number>('count(*)::int') })
        .from(organizationInvitations)
        .where(and(
          eq(organizationInvitations.org_id, orgId),
          isNull(organizationInvitations.accepted_at),
          isNull(organizationInvitations.revoked_at),
          gt(organizationInvitations.expires_at, new Date())
        ));

      const totalSeats = (currentMembers.count || 0) + (pendingInvitations.count || 0);
      
      if (totalSeats >= org.seat_limit) {
        throw new Error('Seat limit reached. Please upgrade your plan or remove members.');
      }
    }

    // Check for existing active invitation
    const existingInvitation = await db
      .select()
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.org_id, orgId),
        eq(organizationInvitations.email, email.toLowerCase()),
        isNull(organizationInvitations.accepted_at),
        isNull(organizationInvitations.revoked_at),
        gt(organizationInvitations.expires_at, new Date())
      ))
      .limit(1);

    if (existingInvitation.length > 0) {
      throw new Error('An active invitation already exists for this email');
    }

    // Generate token
    const { token, tokenHash, tokenPrefix } = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

    // Create invitation
    const [invitation] = await db
      .insert(organizationInvitations)
      .values({
        org_id: orgId,
        email: email.toLowerCase(),
        role,
        inviter_user_id: inviterUserId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        expires_at: expiresAt,
      })
      .returning();

    // Send invitation email
    const acceptUrl = `${process.env.APP_URL || 'http://localhost:3000'}/invitations/${token}/accept`;
    
    await sendInvitationEmail({
      to: email,
      inviterName,
      orgName: org.name,
      role,
      acceptUrl,
      expiresAt,
    });

    return {
      id: invitation.id,
      token, // Only returned once
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expires_at,
    };
  },

  /**
   * List pending invitations for an organization
   */
  async listInvitations(orgId: string) {
    const invitations = await db
      .select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        inviter_user_id: organizationInvitations.inviter_user_id,
        created_at: organizationInvitations.created_at,
        expires_at: organizationInvitations.expires_at,
        token_prefix: organizationInvitations.token_prefix,
      })
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.org_id, orgId),
        isNull(organizationInvitations.accepted_at),
        isNull(organizationInvitations.revoked_at),
        gt(organizationInvitations.expires_at, new Date())
      ))
      .orderBy(organizationInvitations.created_at);

    return invitations;
  },

  /**
   * Revoke an invitation
   */
  async revokeInvitation(invitationId: string, orgId: string): Promise<void> {
    const result = await db
      .update(organizationInvitations)
      .set({ revoked_at: new Date() })
      .where(and(
        eq(organizationInvitations.id, invitationId),
        eq(organizationInvitations.org_id, orgId),
        isNull(organizationInvitations.accepted_at),
        isNull(organizationInvitations.revoked_at)
      ))
      .returning();

    if (result.length === 0) {
      throw new Error('Invitation not found or already processed');
    }
  },

  /**
   * Accept an invitation
   * Validates token, checks expiry, verifies email match, creates org membership
   */
  async acceptInvitation(token: string, userId: string, userEmail: string): Promise<{ orgId: string; role: string }> {
    const tokenHash = hashToken(token);

    // Find invitation
    const [invitation] = await db
      .select()
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.token_hash, tokenHash),
        isNull(organizationInvitations.accepted_at),
        isNull(organizationInvitations.revoked_at),
        gt(organizationInvitations.expires_at, new Date())
      ))
      .limit(1);

    if (!invitation) {
      throw new Error('Invalid or expired invitation token');
    }

    // Verify email match (case-insensitive)
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error('This invitation was sent to a different email address');
    }

    // Check if user is already a member
    const existingMember = await db
      .select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.org_id, invitation.org_id),
        eq(organizationUsers.user_id, userId)
      ))
      .limit(1);

    if (existingMember.length > 0) {
      throw new Error('You are already a member of this organization');
    }

    // Check seat limit one more time
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invitation.org_id))
      .limit(1);

    if (org?.seat_limit !== null) {
      const [currentMembers] = await db
        .select({ count: db.raw<number>('count(*)::int') })
        .from(organizationUsers)
        .where(and(
          eq(organizationUsers.org_id, invitation.org_id),
          eq(organizationUsers.status, 'active')
        ));

      if ((currentMembers.count || 0) >= org.seat_limit) {
        throw new Error('Organization has reached its seat limit');
      }
    }

    // Create organization membership
    await db.insert(organizationUsers).values({
      org_id: invitation.org_id,
      user_id: userId,
      role: invitation.role,
      status: 'active',
      invited_by_user_id: invitation.inviter_user_id,
      joined_at: new Date(),
      last_seen_at: new Date(),
    });

    // Mark invitation as accepted
    await db
      .update(organizationInvitations)
      .set({ accepted_at: new Date() })
      .where(eq(organizationInvitations.id, invitation.id));

    return {
      orgId: invitation.org_id,
      role: invitation.role,
    };
  },

  /**
   * Get invitation details by token (for preview before accepting)
   */
  async getInvitationByToken(token: string) {
    const tokenHash = hashToken(token);

    const result = await db
      .select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        org_id: organizationInvitations.org_id,
        org_name: organizations.name,
        expires_at: organizationInvitations.expires_at,
      })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizationInvitations.org_id, organizations.id))
      .where(and(
        eq(organizationInvitations.token_hash, tokenHash),
        isNull(organizationInvitations.accepted_at),
        isNull(organizationInvitations.revoked_at),
        gt(organizationInvitations.expires_at, new Date())
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  },
};
