import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  twoFactorGuard,
  emailVerifiedGuard,
  emailNotVerifiedGuard,
} from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: '2fa-verify',
    loadComponent: () =>
      import('./features/auth/two-factor-verify/two-factor-verify.component').then(
        (m) => m.TwoFactorVerifyComponent
      ),
    canActivate: [twoFactorGuard],
  },
  {
    path: 'verify-email-pending',
    loadComponent: () =>
      import('./features/auth/verify-email-pending/verify-email-pending.component').then(
        (m) => m.VerifyEmailPendingComponent
      ),
    canActivate: [emailNotVerifiedGuard],
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent
      ),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [emailVerifiedGuard],
  },
  {
    path: 'account',
    canActivate: [emailVerifiedGuard],
    children: [
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/settings/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'profile/edit',
        loadComponent: () =>
          import('./features/settings/profile-edit/profile-edit.component').then(
            (m) => m.ProfileEditComponent
          ),
      },
      {
        path: 'password',
        loadComponent: () =>
          import('./features/settings/password/password.component').then((m) => m.PasswordComponent),
      },
      {
        path: '2fa',
        loadComponent: () =>
          import('./features/settings/two-factor-setup/two-factor-setup.component').then(
            (m) => m.TwoFactorSetupComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
