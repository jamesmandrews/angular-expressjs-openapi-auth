import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types/common.types';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err);

  // Handle express-openapi-validator errors
  if (err.status) {
    const errorResponse: ErrorResponse = {
      error: {
        code: err.status === 400 ? 'BAD_REQUEST' : 'VALIDATION_ERROR',
        message: err.message || 'Validation error occurred',
        details: err.errors?.map((e: any) => ({
          field: e.path || e.instancePath?.replace(/^\//, '').replace(/\//g, '.') || 'unknown',
          message: e.message || e.errorCode || 'Validation failed',
        })),
      },
    };
    res.status(err.status).json(errorResponse);
    return;
  }

  // Handle generic errors
  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred while processing your request',
    },
  };

  res.status(500).json(errorResponse);
}

export function notFoundHandler(_req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: 'The requested resource could not be found',
    },
  };
  res.status(404).json(errorResponse);
}
