import { Request, Response, NextFunction } from 'express';
import { organizationInviteStore } from '../../../models/organizationInviteStore';
import { ErrorResponse } from '../../../types/common.types';
import { noOrgError, checkOrgRole, orgRoleError } from '../../../middleware/org/orgAuth';

export default async function revokeInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const inviteId = req.params.id;

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

    // Get the invite to verify it belongs to this organization
    const invites = await organizationInviteStore.getByOrganization(organizationId);
    const invite = invites.find(i => i.id === inviteId);

    if (!invite) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVITE_NOT_FOUND',
          message: 'Invitation not found',
        },
      };
      res.status(404).json(errorResponse);
      return;
    }

    // Revoke the invite
    await organizationInviteStore.revoke(inviteId);

    res.status(200).json({
      message: 'Invitation revoked successfully',
    });
  } catch (error) {
    next(error);
  }
}
