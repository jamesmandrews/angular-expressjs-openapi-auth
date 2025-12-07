export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  roles: string[];
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  userType?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthResponse {
  data: {
    user: UserPublic;
    tokens: TokenResponse;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  roles: string[];
  scopes: string[];
  iat: number;
  exp: number;
}

export function toUserPublic(user: User, roles: string[] = [], scopes: string[] = []): UserPublic {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerified,
    roles,
    scopes,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
