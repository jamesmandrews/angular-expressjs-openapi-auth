import { Request, Response, NextFunction } from 'express';
import { organizationStore } from '../../../models/organizationStore';
import { userStore } from '../../../models/userStore';
import { ErrorResponse } from '../../../types/common.types';
import { noOrgError } from '../../../middleware/org/orgAuth';
import { emitEvent } from '../../../utils/events';
import { OrganizationRole } from '../../../types/auth.types';

interface UpdateMemberBody {
  role: 'admin' | 'member';
}

export default async function updateMember(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const { role: newRole } = req.body as UpdateMemberBody;

    // Validate new role
    if (newRole !== 'admin' && newRole !== 'member') {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid role. Must be "admin" or "member"',
        },
      };
      res.status(400).json(errorResponse);
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

    // Can't change the owner's role
    if (targetMember.role === 'owner') {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'CANNOT_MODIFY_OWNER',
          message: 'Cannot change the owner\'s role',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    // Authorization rules:
    // - Owner can change any member's role to admin or member
    // - Admin can only change member's role (not other admin's)
    if (userRole === 'owner') {
      // Owner can do anything
    } else if (userRole === 'admin') {
      // Admin can only modify members
      if (targetMember.role === 'admin') {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only the owner can modify admin roles',
          },
        };
        res.status(403).json(errorResponse);
        return;
      }
    } else {
      // Members can't modify anyone
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to modify member roles',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    // Update the role
    await organizationStore.updateMemberRole(targetUserId, newRole as OrganizationRole);

    // Invalidate target user's tokens by regenerating their token salt
    // This forces them to re-login and get fresh claims with the new role
    await userStore.regenerateTokenSalt(targetUserId);

    // Emit event
    await emitEvent('org.member.updated', req, {
      organizationId,
      targetUserId,
      previousRole: targetMember.role,
      newRole,
      updatedBy: userId,
    });

    res.status(200).json({
      message: 'Member role updated successfully',
      data: {
        userId: targetUserId,
        role: newRole,
      },
    });
  } catch (error) {
    next(error);
  }
}
