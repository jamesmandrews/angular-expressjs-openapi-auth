import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types/common.types';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err);

  // Handle express-openapi-validator errors
  if (err.status) {
    let code: string;
    let message: string;

    switch (err.status) {
      case 400:
        code = 'BAD_REQUEST';
        message = err.message || 'Bad request';
        break;
      case 401:
        code = 'UNAUTHORIZED';
        message = err.message || 'Authentication required';
        break;
      case 403:
        code = 'FORBIDDEN';
        message = err.message || 'Access denied';
        break;
      case 404:
        code = 'ROUTE_NOT_FOUND';
        message = `No route found for ${req.method} ${req.path}. Check the API documentation for available endpoints.`;
        break;
      case 405:
        code = 'METHOD_NOT_ALLOWED';
        message = `Method ${req.method} is not allowed for ${req.path}`;
        break;
      case 415:
        code = 'UNSUPPORTED_MEDIA_TYPE';
        message = err.message || 'Unsupported content type';
        break;
      default:
        code = 'VALIDATION_ERROR';
        message = err.message || 'Validation error occurred';
    }

    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
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
