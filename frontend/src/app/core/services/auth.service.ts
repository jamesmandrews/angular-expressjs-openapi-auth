import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  AuthTokens,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  TwoFactorVerifyRequest,
  TwoFactorSetupResponse,
  TwoFactorVerifySetupResponse,
} from '../../shared/models/auth.model';

const USER_KEY = 'user';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly apiUrl = environment.apiUrl;

  // Token refresh configuration
  private readonly TOKEN_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
  private readonly REFRESH_THRESHOLD_PERCENT = 50; // Refresh after 50% of token lifetime
  private tokenRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private isRefreshing = false;

  // SECURITY: Access token stored in memory only, never in localStorage
  private accessToken: string | null = null;
  private sessionInitialized = false;

  // Signals for reactive state
  private currentUserSignal = signal<User | null>(this.getStoredUser());
  private isAuthenticatedSignal = signal<boolean>(false);
  private twoFactorPendingSignal = signal<boolean>(false);
  private sessionRestoringSignal = signal<boolean>(true);

  // Public computed signals
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.isAuthenticatedSignal());
  readonly twoFactorPending = computed(() => this.twoFactorPendingSignal());
  readonly sessionRestoring = computed(() => this.sessionRestoringSignal());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Defer session initialization to avoid circular dependency with Router/Guards
    // This runs after Angular's DI is fully set up
    setTimeout(() => this.initializeSession(), 0);
  }

  ngOnDestroy(): void {
    this.stopTokenRefreshWatcher();
  }

  /**
   * Initialize session by trying to refresh token from cookie
   * This restores the session after page reload
   */
  private initializeSession(): void {
    if (this.sessionInitialized) return;
    this.sessionInitialized = true;
    this.sessionRestoringSignal.set(true);

    // Try to get new access token from refresh token cookie
    this.refreshToken().subscribe({
      next: () => {
        // Session restored - fetch user profile
        this.getProfile().subscribe({
          next: () => {
            this.sessionRestoringSignal.set(false);
            this.startTokenRefreshWatcher();
          },
          error: () => {
            this.sessionRestoringSignal.set(false);
            this.clearAuthState();
          },
        });
      },
      error: () => {
        // No valid session - that's ok, user needs to login
        this.sessionRestoringSignal.set(false);
        this.clearAuthState();
      },
    });
  }

  // ==================== Authentication ====================

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials, { withCredentials: true }).pipe(
      tap((response: LoginResponse) => {
        if (response.data.twoFactorRequired) {
          this.setAccessToken(response.data.tokens.accessToken);
          this.twoFactorPendingSignal.set(true);
        } else {
          this.handleAuthSuccess(response.data.user, response.data.tokens);
        }
      })
    );
  }

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, data, { withCredentials: true }).pipe(
      tap((response: RegisterResponse) => {
        this.handleAuthSuccess(response.data.user, response.data.tokens);
      })
    );
  }

  logout(): void {
    const token = this.getAccessToken();
    if (token) {
      this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({
        complete: () => this.clearAuth(),
        error: () => this.clearAuth(),
      });
    } else {
      this.clearAuth();
    }
  }

  logoutAllDevices(): Observable<{ message: string; data: { sessionsRevoked: number } }> {
    return this.http.post<{ message: string; data: { sessionsRevoked: number } }>(
      `${this.apiUrl}/auth/logout-all`,
      {},
      { withCredentials: true }
    ).pipe(
      tap(() => {
        this.clearAuth();
      })
    );
  }

  refreshToken(): Observable<{ data: { tokens: AuthTokens } }> {
    return this.http.post<{ data: { tokens: AuthTokens } }>(
      `${this.apiUrl}/auth/refresh`,
      {},
      { withCredentials: true }
    ).pipe(
      tap((response: { data: { tokens: AuthTokens } }) => {
        this.setAccessToken(response.data.tokens.accessToken);
        this.isAuthenticatedSignal.set(true);
      }),
      catchError((error) => {
        // Don't clear auth state during initial session restoration
        if (this.isAuthenticatedSignal()) {
          this.clearAuth();
        }
        return throwError(() => error);
      })
    );
  }

  // ==================== Two-Factor Authentication ====================

  verify2FA(data: TwoFactorVerifyRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/2fa/verify`, data, { withCredentials: true }).pipe(
      tap((response: LoginResponse) => {
        this.twoFactorPendingSignal.set(false);
        this.handleAuthSuccess(response.data.user, response.data.tokens);
      })
    );
  }

  setup2FA(): Observable<TwoFactorSetupResponse> {
    return this.http.post<TwoFactorSetupResponse>(`${this.apiUrl}/auth/2fa/setup`, {}, { withCredentials: true });
  }

  verifySetup2FA(data: TwoFactorVerifyRequest): Observable<TwoFactorVerifySetupResponse> {
    return this.http.post<TwoFactorVerifySetupResponse>(
      `${this.apiUrl}/auth/2fa/verify-setup`,
      data,
      { withCredentials: true }
    ).pipe(
      tap(() => {
        const user = this.currentUserSignal();
        if (user) {
          this.currentUserSignal.set({ ...user, twoFactorEnabled: true });
          this.storeUser({ ...user, twoFactorEnabled: true });
        }
      })
    );
  }

  disable2FA(password: string, code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/auth/2fa/disable`,
      { password, code },
      { withCredentials: true }
    ).pipe(
      tap(() => {
        const user = this.currentUserSignal();
        if (user) {
          this.currentUserSignal.set({ ...user, twoFactorEnabled: false });
          this.storeUser({ ...user, twoFactorEnabled: false });
        }
      })
    );
  }

  regenerateBackupCodes(code: string): Observable<{ data: { backupCodes: string[] } }> {
    return this.http.post<{ data: { backupCodes: string[] } }>(
      `${this.apiUrl}/auth/2fa/backup-codes/regenerate`,
      { code },
      { withCredentials: true }
    );
  }

  // ==================== Profile ====================

  getProfile(): Observable<{ data: User }> {
    return this.http.get<{ data: User }>(`${this.apiUrl}/auth/me`, { withCredentials: true }).pipe(
      tap((response: { data: User }) => {
        this.currentUserSignal.set(response.data);
        this.storeUser(response.data);
      })
    );
  }

  updateProfile(data: Partial<User>): Observable<{ data: User; message: string }> {
    return this.http.patch<{ data: User; message: string }>(
      `${this.apiUrl}/auth/me`,
      data,
      { withCredentials: true }
    ).pipe(
      tap((response: { data: User; message: string }) => {
        this.currentUserSignal.set(response.data);
        this.storeUser(response.data);
      })
    );
  }

  // ==================== Password Management ====================

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/auth/change-password`,
      { currentPassword, newPassword },
      { withCredentials: true }
    ).pipe(
      tap(() => {
        // Password change revokes all sessions on the backend
        // Clear local state - user will need to re-login
        this.clearAuth();
      })
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  // ==================== Email Verification ====================

  resendVerification(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/auth/resend-verification`,
      {},
      { withCredentials: true }
    );
  }

  updateUserFromResponse(userData: User): void {
    this.currentUserSignal.set(userData);
    this.storeUser(userData);
  }

  // ==================== Token Management ====================

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private hasValidToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() < exp;
    } catch {
      return false;
    }
  }

  private checkTwoFactorPending(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() < exp && payload.twoFactorPending === true;
    } catch {
      return false;
    }
  }

  // ==================== Proactive Token Refresh ====================

  private startTokenRefreshWatcher(): void {
    if (this.tokenRefreshTimer) return;

    this.tokenRefreshTimer = setInterval(() => {
      this.checkAndRefreshToken();
    }, this.TOKEN_CHECK_INTERVAL_MS);

    // Also check immediately
    this.checkAndRefreshToken();
  }

  private stopTokenRefreshWatcher(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  private checkAndRefreshToken(): void {
    if (this.isRefreshing || !this.isAuthenticatedSignal()) return;

    const token = this.getAccessToken();
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const iat = payload.iat * 1000;
      const now = Date.now();

      // Token already expired - try to refresh from cookie
      if (now >= exp) {
        this.performProactiveRefresh();
        return;
      }

      // Calculate token lifetime and elapsed time
      const tokenLifetime = exp - iat;
      const elapsed = now - iat;
      const elapsedPercent = (elapsed / tokenLifetime) * 100;

      // Refresh if past the threshold
      if (elapsedPercent >= this.REFRESH_THRESHOLD_PERCENT) {
        this.performProactiveRefresh();
      }
    } catch {
      // Invalid token - try to refresh from cookie
      this.performProactiveRefresh();
    }
  }

  private performProactiveRefresh(): void {
    this.isRefreshing = true;

    this.refreshToken().subscribe({
      next: () => {
        this.isRefreshing = false;
      },
      error: () => {
        this.isRefreshing = false;
        // Refresh failed - session has ended
        this.clearAuth();
      },
    });
  }

  // ==================== Storage ====================

  private getStoredUser(): User | null {
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }

  private storeUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private handleAuthSuccess(user: User, tokens: AuthTokens): void {
    this.setAccessToken(tokens.accessToken);
    // Refresh token is stored in HttpOnly cookie by the server - no need to handle it here
    this.currentUserSignal.set(user);
    this.storeUser(user);
    this.isAuthenticatedSignal.set(true);
    this.startTokenRefreshWatcher();
  }

  private clearAuthState(): void {
    this.accessToken = null;
    localStorage.removeItem(USER_KEY);
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.twoFactorPendingSignal.set(false);
  }

  private clearAuth(): void {
    this.stopTokenRefreshWatcher();
    this.clearAuthState();
    this.router.navigate(['/login']);
  }
}
