/**
 * User Type Registration Configuration
 *
 * Maps user types to their default roles during registration.
 * Configured via USER_TYPE_ROLES environment variable.
 *
 * Format: type:role,type:role,...
 * Example: USER_TYPE_ROLES=user:user,store_owner:store_owner,merchant:merchant
 */

export interface UserTypeConfig {
  allowedTypes: string[];
  typeToRole: Map<string, string>;
  defaultType: string;
}

/**
 * Parse USER_TYPE_ROLES environment variable into configuration
 */
export function getUserTypeConfig(): UserTypeConfig {
  const config = process.env.USER_TYPE_ROLES || 'user:user';
  const entries = config.split(',').map(entry => {
    const [type, role] = entry.trim().split(':');
    return [type, role] as [string, string];
  });

  return {
    allowedTypes: entries.map(([type]) => type),
    typeToRole: new Map(entries),
    defaultType: 'user',
  };
}

/**
 * Get the role name for a given user type
 */
export function getRoleForUserType(userType: string): string | null {
  const config = getUserTypeConfig();
  return config.typeToRole.get(userType) || null;
}

/**
 * Check if a user type is allowed for registration
 */
export function isAllowedUserType(userType: string): boolean {
  const config = getUserTypeConfig();
  return config.allowedTypes.includes(userType);
}
