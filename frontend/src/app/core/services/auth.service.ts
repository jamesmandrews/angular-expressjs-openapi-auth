import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
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

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;

  // Signals for reactive state
  private currentUserSignal = signal<User | null>(this.getStoredUser());
  private isAuthenticatedSignal = signal<boolean>(this.hasValidToken());
  private twoFactorPendingSignal = signal<boolean>(this.checkTwoFactorPending());

  // Public computed signals
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.isAuthenticatedSignal());
  readonly twoFactorPending = computed(() => this.twoFactorPendingSignal());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // ==================== Authentication ====================

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
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
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, data).pipe(
      tap((response: RegisterResponse) => {
        this.handleAuthSuccess(response.data.user, response.data.tokens);
      })
    );
  }

  logout(): void {
    const token = this.getAccessToken();
    if (token) {
      this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({
        complete: () => this.clearAuth(),
        error: () => this.clearAuth(),
      });
    } else {
      this.clearAuth();
    }
  }

  refreshToken(): Observable<{ data: { tokens: AuthTokens } }> {
    return this.http.post<{ data: { tokens: AuthTokens } }>(`${this.apiUrl}/auth/refresh`, {}).pipe(
      tap((response: { data: { tokens: AuthTokens } }) => {
        this.setAccessToken(response.data.tokens.accessToken);
        if (response.data.tokens.refreshToken) {
          this.setRefreshToken(response.data.tokens.refreshToken);
        }
      }),
      catchError((error) => {
        this.clearAuth();
        return throwError(() => error);
      })
    );
  }

  // ==================== Two-Factor Authentication ====================

  verify2FA(data: TwoFactorVerifyRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/2fa/verify`, data).pipe(
      tap((response: LoginResponse) => {
        this.twoFactorPendingSignal.set(false);
        this.handleAuthSuccess(response.data.user, response.data.tokens);
      })
    );
  }

  setup2FA(): Observable<TwoFactorSetupResponse> {
    return this.http.post<TwoFactorSetupResponse>(`${this.apiUrl}/auth/2fa/setup`, {});
  }

  verifySetup2FA(data: TwoFactorVerifyRequest): Observable<TwoFactorVerifySetupResponse> {
    return this.http.post<TwoFactorVerifySetupResponse>(`${this.apiUrl}/auth/2fa/verify-setup`, data).pipe(
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
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/2fa/disable`, { password, code }).pipe(
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
    return this.http.post<{ data: { backupCodes: string[] } }>(`${this.apiUrl}/auth/2fa/backup-codes/regenerate`, { code });
  }

  // ==================== Profile ====================

  getProfile(): Observable<{ data: User }> {
    return this.http.get<{ data: User }>(`${this.apiUrl}/auth/me`).pipe(
      tap((response: { data: User }) => {
        this.currentUserSignal.set(response.data);
        this.storeUser(response.data);
      })
    );
  }

  updateProfile(data: Partial<User>): Observable<{ data: User; message: string }> {
    return this.http.patch<{ data: User; message: string }>(`${this.apiUrl}/auth/me`, data).pipe(
      tap((response: { data: User; message: string }) => {
        this.currentUserSignal.set(response.data);
        this.storeUser(response.data);
      })
    );
  }

  // ==================== Password Management ====================

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  // ==================== Email Verification ====================

  resendVerification(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/resend-verification`, {});
  }

  updateUserFromResponse(userData: User): void {
    this.currentUserSignal.set(userData);
    this.storeUser(userData);
  }

  // ==================== Token Management ====================

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  private setAccessToken(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
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
      // Token must be valid and have twoFactorPending flag
      return Date.now() < exp && payload.twoFactorPending === true;
    } catch {
      return false;
    }
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
    if (tokens.refreshToken) {
      this.setRefreshToken(tokens.refreshToken);
    }
    this.currentUserSignal.set(user);
    this.storeUser(user);
    this.isAuthenticatedSignal.set(true);
  }

  private clearAuth(): void {
    // Clear localStorage
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // Clear sessionStorage (in case any auth data was stored there)
    sessionStorage.clear();

    // Clear any auth-related cookies by expiring them
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });

    // Reset signals
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.twoFactorPendingSignal.set(false);

    this.router.navigate(['/login']);
  }
}
