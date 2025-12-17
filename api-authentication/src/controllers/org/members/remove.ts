import { Request, Response, NextFunction } from 'express';
import { organizationStore } from '../../../models/organizationStore';
import { userStore } from '../../../models/userStore';
import { ErrorResponse } from '../../../types/common.types';
import { noOrgError } from '../../../middleware/org/orgAuth';
import { emitEvent } from '../../../utils/events';

export default async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.organizationRole;
    const targetUserId = req.params.userId;

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

    // Get the target member
    const members = await organizationStore.getMembers(organizationId);
    const targetMember = members.find(m => m.userId === targetUserId);

    if (!targetMember) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found in your organization',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Can't remove the owner
    if (targetMember.role === 'owner') {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'CANNOT_REMOVE_OWNER',
          message: 'Cannot remove the organization owner',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    // Authorization rules:
    // - Owner can remove anyone except themselves
    // - Admin can remove members (not other admins)
    // - Member can remove themselves (leave)
    const isSelf = userId === targetUserId;

    if (isSelf) {
      // Anyone can remove themselves (leave)
    } else if (userRole === 'owner') {
      // Owner can remove anyone
    } else if (userRole === 'admin') {
      // Admin can only remove members
      if (targetMember.role === 'admin') {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only the owner can remove admins',
          },
        };
        res.status(403).json(errorResponse);
        return;
      }
    } else {
      // Members can only remove themselves
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to remove this member',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    // Remove the member
    await organizationStore.removeMember(targetUserId);

    // Invalidate target user's tokens by regenerating their token salt
    // This forces them to re-login and get fresh claims without org membership
    await userStore.regenerateTokenSalt(targetUserId);

    // Emit event
    await emitEvent('org.member.removed', req, {
      organizationId,
      targetUserId,
      targetRole: targetMember.role,
      removedBy: userId,
      isSelf,
    });

    res.status(200).json({
      message: isSelf ? 'You have left the organization' : 'Member removed successfully',
    });
  } catch (error) {
    next(error);
  }
}
