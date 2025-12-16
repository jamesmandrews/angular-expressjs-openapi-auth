/**
 * Email Utilities
 *
 * Functions for normalizing and canonicalizing email addresses.
 */

/**
 * Gmail and Google-hosted domains that support dot-ignoring and plus-aliasing
 */
const GOOGLE_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
]);

/**
 * Domains known to support plus-aliasing (but not dot-ignoring)
 * Kept for reference - we apply plus-alias removal to all domains
 */
// const PLUS_ALIAS_DOMAINS = [
//   'outlook.com', 'hotmail.com', 'live.com',
//   'yahoo.com', 'protonmail.com', 'proton.me',
//   'icloud.com', 'fastmail.com',
// ];

/**
 * Canonicalize an email address for duplicate detection
 *
 * This normalizes email addresses to detect when the same person
 * registers with variations of their email:
 *
 * For Gmail/Googlemail:
 *   - Removes dots from local part (j.o.h.n@gmail.com → john@gmail.com)
 *   - Removes plus aliases (john+test@gmail.com → john@gmail.com)
 *   - Normalizes googlemail.com to gmail.com
 *
 * For other known providers (Outlook, Yahoo, etc.):
 *   - Removes plus aliases only
 *
 * For unknown domains:
 *   - Removes plus aliases (conservative approach)
 *
 * All emails are lowercased.
 *
 * @param email - The email address to canonicalize
 * @returns The canonical form of the email
 *
 * @example
 * canonicalizeEmail('John.Doe+test@Gmail.com') // 'johndoe@gmail.com'
 * canonicalizeEmail('user+alias@outlook.com')  // 'user@outlook.com'
 * canonicalizeEmail('User@Example.com')        // 'user@example.com'
 */
export function canonicalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return email;
  }

  // Lowercase the entire email
  const lowered = email.toLowerCase().trim();

  // Split into local part and domain
  const atIndex = lowered.lastIndexOf('@');
  if (atIndex === -1) {
    return lowered; // Invalid email, return as-is
  }

  let localPart = lowered.substring(0, atIndex);
  let domain = lowered.substring(atIndex + 1);

  // Normalize googlemail.com to gmail.com
  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  // Remove plus alias from local part
  const plusIndex = localPart.indexOf('+');
  if (plusIndex !== -1) {
    localPart = localPart.substring(0, plusIndex);
  }

  // For Google domains, also remove dots from local part
  if (GOOGLE_DOMAINS.has(domain)) {
    localPart = localPart.replace(/\./g, '');
  }

  return `${localPart}@${domain}`;
}

/**
 * Check if two email addresses are canonically equivalent
 *
 * @param email1 - First email address
 * @param email2 - Second email address
 * @returns True if the emails have the same canonical form
 *
 * @example
 * areEmailsEquivalent('john+a@gmail.com', 'j.o.h.n+b@gmail.com') // true
 * areEmailsEquivalent('john@gmail.com', 'john@yahoo.com')        // false
 */
export function areEmailsEquivalent(email1: string, email2: string): boolean {
  return canonicalizeEmail(email1) === canonicalizeEmail(email2);
}

/**
 * Extract the base email (without plus alias) while preserving dots
 *
 * This is less aggressive than canonicalize - it only removes the plus alias
 * without touching dots. Useful for displaying a "cleaned" email to users.
 *
 * @param email - The email address
 * @returns The email without plus alias
 *
 * @example
 * stripPlusAlias('john.doe+test@gmail.com') // 'john.doe@gmail.com'
 */
export function stripPlusAlias(email: string): string {
  if (!email || typeof email !== 'string') {
    return email;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return email;
  }

  let localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1);

  const plusIndex = localPart.indexOf('+');
  if (plusIndex !== -1) {
    localPart = localPart.substring(0, plusIndex);
  }

  return `${localPart}@${domain}`;
}

/**
 * Check if an email contains a plus alias
 *
 * @param email - The email address to check
 * @returns True if the email contains a plus alias
 */
export function hasPlusAlias(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return false;
  }

  const localPart = email.substring(0, atIndex);
  return localPart.includes('+');
}
