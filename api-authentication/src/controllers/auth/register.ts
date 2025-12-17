import { Request, Response, NextFunction } from 'express';
import { userStore } from '../../models/userStore';
import { emailVerificationTokenStore } from '../../models/tokenStore';
import { refreshTokenStore } from '../../models/refreshTokenStore';
import { roleStore, ROLE_IDS } from '../../models/roleStore';
import { scopeStore } from '../../models/scopeStore';
import { organizationStore } from '../../models/organizationStore';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { generateAccessToken } from '../../utils/jwt';
import { setRefreshTokenCookie, getClientIp, getUserAgent } from '../../utils/cookies';
import { RegisterRequest, toUserPublic } from '../../types/auth.types';
import { ErrorResponse } from '../../types/common.types';
import logger from '../../utils/logger';
import { getUserTypeConfig, getRoleForUserType, isAllowedUserType } from '../../config/userTypes';
import { emitEvent, emitBlockingEvent } from '../../utils/events';

const isOrganizationsEnabled = (): boolean => {
  return process.env.ORGANIZATIONS_ENABLED === 'true';
};

const getVerificationUrl = (): string => {
  return process.env.EMAIL_VERIFICATION_URL || 'http://localhost:4200/verify-email';
};

export default async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, firstName, lastName, userType, organizationName }: RegisterRequest = req.body;

    // Validate organization name if provided but organizations are disabled
    if (organizationName && !isOrganizationsEnabled()) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'ORGANIZATIONS_DISABLED',
          message: 'Organization creation is not enabled',
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

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

    // Emit pre-registration event (allows plugins to block registration)
    const beforeResult = await emitBlockingEvent('auth.register.before', req, {
      email,
      firstName,
      lastName,
      userType: effectiveType,
      organizationName,
    });

    if (beforeResult.blocked) {
      const errorResponse: ErrorResponse = {
        error: {
          code: beforeResult.code || 'REGISTRATION_BLOCKED',
          message: beforeResult.error || 'Registration blocked by policy',
        },
      };
      res.status(403).json(errorResponse);
      return;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await userStore.create({ email, password, firstName, lastName }, passwordHash);

    // Create organization if name provided and feature is enabled
    let organization = undefined;
    if (organizationName && isOrganizationsEnabled()) {
      organization = await organizationStore.create(organizationName, user.id);
      logger.info(`Organization created: ${organization.name} (${organization.id}) for user ${user.id}`);

      // Emit organization created event
      await emitEvent('org.created', req, {
        organizationId: organization.id,
        organizationName: organization.name,
        ownerId: user.id,
      });

      // Re-fetch user to get updated org fields
      const updatedUser = await userStore.getById(user.id);
      if (updatedUser) {
        Object.assign(user, updatedUser);
      }
    }

    // Assign role based on user type
    const roleName = getRoleForUserType(effectiveType);
    const assigned = await roleStore.assignRoleByName(user.id, roleName!);
    if (!assigned) {
      // Role doesn't exist in database - configuration error, fall back to 'user' role
      logger.error(`Role '${roleName}' not found for user type '${effectiveType}', falling back to 'user'`);
      await roleStore.assignRole(user.id, ROLE_IDS.USER);
    }

    // Create verification token
    const verificationToken = await emailVerificationTokenStore.create(user.id);
    const verificationUrl = `${getVerificationUrl()}?token=${verificationToken.rawToken}`;

    // Get user roles and scopes
    const userRoles = await roleStore.getUserRoles(user.id);
    const roleNames = userRoles.map(r => r.name);
    const userScopes = await scopeStore.getUserScopes(user.id);

    // Generate access token with roles, scopes, and org info
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: roleNames,
      scopes: userScopes,
      jti: user.tokenSalt || undefined,
      organizationId: user.organizationId,
      organizationRole: user.organizationRole,
    });
    const expiresIn = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '900', 10);

    // Create refresh token and set in HttpOnly cookie
    const refreshToken = await refreshTokenStore.create(user.id, {
      userAgent: getUserAgent(req),
      ipAddress: getClientIp(req),
    });
    setRefreshTokenCookie(res, refreshToken.rawToken);

    // Emit plugin event (audit + email handled via plugins)
    await emitEvent('auth.register', req, {
      email: user.email,
      userId: user.id,
      userType: effectiveType,
      roles: roleNames,
      verificationUrl,
      organizationId: organization?.id,
      organizationName: organization?.name,
    });

    res.status(201).json({
      data: {
        user: toUserPublic(user, roleNames, userScopes, false),
        tokens: {
          accessToken: token,
          expiresIn,
          tokenType: 'Bearer',
        },
      },
      message: organizationName
        ? 'Registration successful. Organization created. Please check your email to verify your account.'
        : 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    next(error);
  }
}
