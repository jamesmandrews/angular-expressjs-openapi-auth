import { Request } from 'express';

export interface AuthResult {
  authenticated: boolean;
  user?: any;
  error?: string;
}

export interface AuthProvider {
  /**
   * Authenticate a request based on the security requirements
   * @param req - Express request object
   * @param securitySchemes - Array of security scheme names from OpenAPI (e.g., ['bearerAuth', 'apiKeyAuth'])
   * @returns AuthResult indicating whether authentication succeeded
   */
  authenticate(req: Request, securitySchemes: string[]): Promise<AuthResult>;
}
