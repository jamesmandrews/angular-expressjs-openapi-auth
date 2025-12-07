import { randomBytes } from 'crypto';

// Base62 alphabet (alphanumeric, URL-safe)
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);

/**
 * Generates a short, URL-safe unique ID
 * Uses 16 bytes of randomness (same entropy as UUID v4)
 * Encodes to base62, resulting in ~22 character string
 */
export function generateShortId(): string {
  const bytes = randomBytes(16);
  let num = BigInt('0x' + bytes.toString('hex'));

  let result = '';
  while (num > 0) {
    result = ALPHABET[Number(num % BASE)] + result;
    num = num / BASE;
  }

  // Pad to ensure consistent length
  return result.padStart(22, '0');
}

/**
 * Validates that a string is a valid short ID format
 */
export function isValidShortId(id: string): boolean {
  if (id.length !== 22) return false;
  for (const char of id) {
    if (!ALPHABET.includes(char)) return false;
  }
  return true;
}
