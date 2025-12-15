import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { emailVerificationTokenStore } from '../../models/tokenStore';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { roleStore, ROLE_IDS } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { generateAccessToken } from '../../utils/jwt';
import { setRefreshTokenCookie, getClientIp, getUserAgent } from '../../utils/cookies';
import { RegisterRequest, toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import { getEmailProvider } from '../../email';
import logger from '../../utils/logger';
import { getUserTypeConfig, getRoleForUserType, isAllowedUserType } from '../../config/userTypes';
import { audit } from '../../utils/auditLogger';

const getVerificationUrl = (): string => {
  return process.env.EMAIL_VERIFICATION_URL || 'http://localhost:4200/verify-email';
};

export default async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, firstName, lastName, userType }: RegisterRequest = req.body;

    // Determine effective user type (default to 'user')
    const config = getUserTypeConfig();
    const effectiveType = userType || config.defaultType;

    // Validate user type is allowed
    if (!isAllowedUserType(effectiveType)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_USER_TYPE',
          message: `Invalid user type: ${effectiveType}. Allowed types: ${config.allowedTypes.join(', ')}`,
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Check if email already exists
    if (await userStore.emailExists(email)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EMAIL_EXISTS',
          message: 'A user with this email address already exists',
        },
      };
      res.status(409).json(errorResponse);
      return;
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: passwordValidation.message || 'Password does not meet requirements',
          details: [{ field: 'password', message: passwordValidation.message || 'Invalid password' }],
        },
      };
      res.status(422).json(errorResponse);
      return;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await userStore.create({ email, password, firstName, lastName }, passwordHash);

    // Assign role based on user type
    const roleName = getRoleForUserType(effectiveType);
    const assigned = await roleStore.assignRoleByName(user.id, roleName!);
    if (!assigned) {
      // Role doesn't exist in database - configuration error, fall back to 'user' role
      logger.error(`Role '${roleName}' not found for user type '${effectiveType}', falling back to 'user'`);
      await roleStore.assignRole(user.id, ROLE_IDS.USER);
    }

    // Create verification token and send email
    const verificationToken = await emailVerificationTokenStore.create(user.id);
    const verificationUrl = `${getVerificationUrl()}?token=${verificationToken.rawToken}`;

    const emailProvider = getEmailProvider();
    const result = await emailProvider.send({
      to: email,
      subject: 'Verify Your Email Address',
      text: `Welcome! Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.`,
      html: `
        <h2>Welcome!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not create an account, please ignore this email.</p>
      `,
    });

    if (!result.success) {
      logger.error(`Failed to send verification email to ${email}`, { error: result.error });
    }

    // Get user roles and scopes
    const userRoles = await roleStore.getUserRoles(user.id);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(user.id);

    // Generate access token with roles and scopes
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: roleNames,
      scopes: userScopes,
      jti: user.tokenSalt || undefined,
    });
    const expiresIn = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '900', 10);

    // Create refresh token and set in HttpOnly cookie
    const refreshToken = await refreshTokenStore.create(user.id, {
      userAgent: getUserAgent(req),
      ipAddress: getClientIp(req),
    });
    setRefreshTokenCookie(res, refreshToken.rawToken);

    // Audit successful registration
    await audit.register(req, user.id, user.email, effectiveType);

    res.status(201).json({
      data: {
        user: toUserPublic(user, roleNames, userScopes, false),
        tokens: {
          accessToken: token,
          expiresIn,
          tokenType: 'Bearer',
        },
      },
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    next(error);
  }
}
