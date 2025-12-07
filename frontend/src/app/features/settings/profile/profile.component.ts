import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  template: `
    <div class="settings-container">
      <app-header
        title="Profile"
        [showBackLink]="true"
        backLinkUrl="/dashboard"
        backLinkText="Back to Dashboard"
      ></app-header>

      <div class="settings-content">
        <div class="card">
          <div class="card-header">
            <h2>Account Information</h2>
            <a routerLink="/settings/profile/edit" class="edit-link">Edit</a>
          </div>

          <div class="info-grid">
            <div class="info-row">
              <span class="label">Email</span>
              <span class="value">{{ user()?.email }}</span>
            </div>
            <div class="info-row">
              <span class="label">First Name</span>
              <span class="value">{{ user()?.firstName || '—' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Last Name</span>
              <span class="value">{{ user()?.lastName || '—' }}</span>
            </div>
            <div class="info-row">
              <span class="label">User Type</span>
              <span class="value">{{ user()?.userType }}</span>
            </div>
            <div class="info-row">
              <span class="label">Member Since</span>
              <span class="value">{{ user()?.createdAt | date:'longDate' }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Security</h2>
          </div>

          <div class="security-grid">
            <div class="security-item">
              <div class="security-info">
                <span class="security-label">Email Verification</span>
                <span class="security-status" [class.verified]="user()?.emailVerified">
                  {{ user()?.emailVerified ? 'Verified' : 'Not Verified' }}
                </span>
              </div>
            </div>

            <div class="security-item">
              <div class="security-info">
                <span class="security-label">Two-Factor Authentication</span>
                <span class="security-status" [class.verified]="user()?.twoFactorEnabled">
                  {{ user()?.twoFactorEnabled ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
              <a routerLink="/settings/2fa" class="security-action">
                {{ user()?.twoFactorEnabled ? 'Manage' : 'Enable' }}
              </a>
            </div>

            <div class="security-item">
              <div class="security-info">
                <span class="security-label">Password</span>
                <span class="security-status">••••••••</span>
              </div>
              <a routerLink="/settings/password" class="security-action">Change</a>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Roles & Permissions</h2>
          </div>

          <div class="info-grid">
            <div class="info-row">
              <span class="label">Roles</span>
              <span class="value">
                @if (user()?.roles?.length) {
                  @for (role of user()?.roles; track role) {
                    <span class="badge">{{ role }}</span>
                  }
                } @else {
                  <span class="muted">No roles assigned</span>
                }
              </span>
            </div>
          </div>
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
      max-width: 800px;
      margin: 0 auto;
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #eee;
    }

    .card-header h2 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .edit-link {
      color: #007bff;
      text-decoration: none;
      font-size: 14px;
    }

    .edit-link:hover {
      text-decoration: underline;
    }

    .info-grid {
      padding: 16px 24px;
    }

    .info-row {
      display: flex;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      width: 140px;
      font-weight: 500;
      color: #666;
      flex-shrink: 0;
    }

    .value {
      color: #333;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      background: #e9ecef;
      border-radius: 4px;
      font-size: 13px;
      color: #495057;
    }

    .muted {
      color: #999;
    }

    .security-grid {
      padding: 8px 24px;
    }

    .security-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .security-item:last-child {
      border-bottom: none;
    }

    .security-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .security-label {
      font-weight: 500;
      color: #333;
    }

    .security-status {
      font-size: 14px;
      color: #999;
    }

    .security-status.verified {
      color: #28a745;
    }

    .security-action {
      color: #007bff;
      text-decoration: none;
      font-size: 14px;
    }

    .security-action:hover {
      text-decoration: underline;
    }
  `],
})
export class ProfileComponent {
  private authService = inject(AuthService);
  user = this.authService.currentUser;
}
