import { Request, Response, NextFunction } from 'express';
import { auditLogStore } from '../../models/auditLogStore';
import { ErrorResponse } from '../../types/common.types';

interface AuditLogQueryParams {
  userId?: string;
  action?: string;
  status?: 'success' | 'failure' | 'blocked';
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

export default async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      userId,
      action,
      status,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query as AuditLogQueryParams;

    // Parse and validate pagination
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100); // Max 100
    const parsedOffset = parseInt(offset, 10) || 0;

    // Parse dates if provided
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid startDate format',
            details: [{ field: 'startDate', message: 'Must be a valid ISO 8601 date' }],
          },
        };
        res.status(422).json(errorResponse);
        return;
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        const errorResponse: ErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid endDate format',
            details: [{ field: 'endDate', message: 'Must be a valid ISO 8601 date' }],
          },
        };
        res.status(422).json(errorResponse);
        return;
      }
    }

    // Query audit logs
    const result = await auditLogStore.query({
      userId,
      action,
      status,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.status(200).json({
      data: result.logs,
      pagination: {
        total: result.total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + result.logs.length < result.total,
      },
    });
  } catch (error) {
    next(error);
  }
}
