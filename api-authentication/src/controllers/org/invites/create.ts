import { Request, Response, NextFunction } from 'express';
import { organizationInviteStore } from '../../../models/organizationInviteStore';
import { userStore } from '../../../models/userStore';
import { ErrorResponse } from '../../../types/common.types';
import { noOrgError, checkOrgRole, orgRoleError } from '../../../middleware/org/orgAuth';
import { emitEvent } from '../../../utils/events';

interface CreateInviteBody {
  email: string;
  role: 'admin' | 'member';
}

export default async function createInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;

    if (!userId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    if (!organizationId) {
      res.status(403).json(noOrgError);
      return;
    }

    // Check if user has admin or owner role
    if (!checkOrgRole(req, 'admin')) {
      res.status(403).json(orgRoleError('admin'));
      return;
    }

    const { email, role } = req.body as CreateInviteBody;

    // Validate role - only admin and member can be invited
    if (role !== 'admin' && role !== 'member') {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid role. Must be "admin" or "member"',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Can't invite someone who's already a member
    const existingUser = await userStore.getByEmail(email);
    if (existingUser?.organizationId === organizationId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'ALREADY_MEMBER',
          message: 'This user is already a member of your organization',
        },
      };
      res.status(409).json(errorResponse);
      return;
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await organizationInviteStore.existsForEmail(organizationId, email);
    if (existingInvite) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVITE_EXISTS',
          message: 'An invitation has already been sent to this email address',
        },
      };
      res.status(409).json(errorResponse);
      return;
    }

    // Create the invite
    const { invite, rawToken } = await organizationInviteStore.create(
      organizationId,
      email,
      role,
      userId
    );

    // Emit event (for audit and email notification via plugins)
    await emitEvent('org.member.invited', req, {
      organizationId,
      inviteId: invite.id,
      email,
      role,
      invitedBy: userId,
      // Include raw token for email link generation
      inviteToken: rawToken,
    });

    res.status(201).json({
      message: 'Invitation sent successfully',
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
