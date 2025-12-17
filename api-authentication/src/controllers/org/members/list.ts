import { Request, Response, NextFunction } from 'express';
import { organizationStore } from '../../../models/organizationStore';
import { ErrorResponse } from '../../../types/common.types';
import { noOrgError } from '../../../middleware/org/orgAuth';

export default async function listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Any member can view the member list
    const members = await organizationStore.getMembers(organizationId);

    res.status(200).json({
      data: members.map(m => ({
        userId: m.userId,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}
