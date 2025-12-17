import { Request, Response, NextFunction } from 'express';
import { organizationStore } from '../../models/organizationStore';
import { ErrorResponse } from '../../types/common.types';
import { noOrgError } from '../../middleware/org/orgAuth';

export default async function getOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      res.status(404).json(noOrgError);
      return;
    }

    // Get organization details
    const org = await organizationStore.getById(organizationId);
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

    // Get members
    const members = await organizationStore.getMembers(organizationId);

    res.status(200).json({
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        ownerId: org.ownerId,
        role: req.user?.organizationRole,
        members: members.map(m => ({
          userId: m.userId,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
