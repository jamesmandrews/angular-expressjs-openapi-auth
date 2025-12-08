import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // User must be authenticated AND not in 2FA pending state
  if (authService.isAuthenticated() && !authService.twoFactorPending()) {
    return true;
  }

  // If 2FA is pending, redirect to 2FA verification
  if (authService.twoFactorPending()) {
    router.navigate(['/2fa-verify']);
    return false;
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Allow access if not authenticated OR if 2FA is pending (mid-login flow)
  if (!authService.isAuthenticated() || authService.twoFactorPending()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

export const twoFactorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.twoFactorPending()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const emailVerifiedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Must be fully authenticated (not 2FA pending)
  if (!authService.isAuthenticated() || authService.twoFactorPending()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (user?.emailVerified) {
    return true;
  }

  router.navigate(['/verify-email-pending']);
  return false;
};

export const emailNotVerifiedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Must be fully authenticated (not 2FA pending)
  if (!authService.isAuthenticated() || authService.twoFactorPending()) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.currentUser();
  if (!user?.emailVerified) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
