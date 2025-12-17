import { Request, Response, NextFunction } from 'express';
import { organizationInviteStore } from '../../../models/organizationInviteStore';
import { organizationStore } from '../../../models/organizationStore';
import { userStore } from '../../../models/userStore';
import { ErrorResponse } from '../../../types/common.types';
import { emitEvent } from '../../../utils/events';

interface AcceptInviteBody {
  token: string;
}

export default async function acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { token } = req.body as AcceptInviteBody;

    if (!userId || !userEmail) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Check if user already belongs to an organization
    if (req.user?.organizationId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'ALREADY_IN_ORGANIZATION',
          message: 'You must leave your current organization before joining another',
        },
      };
      res.status(409).json(errorResponse);
      return;
    }

    // Verify the invite token
    const invite = await organizationInviteStore.getByToken(token);

    if (!invite) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_INVITE',
          message: 'Invalid or expired invitation',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Verify the email matches
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EMAIL_MISMATCH',
          message: 'This invitation was sent to a different email address',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    // Check if invite is expired
    if (new Date() > invite.expiresAt) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVITE_EXPIRED',
          message: 'This invitation has expired',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Get the organization
    const org = await organizationStore.getById(invite.organizationId);
    if (!org) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Add user to organization
    const memberAdded = await organizationStore.addMember(invite.organizationId, userId, invite.role);

    if (!memberAdded) {
      // User might have joined another org after their JWT was issued (race condition)
      const errorResponse: ErrorResponse = {
        error: {
          code: 'ALREADY_IN_ORGANIZATION',
          message: 'You are already a member of an organization. Leave your current organization first.',
        },
      };
      res.status(409).json(errorResponse);
      return;
    }

    // Mark invite as accepted
    await organizationInviteStore.markAccepted(invite.id);

    // Get updated user data
    const updatedUser = await userStore.getById(userId);

    // Emit event
    await emitEvent('org.member.joined', req, {
      organizationId: invite.organizationId,
      userId,
      email: userEmail,
      role: invite.role,
      inviteId: invite.id,
    });

    res.status(200).json({
      message: 'Successfully joined the organization',
      data: {
        organizationId: org.id,
        organizationName: org.name,
        role: invite.role,
        user: updatedUser ? {
          organizationId: updatedUser.organizationId,
          organizationRole: updatedUser.organizationRole,
        } : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
}
