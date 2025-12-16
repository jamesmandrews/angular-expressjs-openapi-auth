import bcrypt from 'bcrypt';

const getSaltRounds = (): number => {
  const rounds = process.env.BCRYPT_SALT_ROUNDS;
  return rounds ? parseInt(rounds, 10) : 10;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, getSaltRounds());
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 16) {
    return { valid: false, message: 'Password must be at least 16 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}
