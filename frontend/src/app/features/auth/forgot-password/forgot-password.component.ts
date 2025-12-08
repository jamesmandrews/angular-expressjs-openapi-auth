import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Forgot Password</h1>

        @if (successMessage) {
          <div class="success-message">{{ successMessage }}</div>
        }

        @if (errorMessage) {
          <div class="error-message">{{ errorMessage }}</div>
        }

        @if (!successMessage) {
          <p class="description">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <form [formGroup]="forgotForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                formControlName="email"
                placeholder="Enter your email"
              />
              @if (forgotForm.get('email')?.invalid && forgotForm.get('email')?.touched) {
                <span class="field-error">Please enter a valid email</span>
              }
            </div>

            <button type="submit" [disabled]="forgotForm.invalid || isLoading">
              @if (isLoading) {
                <app-spinner [light]="true" [size]="16"></app-spinner>
                <span>Sending...</span>
              } @else {
                Send Reset Link
              }
            </button>
          </form>
        }

        <div class="auth-links">
          <a routerLink="/login">Back to Login</a>
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
      margin: 0 0 16px;
      text-align: center;
      color: #333;
    }

    .description {
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
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (this.forgotForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.forgotPassword(this.forgotForm.value.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'If an account with that email exists, a password reset link has been sent. Please check your inbox.';
      },
      error: (error) => {
        this.isLoading = false;
        // Always show success message to prevent email enumeration
        this.successMessage = 'If an account with that email exists, a password reset link has been sent. Please check your inbox.';
      },
    });
  }
}
