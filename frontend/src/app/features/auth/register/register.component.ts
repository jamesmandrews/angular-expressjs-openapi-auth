import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { PasswordRequirementsComponent } from '../../../shared/components/password-requirements/password-requirements.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent, PasswordRequirementsComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>{{ isOrganizationRegistration ? 'Create Organization' : 'Create Account' }}</h1>

        @if (isOrganizationRegistration) {
          <p class="subtitle">Register and create your organization in one step</p>
        }

        @if (errorMessage) {
          <div class="error-message">{{ errorMessage }}</div>
        }

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          @if (isOrganizationRegistration) {
            <div class="form-group">
              <label for="organizationName">Organization Name <span class="required">*</span></label>
              <input
                type="text"
                id="organizationName"
                formControlName="organizationName"
                placeholder="Enter your organization name"
              />
              @if (registerForm.get('organizationName')?.invalid && registerForm.get('organizationName')?.touched) {
                <span class="field-error">Organization name is required (2-100 characters)</span>
              }
            </div>

            <hr class="divider" />
            <p class="section-label">Your Account Details</p>
          }

          <div class="form-row">
            <div class="form-group">
              <label for="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                formControlName="firstName"
                placeholder="First name"
              />
            </div>

            <div class="form-group">
              <label for="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                formControlName="lastName"
                placeholder="Last name"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="email">Email <span class="required">*</span></label>
            <input
              type="email"
              id="email"
              formControlName="email"
              placeholder="Enter your email"
            />
            @if (registerForm.get('email')?.invalid && registerForm.get('email')?.touched) {
              <span class="field-error">Please enter a valid email</span>
            }
          </div>

          <div class="form-group">
            <label for="password">Password <span class="required">*</span></label>
            <input
              type="password"
              id="password"
              formControlName="password"
              placeholder="Enter a secure password"
            />
            <app-password-requirements [password]="registerForm.get('password')?.value || ''"></app-password-requirements>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password <span class="required">*</span></label>
            <input
              type="password"
              id="confirmPassword"
              formControlName="confirmPassword"
              placeholder="Confirm your password"
            />
            @if (registerForm.errors?.['passwordMismatch'] && registerForm.get('confirmPassword')?.touched) {
              <span class="field-error">Passwords do not match</span>
            }
          </div>

          <button type="submit" [disabled]="registerForm.invalid || isLoading">
            @if (isLoading) {
              <app-spinner [light]="true" [size]="16"></app-spinner>
              <span>{{ isOrganizationRegistration ? 'Creating organization...' : 'Creating account...' }}</span>
            } @else {
              {{ isOrganizationRegistration ? 'Create Organization' : 'Create Account' }}
            }
          </button>
        </form>

        <div class="auth-links">
          <a routerLink="/login">Already have an account? Login</a>
          @if (isOrganizationRegistration) {
            <a routerLink="/register">Register as an individual instead</a>
          }
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
      max-width: 450px;
    }

    h1 {
      margin: 0 0 8px;
      text-align: center;
      color: #333;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin: 0 0 24px;
    }

    .section-label {
      color: #555;
      font-weight: 500;
      margin: 0 0 16px;
    }

    .divider {
      border: none;
      border-top: 1px solid #eee;
      margin: 24px 0 16px;
    }

    .required {
      color: #c00;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row .form-group {
      flex: 1;
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

    .field-error {
      color: #c00;
      font-size: 14px;
      margin-top: 4px;
      display: block;
    }

    .auth-links {
      margin-top: 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 8px;
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
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  isOrganizationRegistration = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check if this is an organization registration
    this.route.queryParams.subscribe(params => {
      this.isOrganizationRegistration = params['type'] === 'organization';
      this.initForm();
    });
  }

  private initForm(): void {
    const formConfig: Record<string, unknown[]> = {
      firstName: [''],
      lastName: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(16),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', Validators.required],
    };

    // Add organizationName field for organization registration
    if (this.isOrganizationRegistration) {
      formConfig['organizationName'] = ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]];
    }

    this.registerForm = this.fb.group(
      formConfig,
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password?.value !== confirmPassword?.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { confirmPassword, ...registerData } = this.registerForm.value;

    this.authService.register(registerData).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error?.message || 'Registration failed. Please try again.';
      },
    });
  }
}
