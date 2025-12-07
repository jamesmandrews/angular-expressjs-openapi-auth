import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
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

  if (!authService.isAuthenticated()) {
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

  if (!authService.isAuthenticated()) {
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
