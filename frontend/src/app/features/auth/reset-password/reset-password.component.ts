import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Reset Password</h1>

        @if (successMessage) {
          <div class="success-message">{{ successMessage }}</div>
          <div class="auth-links">
            <a routerLink="/login">Go to Login</a>
          </div>
        } @else if (tokenError) {
          <div class="error-message">{{ tokenError }}</div>
          <div class="auth-links">
            <a routerLink="/forgot-password">Request a new reset link</a>
          </div>
        } @else {
          @if (errorMessage) {
            <div class="error-message">{{ errorMessage }}</div>
          }

          <form [formGroup]="resetForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="password">New Password</label>
              <input
                type="password"
                id="password"
                formControlName="password"
                placeholder="Enter new password"
              />
              @if (resetForm.get('password')?.invalid && resetForm.get('password')?.touched) {
                <span class="field-error">
                  Password must be at least 16 characters with uppercase, lowercase, and number
                </span>
              }
            </div>

            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                formControlName="confirmPassword"
                placeholder="Confirm new password"
              />
              @if (resetForm.get('confirmPassword')?.touched && resetForm.errors?.['passwordMismatch']) {
                <span class="field-error">Passwords do not match</span>
              }
            </div>

            <button type="submit" [disabled]="resetForm.invalid || isLoading">
              @if (isLoading) {
                <app-spinner [light]="true" [size]="16"></app-spinner>
                <span>Resetting...</span>
              } @else {
                Reset Password
              }
            </button>
          </form>

          <div class="auth-links">
            <a routerLink="/login">Back to Login</a>
          </div>
        }
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
      margin: 0 0 24px;
      text-align: center;
      color: #333;
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
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
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
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
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

    .success-message {
      background: #efe;
      color: #060;
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

    .auth-links a {
      color: #007bff;
      text-decoration: none;
    }

    .auth-links a:hover {
      text-decoration: underline;
    }
  `],
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  tokenError = '';
  private token = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.resetForm = this.fb.group({
      password: ['', [
        Validators.required,
        Validators.minLength(16),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.tokenError = 'Invalid or missing reset token. Please request a new password reset link.';
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.resetForm.invalid || !this.token) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.resetPassword(this.token, this.resetForm.value.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Your password has been reset successfully. You can now log in with your new password.';
      },
      error: (error) => {
        this.isLoading = false;
        const message = error.error?.error?.message || 'Failed to reset password. Please try again.';
        if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('expired')) {
          this.tokenError = 'The reset link is invalid or has expired. Please request a new one.';
        } else {
          this.errorMessage = message;
        }
      },
    });
  }
}
