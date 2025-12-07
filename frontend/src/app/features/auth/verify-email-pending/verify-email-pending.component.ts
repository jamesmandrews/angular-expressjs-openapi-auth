import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-verify-email-pending',
  standalone: true,
  imports: [CommonModule, SpinnerComponent, HeaderComponent],
  template: `
    <div class="page-container">
      <app-header [showNav]="false"></app-header>
      <div class="verify-container">
        <div class="verify-card">
        <div class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>

        <h1>Verify Your Email</h1>

        <p class="message">
          We've sent a verification email to <strong>{{ user()?.email }}</strong>.
          Please check your inbox and click the verification link to continue.
        </p>

        @if (successMessage) {
          <div class="success-message">{{ successMessage }}</div>
        }

        @if (errorMessage) {
          <div class="error-message">{{ errorMessage }}</div>
        }

        <button
          class="resend-btn"
          (click)="resendVerification()"
          [disabled]="isLoading || cooldown > 0"
        >
          @if (isLoading) {
            <app-spinner [light]="true" [size]="16"></app-spinner>
            <span>Sending...</span>
          } @else if (cooldown > 0) {
            Resend in {{ cooldown }}s
          } @else {
            Resend Verification Email
          }
        </button>

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

    .icon {
      color: #007bff;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 16px;
      color: #333;
      font-size: 24px;
    }

    .message {
      color: #666;
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .message strong {
      color: #333;
    }

    .success-message {
      background: #d4edda;
      color: #155724;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .error-message {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .resend-btn {
      width: 100%;
      padding: 14px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .resend-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .resend-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  `],
})
export class VerifyEmailPendingComponent {
  private authService = inject(AuthService);
  user = this.authService.currentUser;

  isLoading = false;
  cooldown = 0;
  successMessage = '';
  errorMessage = '';

  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  resendVerification(): void {
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.authService.resendVerification().subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Verification email sent! Please check your inbox.';
        this.startCooldown();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error?.message || 'Failed to send verification email. Please try again.';
      },
    });
  }

  private startCooldown(): void {
    this.cooldown = 60;
    this.cooldownInterval = setInterval(() => {
      this.cooldown--;
      if (this.cooldown <= 0 && this.cooldownInterval) {
        clearInterval(this.cooldownInterval);
        this.cooldownInterval = null;
      }
    }, 1000);
  }
}
