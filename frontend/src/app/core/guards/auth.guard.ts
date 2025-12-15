import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Helper to wait for session restoration before checking auth
 */
function waitForSessionRestoration(authService: AuthService) {
  return toObservable(authService.sessionRestoring).pipe(
    filter((restoring) => !restoring), // Wait until session restoration is complete
    take(1)
  );
}

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for session restoration, then check auth
  return waitForSessionRestoration(authService).pipe(
    map(() => {
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
    })
  );
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for session restoration, then check auth
  return waitForSessionRestoration(authService).pipe(
    map(() => {
      // Allow access if not authenticated OR if 2FA is pending (mid-login flow)
      if (!authService.isAuthenticated() || authService.twoFactorPending()) {
        return true;
      }

      router.navigate(['/dashboard']);
      return false;
    })
  );
};

export const twoFactorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for session restoration, then check 2FA state
  return waitForSessionRestoration(authService).pipe(
    map(() => {
      if (authService.twoFactorPending()) {
        return true;
      }

      router.navigate(['/login']);
      return false;
    })
  );
};

export const emailVerifiedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for session restoration, then check auth and email verification
  return waitForSessionRestoration(authService).pipe(
    map(() => {
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
    })
  );
};

export const emailNotVerifiedGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for session restoration, then check auth and email verification
  return waitForSessionRestoration(authService).pipe(
    map(() => {
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
    })
  );
};
