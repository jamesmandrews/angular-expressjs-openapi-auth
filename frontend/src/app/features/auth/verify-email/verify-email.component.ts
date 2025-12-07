import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, HeaderComponent],
  template: `
    <div class="page-container">
      @if (authService.isAuthenticated()) {
        <app-header [showNav]="false"></app-header>
      }
      <div class="verify-container">
        <div class="verify-card">
        @if (isLoading) {
          <div class="loading-state">
            <app-spinner [size]="32"></app-spinner>
            <p>Verifying your email...</p>
          </div>
        } @else if (success) {
          <div class="success-state">
            <div class="icon success">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h1>Email Verified!</h1>
            <p>Your email address has been successfully verified.</p>
            <a routerLink="/dashboard" class="btn-primary">Go to Dashboard</a>
          </div>
        } @else {
          <div class="error-state">
            <div class="icon error">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1>Verification Failed</h1>
            <p>{{ errorMessage }}</p>
            @if (authService.isAuthenticated()) {
              <a routerLink="/verify-email-pending" class="btn-primary">Request New Link</a>
            } @else {
              <a routerLink="/login" class="btn-primary">Go to Login</a>
            }
          </div>
        }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      background: #f5f5f5;
    }

    .verify-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      min-height: calc(100vh - 60px);
    }

    .page-container:not(:has(app-header)) .verify-container {
      min-height: 100vh;
    }

    .verify-card {
      background: white;
      padding: 48px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 450px;
      text-align: center;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .loading-state p {
      color: #666;
      margin: 0;
    }

    .icon {
      margin-bottom: 24px;
    }

    .icon.success {
      color: #28a745;
    }

    .icon.error {
      color: #dc3545;
    }

    h1 {
      margin: 0 0 16px;
      color: #333;
      font-size: 24px;
    }

    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .btn-primary {
      display: inline-block;
      padding: 12px 24px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 16px;
      transition: background 0.2s;
    }

    .btn-primary:hover {
      background: #0056b3;
    }
  `],
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  authService = inject(AuthService);

  isLoading = true;
  success = false;
  errorMessage = 'The verification link is invalid or has expired.';

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.isLoading = false;
      this.errorMessage = 'No verification token provided.';
      return;
    }

    this.verifyEmail(token);
  }

  private verifyEmail(token: string): void {
    this.http.post<{ message: string; data: any }>(`${environment.apiUrl}/auth/verify-email`, { token }).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.success = true;
        // Update local user state with the verified user from the response
        if (response.data) {
          this.authService.updateUserFromResponse(response.data);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.success = false;
        this.errorMessage = error.error?.error?.message || 'The verification link is invalid or has expired.';
      },
    });
  }
}
