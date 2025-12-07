import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-two-factor-verify',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Two-Factor Authentication</h1>
        <p class="subtitle">Enter the 6-digit code from your authenticator app</p>

        @if (errorMessage) {
          <div class="error-message">{{ errorMessage }}</div>
        }

        <form [formGroup]="verifyForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="code">Verification Code</label>
            <input
              type="text"
              id="code"
              formControlName="code"
              placeholder="000000"
              maxlength="6"
              autocomplete="one-time-code"
            />
            @if (verifyForm.get('code')?.invalid && verifyForm.get('code')?.touched) {
              <span class="field-error">Please enter a 6-digit code</span>
            }
          </div>

          <button type="submit" [disabled]="verifyForm.invalid || isLoading">
            {{ isLoading ? 'Verifying...' : 'Verify' }}
          </button>
        </form>

        <div class="auth-links">
          <p>Lost access? Use a backup code instead.</p>
          <a routerLink="/login">Cancel and return to login</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 20px;
    }

    .auth-card {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
    }

    h1 {
      margin: 0 0 8px;
      text-align: center;
      color: #333;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #555;
    }

    input {
      width: 100%;
      padding: 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 24px;
      text-align: center;
      letter-spacing: 8px;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: #007bff;
    }

    button {
      width: 100%;
      padding: 14px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover:not(:disabled) {
      background: #0056b3;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .error-message {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .field-error {
      color: #c00;
      font-size: 14px;
      margin-top: 4px;
      display: block;
    }

    .auth-links {
      margin-top: 20px;
      text-align: center;
    }

    .auth-links p {
      color: #666;
      margin-bottom: 8px;
    }

    .auth-links a {
      color: #007bff;
      text-decoration: none;
    }

    .auth-links a:hover {
      text-decoration: underline;
    }
  `],
})
export class TwoFactorVerifyComponent {
  verifyForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  onSubmit(): void {
    if (this.verifyForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.verify2FA(this.verifyForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error?.message || 'Verification failed. Please try again.';
      },
    });
  }
}
