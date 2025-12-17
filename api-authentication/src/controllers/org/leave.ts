import { Request, Response, NextFunction } from 'express';
import { organizationStore } from '../../models/organizationStore';
import { userStore } from '../../models/userStore';
import { ErrorResponse } from '../../types/common.types';
import { noOrgError } from '../../middleware/org/orgAuth';
import { emitEvent } from '../../utils/events';

export default async function leaveOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const userRole = req.user?.organizationRole;

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

    // Owner cannot leave - must transfer ownership or delete org
    if (userRole === 'owner') {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'OWNER_CANNOT_LEAVE',
          message: 'Organization owners cannot leave. Transfer ownership or delete the organization instead.',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    // Remove the member
    await organizationStore.removeMember(userId);

    // Invalidate user's tokens by regenerating their token salt
    // This forces them to re-login and get fresh claims without org membership
    await userStore.regenerateTokenSalt(userId);

    // Emit event
    await emitEvent('org.member.removed', req, {
      organizationId,
      targetUserId: userId,
      targetRole: userRole,
      removedBy: userId,
      isSelf: true,
    });

    res.status(200).json({
      message: 'You have left the organization',
    });
  } catch (error) {
    next(error);
  }
}
