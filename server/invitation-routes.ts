import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { invitationService } from './invitation-service';
import { featureFlags } from './feature-flags';

const router = Router();

// Validation schemas
const createInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer'], {
    errorMap: () => ({ message: 'Role must be admin, member, or viewer' }),
  }),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

/**
 * POST /api/orgs/:orgId/invitations
 * Create a new invitation
 * Requires: org admin role, Business+ tier
 */
router.post('/orgs/:orgId/invitations', async (req: Request, res: Response) => {
  try {
    // Feature flag check
    if (!featureFlags.isEnabled('orgs')) {
      return res.status(403).json({
        error: 'Organizations feature is not available',
        code: 'FEATURE_DISABLED',
      });
    }

    // Authentication check (assumes auth middleware sets req.user)
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { orgId } = req.params;

    // Organization context check (assumes middleware sets req.orgContext)
    if (!req.orgContext || req.orgContext.orgId !== orgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    // Role check - only admins can invite
    if (req.orgContext.role !== 'admin') {
      return res.status(403).json({
        error: 'Only organization admins can send invitations',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    // Subscription tier check
    if (!featureFlags.hasSubscriptionAccess(req.orgContext.tier)) {
      return res.status(402).json({
        error: 'Organization features require Business tier or higher',
        code: 'UPGRADE_REQUIRED',
        upgrade_url: '/settings/billing',
      });
    }

    // Validate request body
    const validation = createInvitationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
    }

    const { email, role } = validation.data;

    // Rate limiting check (simple per-org throttle)
    // TODO: Implement proper rate limiting with Redis
    const recentInvitations = await invitationService.listInvitations(orgId);
    const recentCount = recentInvitations.filter(
      (inv) => new Date(inv.created_at).getTime() > Date.now() - 60 * 60 * 1000
    ).length;
    
    if (recentCount >= 10) {
      return res.status(429).json({
        error: 'Too many invitations sent. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    const result = await invitationService.createInvitation({
      orgId,
      email,
      role,
      inviterUserId: req.user.id,
      inviterName: req.user.name || req.user.email,
    });

    // Return invitation without exposing the full token
    return res.status(201).json({
      id: result.id,
      email: result.email,
      role: result.role,
      expires_at: result.expiresAt,
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('Error creating invitation:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error) {
      if (error.message.includes('Seat limit reached')) {
        return res.status(402).json({
          error: error.message,
          code: 'SEAT_LIMIT_REACHED',
          upgrade_url: '/settings/billing',
        });
      }
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: error.message,
          code: 'DUPLICATE_INVITATION',
        });
      }
    }

    return res.status(500).json({
      error: 'Failed to create invitation',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/orgs/:orgId/invitations
 * List pending invitations
 * Requires: org admin role
 */
router.get('/orgs/:orgId/invitations', async (req: Request, res: Response) => {
  try {
    if (!featureFlags.isEnabled('orgs')) {
      return res.status(403).json({
        error: 'Organizations feature is not available',
        code: 'FEATURE_DISABLED',
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { orgId } = req.params;

    if (!req.orgContext || req.orgContext.orgId !== orgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    // Only admins can view invitations
    if (req.orgContext.role !== 'admin') {
      return res.status(403).json({
        error: 'Only organization admins can view invitations',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const invitations = await invitationService.listInvitations(orgId);

    return res.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        inviter_user_id: inv.inviter_user_id,
        created_at: inv.created_at,
        expires_at: inv.expires_at,
        // Include token prefix for admin reference only
        token_prefix: inv.token_prefix,
      })),
    });
  } catch (error) {
    console.error('Error listing invitations:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({
      error: 'Failed to list invitations',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/orgs/:orgId/invitations/:invitationId
 * Revoke an invitation
 * Requires: org admin role
 */
router.delete('/orgs/:orgId/invitations/:invitationId', async (req: Request, res: Response) => {
  try {
    if (!featureFlags.isEnabled('orgs')) {
      return res.status(403).json({
        error: 'Organizations feature is not available',
        code: 'FEATURE_DISABLED',
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { orgId, invitationId } = req.params;

    if (!req.orgContext || req.orgContext.orgId !== orgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
    }

    if (req.orgContext.role !== 'admin') {
      return res.status(403).json({
        error: 'Only organization admins can revoke invitations',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    await invitationService.revokeInvitation(invitationId, orgId);

    return res.json({
      message: 'Invitation revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking invitation:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Invitation not found',
        code: 'NOT_FOUND',
      });
    }

    return res.status(500).json({
      error: 'Failed to revoke invitation',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/invitations/:token
 * Get invitation details (public endpoint for preview)
 */
router.get('/invitations/:token', async (req: Request, res: Response) => {
  try {
    if (!featureFlags.isEnabled('orgs')) {
      return res.status(403).json({
        error: 'Organizations feature is not available',
        code: 'FEATURE_DISABLED',
      });
    }

    const { token } = req.params;

    const invitation = await invitationService.getInvitationByToken(token);

    if (!invitation) {
      return res.status(404).json({
        error: 'Invitation not found or expired',
        code: 'INVALID_TOKEN',
      });
    }

    return res.json({
      email: invitation.email,
      role: invitation.role,
      org_name: invitation.org_name,
      expires_at: invitation.expires_at,
    });
  } catch (error) {
    console.error('Error getting invitation:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({
      error: 'Failed to get invitation',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/invitations/:token/accept
 * Accept an invitation
 * Requires: authentication, email match
 */
router.post('/invitations/:token/accept', async (req: Request, res: Response) => {
  try {
    if (!featureFlags.isEnabled('orgs')) {
      return res.status(403).json({
        error: 'Organizations feature is not available',
        code: 'FEATURE_DISABLED',
      });
    }

    if (!req.user?.id || !req.user?.email) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { token } = req.params;

    const result = await invitationService.acceptInvitation(
      token,
      req.user.id,
      req.user.email
    );

    return res.json({
      message: 'Invitation accepted successfully',
      org_id: result.orgId,
      role: result.role,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid or expired')) {
        return res.status(404).json({
          error: error.message,
          code: 'INVALID_TOKEN',
        });
      }
      
      if (error.message.includes('different email')) {
        return res.status(403).json({
          error: error.message,
          code: 'EMAIL_MISMATCH',
        });
      }
      
      if (error.message.includes('already a member')) {
        return res.status(409).json({
          error: error.message,
          code: 'ALREADY_MEMBER',
        });
      }
      
      if (error.message.includes('seat limit')) {
        return res.status(402).json({
          error: error.message,
          code: 'SEAT_LIMIT_REACHED',
        });
      }
    }

    return res.status(500).json({
      error: 'Failed to accept invitation',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
