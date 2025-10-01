/**
 * Invitation API Routes
 * Handles organization invitation endpoints
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as invitationService from './invitation-service';
import { requireUserAuth } from './auth';
import { requireOrgRole } from './auth/permissions';
import { isFeatureEnabled } from './feature-flags';
import { emailService } from './email-service';

const router = Router();

// Validation schemas
const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(64).max(64), // 32 bytes = 64 hex chars
});

// Middleware to check feature flag
const requireOrgsFeature = (req: Request, res: Response, next: Function) => {
  if (!isFeatureEnabled('organizations')) {
    return res.status(503).json({
      error: 'Organizations feature is not yet available',
      code: 'FEATURE_NOT_AVAILABLE',
    });
  }
  next();
};

/**
 * POST /api/orgs/:orgId/invitations
 * Create a new invitation (admin only)
 */
router.post('/orgs/:orgId/invitations', requireUserAuth, requireOrgsFeature, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const input = createInvitationSchema.parse(req.body);
    
    // Create invitation
    const { invitation, token } = await invitationService.createInvitation({
      orgId,
      email: input.email,
      role: input.role,
      invitedByUserId: req.user!.id,
    });

    // Get organization details for email
    const details = await invitationService.getInvitationDetails(token);
    
    if (details) {
      // Send invitation email
      const baseUrl = process.env.EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
      const inviteUrl = `${baseUrl}/invite/${token}`;
      
      try {
        await emailService.sendOrganizationInvitation({
          to: input.email,
          organizationName: details.organization.name,
          inviterName: details.inviter?.email || 'A team member',
          role: input.role,
          invitationUrl: inviteUrl, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        
        console.log(`✅ Invitation email sent to ${input.email}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't fail the invitation creation if email fails
      }
    }

    // Return invitation without token (already sent via email)
    res.status(201).json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating invitation:', error);
    
    if (error.message?.includes('already a member')) {
      return res.status(409).json({ error: error.message, code: 'ALREADY_MEMBER' });
    }
    
    if (error.message?.includes('pending invitation')) {
      return res.status(409).json({ error: error.message, code: 'INVITATION_EXISTS' });
    }
    
    if (error.message?.includes('seat limit')) {
      return res.status(402).json({ error: error.message, code: 'SEAT_LIMIT_REACHED' });
    }
    
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

/**
 * GET /api/orgs/:orgId/invitations
 * List pending invitations for an organization
 */
router.get('/orgs/:orgId/invitations', requireUserAuth, requireOrgsFeature, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    
    const invitations = await invitationService.listOrganizationInvitations(orgId);
    
    res.json({
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error listing invitations:', error);
    res.status(500).json({ error: 'Failed to list invitations' });
  }
});

/**
 * DELETE /api/orgs/:orgId/invitations/:invitationId
 * Revoke an invitation (admin only)
 */
router.delete('/orgs/:orgId/invitations/:invitationId', requireUserAuth, requireOrgsFeature, requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    
    await invitationService.revokeInvitation(invitationId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error revoking invitation:', error);
    
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message, code: 'INVITATION_NOT_FOUND' });
    }
    
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

/**
 * GET /api/invitations/:token
 * Get invitation details by token (no auth required - for accepting invites)
 */
router.get('/invitations/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const details = await invitationService.getInvitationDetails(token);
    
    if (!details) {
      return res.status(404).json({
        error: 'Invitation not found or expired',
        code: 'INVITATION_NOT_FOUND',
      });
    }
    
    res.json({
      organization: {
        name: details.organization.name,
        slug: details.organization.slug,
      },
      role: details.invitation.role,
      email: details.invitation.email,
      expiresAt: details.invitation.expiresAt,
    });
  } catch (error: any) {
    console.error('Error getting invitation details:', error);
    res.status(500).json({ error: 'Failed to get invitation details' });
  }
});

/**
 * POST /api/invitations/:token/accept
 * Accept an invitation (requires auth)
 */
router.post('/invitations/:token/accept', requireUserAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const userId = req.user!.id;
    
    const result = await invitationService.acceptInvitation({
      token,
      userId,
    });
    
    res.json({
      success: true,
      orgId: result.orgId,
      role: result.role,
      message: 'Successfully joined the organization',
    });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    
    if (error.message?.includes('Invalid or expired')) {
      return res.status(404).json({ error: error.message, code: 'INVITATION_NOT_FOUND' });
    }
    
    if (error.message?.includes('different email')) {
      return res.status(403).json({ error: error.message, code: 'EMAIL_MISMATCH' });
    }
    
    if (error.message?.includes('already a member')) {
      return res.status(409).json({ error: error.message, code: 'ALREADY_MEMBER' });
    }
    
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

export default router;
