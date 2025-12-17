import { Request, Response, NextFunction } from 'express';
import { organizationStore } from '../../models/organizationStore';
import { ErrorResponse } from '../../types/common.types';
import { noOrgError, checkOrgRole, orgRoleError } from '../../middleware/org/orgAuth';
import { emitEvent } from '../../utils/events';

interface UpdateOrgBody {
  name?: string;
}

export default async function updateOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const { name } = req.body as UpdateOrgBody;

    if (!name) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Update organization
    const org = await organizationStore.update(organizationId, { name });

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

    // Emit event
    await emitEvent('org.updated', req, {
      organizationId: org.id,
      updatedBy: userId,
      changes: { name },
    });

    res.status(200).json({
      message: 'Organization updated successfully',
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        ownerId: org.ownerId,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
