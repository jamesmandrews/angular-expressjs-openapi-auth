export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userType: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  roles: string[];
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: {
    user: User;
    tokens: AuthTokens;
    twoFactorRequired?: boolean;
  };
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
}

export interface RegisterResponse {
  data: {
    user: User;
    tokens: AuthTokens;
  };
  message: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorSetupResponse {
  data: {
    secret: string;
    otpAuthUri: string;
    qrCode: string;
  };
  message: string;
}

export interface TwoFactorVerifySetupResponse {
  data: {
    backupCodes: string[];
  };
  message: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
