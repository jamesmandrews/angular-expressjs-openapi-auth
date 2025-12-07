import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent, HeaderComponent],
  template: `
    <div class="settings-container">
      <app-header
        title="Edit Profile"
        [showBackLink]="true"
        backLinkUrl="/account/profile"
        backLinkText="Back to Profile"
      ></app-header>

      <div class="settings-content">
        <div class="card">
          @if (successMessage) {
            <div class="success-message">{{ successMessage }}</div>
          }

          @if (errorMessage) {
            <div class="error-message">{{ errorMessage }}</div>
          }

          <form [formGroup]="profileForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                [value]="user()?.email"
                disabled
                class="disabled"
              />
              <span class="field-hint">Email cannot be changed</span>
            </div>

            <div class="form-group">
              <label for="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                formControlName="firstName"
                placeholder="Enter your first name"
              />
            </div>

            <div class="form-group">
              <label for="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                formControlName="lastName"
                placeholder="Enter your last name"
              />
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" routerLink="/account/profile">
                Cancel
              </button>
              <button type="submit" class="btn-primary" [disabled]="!hasChanges() || isLoading">
                @if (isLoading) {
                  <app-spinner [light]="true" [size]="16"></app-spinner>
                  <span>Saving...</span>
                } @else {
                  Save Changes
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      min-height: 100vh;
      background: #f5f5f5;
    }

    .settings-content {
      padding: 24px;
      max-width: 500px;
      margin: 0 auto;
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 24px;
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

    input.disabled {
      background: #f5f5f5;
      color: #999;
      cursor: not-allowed;
    }

    .field-hint {
      color: #999;
      font-size: 13px;
      margin-top: 4px;
      display: block;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
    }

    .btn-primary {
      padding: 12px 24px;
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

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      padding: 12px 24px;
      background: white;
      color: #666;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }

    .btn-secondary:hover {
      background: #f5f5f5;
      color: #333;
    }
  `],
})
export class ProfileEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.currentUser;

  isLoading = false;
  successMessage = '';
  errorMessage = '';

  profileForm: FormGroup = this.fb.group({
    firstName: [''],
    lastName: [''],
  });

  private initialValues = { firstName: '', lastName: '' };

  ngOnInit(): void {
    const user = this.user();
    if (user) {
      this.initialValues = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      };
      this.profileForm.patchValue(this.initialValues);
    }
  }

  hasChanges(): boolean {
    const current = this.profileForm.value;
    return (
      current.firstName !== this.initialValues.firstName ||
      current.lastName !== this.initialValues.lastName
    );
  }

  onSubmit(): void {
    if (!this.hasChanges()) return;

    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.authService.updateProfile(this.profileForm.value).subscribe({
      next: () => {
        this.isLoading = false;
        this.initialValues = { ...this.profileForm.value };
        this.successMessage = 'Profile updated successfully!';
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error?.message || 'Failed to update profile. Please try again.';
      },
    });
  }
}
