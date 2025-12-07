import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-two-factor-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HeaderComponent],
  template: `
    <div class="page-container">
      <app-header
        title="Two-Factor Authentication"
        [showBackLink]="true"
        backLinkUrl="/settings/profile"
        backLinkText="Back to Profile"
      ></app-header>

      <div class="setup-container">
        <div class="setup-card">

        @if (step() === 'intro') {
          <div class="intro">
            <p>Two-factor authentication adds an extra layer of security to your account.</p>
            <p>You'll need an authenticator app like:</p>
            <ul>
              <li>Google Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
              <li>Microsoft Authenticator</li>
            </ul>
            <button class="btn-primary" (click)="startSetup()" [disabled]="loading()">
              {{ loading() ? 'Loading...' : 'Get Started' }}
            </button>
          </div>
        }

        @if (step() === 'scan') {
          <div class="scan-step">
            <p>Scan this QR code with your authenticator app:</p>

            @if (qrCodeUrl()) {
              <div class="qr-code">
                <img [src]="qrCodeUrl()" alt="QR Code for 2FA setup" />
              </div>
            }

            <p class="manual-entry">
              Or enter this code manually:<br />
              <code class="secret">{{ secret() }}</code>
            </p>

            <div class="form-group">
              <label for="code">Enter the 6-digit code from your app:</label>
              <input
                type="text"
                id="code"
                [(ngModel)]="verificationCode"
                maxlength="6"
                pattern="[0-9]*"
                inputmode="numeric"
                placeholder="000000"
                class="code-input"
              />
            </div>

            @if (error()) {
              <div class="error-message">{{ error() }}</div>
            }

            <button
              class="btn-primary"
              (click)="verifyCode()"
              [disabled]="loading() || verificationCode.length !== 6"
            >
              {{ loading() ? 'Verifying...' : 'Verify & Enable' }}
            </button>
          </div>
        }

        @if (step() === 'backup') {
          <div class="backup-step">
            <h2>Save Your Backup Codes</h2>
            <p class="warning">
              Store these codes in a safe place. Each code can only be used once
              if you lose access to your authenticator app.
            </p>

            <div class="backup-codes">
              @for (code of backupCodes(); track code) {
                <code class="backup-code">{{ code }}</code>
              }
            </div>

            <button class="btn-secondary" (click)="copyBackupCodes()">
              {{ copied() ? 'Copied!' : 'Copy Codes' }}
            </button>

            <button class="btn-primary" (click)="finish()">
              I've Saved My Codes
            </button>
          </div>
        }

        @if (step() === 'complete') {
          <div class="complete-step">
            <div class="success-icon">✓</div>
            <h2>2FA Enabled!</h2>
            <p>Your account is now protected with two-factor authentication.</p>
            <a routerLink="/dashboard" class="btn-primary">Back to Dashboard</a>
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

    .setup-container {
      padding: 24px;
      display: flex;
      justify-content: center;
    }

    .setup-card {
      background: white;
      padding: 32px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
    }

    h1 {
      margin: 0 0 24px;
      color: #333;
      font-size: 24px;
    }

    h2 {
      margin: 0 0 16px;
      color: #333;
    }

    p {
      color: #666;
      line-height: 1.5;
    }

    ul {
      color: #666;
      margin: 16px 0;
      padding-left: 24px;
    }

    li {
      margin: 8px 0;
    }

    .btn-primary {
      display: inline-block;
      padding: 12px 24px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      text-decoration: none;
      margin-top: 16px;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      display: inline-block;
      padding: 12px 24px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 16px;
      margin-right: 12px;
    }

    .btn-secondary:hover {
      background: #545b62;
    }

    .qr-code {
      background: white;
      padding: 16px;
      display: inline-block;
      border-radius: 8px;
      margin: 16px 0;
    }

    .qr-code img {
      display: block;
      width: 200px;
      height: 200px;
    }

    .manual-entry {
      font-size: 14px;
      margin-top: 16px;
    }

    .secret {
      display: block;
      margin-top: 8px;
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 4px;
      font-family: monospace;
      font-size: 14px;
      word-break: break-all;
    }

    .form-group {
      margin: 24px 0;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 500;
    }

    .code-input {
      width: 100%;
      padding: 12px;
      font-size: 24px;
      text-align: center;
      letter-spacing: 8px;
      border: 2px solid #ddd;
      border-radius: 4px;
      font-family: monospace;
    }

    .code-input:focus {
      outline: none;
      border-color: #007bff;
    }

    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .warning {
      background: #fff3cd;
      color: #856404;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .backup-codes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin: 16px 0;
    }

    .backup-code {
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 4px;
      font-family: monospace;
      text-align: center;
    }

    .complete-step {
      text-align: center;
    }

    .success-icon {
      width: 64px;
      height: 64px;
      background: #28a745;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin: 0 auto 16px;
    }
  `],
})
export class TwoFactorSetupComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  step = signal<'intro' | 'scan' | 'backup' | 'complete'>('intro');
  loading = signal(false);
  error = signal<string | null>(null);
  qrCodeUrl = signal<string | null>(null);
  secret = signal<string | null>(null);
  backupCodes = signal<string[]>([]);
  copied = signal(false);

  verificationCode = '';

  startSetup(): void {
    this.loading.set(true);
    this.error.set(null);

    this.authService.setup2FA().subscribe({
      next: (response) => {
        this.qrCodeUrl.set(response.data.qrCode);
        this.secret.set(response.data.secret);
        this.step.set('scan');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error?.message || 'Failed to start 2FA setup');
        this.loading.set(false);
      },
    });
  }

  verifyCode(): void {
    this.loading.set(true);
    this.error.set(null);

    this.authService.verifySetup2FA({ code: this.verificationCode }).subscribe({
      next: (response) => {
        this.backupCodes.set(response.data.backupCodes);
        this.step.set('backup');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error?.message || 'Invalid verification code');
        this.loading.set(false);
      },
    });
  }

  copyBackupCodes(): void {
    const codes = this.backupCodes().join('\n');
    navigator.clipboard.writeText(codes).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  finish(): void {
    this.step.set('complete');
  }
}
