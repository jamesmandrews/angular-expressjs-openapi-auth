import { Request, Response, NextFunction } from 'express';
import { organizationInviteStore } from '../../../models/organizationInviteStore';
import { ErrorResponse } from '../../../types/common.types';
import { noOrgError, checkOrgRole, orgRoleError } from '../../../middleware/org/orgAuth';

export default async function listInvites(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Get pending invites for the organization
    const invites = await organizationInviteStore.getByOrganization(organizationId);

    res.status(200).json({
      data: invites.map(invite => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        invitedBy: invite.invitedBy,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}
