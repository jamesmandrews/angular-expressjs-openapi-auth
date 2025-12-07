import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard">
      <header>
        <h1>Dashboard</h1>
        <button class="logout-btn" (click)="logout()">Logout</button>
      </header>

      <main>
        <div class="welcome-card">
          <h2>Welcome, {{ user()?.firstName || user()?.email }}!</h2>
          <p>You are successfully logged in.</p>
        </div>

        <div class="info-card">
          <h3>Account Info</h3>
          <div class="info-row">
            <span class="label">Email:</span>
            <span class="value">{{ user()?.email }}</span>
          </div>
          <div class="info-row">
            <span class="label">User Type:</span>
            <span class="value">{{ user()?.userType }}</span>
          </div>
          <div class="info-row">
            <span class="label">Email Verified:</span>
            <span class="value" [class.verified]="user()?.emailVerified">
              {{ user()?.emailVerified ? 'Yes' : 'No' }}
            </span>
          </div>
          <div class="info-row">
            <span class="label">2FA Enabled:</span>
            <span class="value" [class.verified]="user()?.twoFactorEnabled">
              {{ user()?.twoFactorEnabled ? 'Yes' : 'No' }}
            </span>
          </div>
          <div class="info-row">
            <span class="label">Roles:</span>
            <span class="value">{{ user()?.roles?.join(', ') || 'None' }}</span>
          </div>
        </div>

        @if (!user()?.twoFactorEnabled) {
          <div class="action-card">
            <h3>Security Recommendation</h3>
            <p>Enable two-factor authentication to secure your account.</p>
            <a routerLink="/settings/2fa" class="btn-primary">Enable 2FA</a>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .dashboard {
      min-height: 100vh;
      background: #f5f5f5;
    }

    header {
      background: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    header h1 {
      margin: 0;
      font-size: 24px;
      color: #333;
    }

    .logout-btn {
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .logout-btn:hover {
      background: #c82333;
    }

    main {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .welcome-card,
    .info-card,
    .action-card {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
    }

    .welcome-card h2 {
      margin: 0 0 8px;
      color: #333;
    }

    .welcome-card p {
      margin: 0;
      color: #666;
    }

    .info-card h3,
    .action-card h3 {
      margin: 0 0 16px;
      color: #333;
    }

    .info-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 500;
      color: #555;
      width: 140px;
    }

    .value {
      color: #333;
    }

    .value.verified {
      color: #28a745;
    }

    .action-card p {
      color: #666;
      margin-bottom: 16px;
    }

    .btn-primary {
      display: inline-block;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-primary:hover {
      background: #0056b3;
    }
  `],
})
export class DashboardComponent {
  private authService = inject(AuthService);
  user = this.authService.currentUser;

  logout(): void {
    this.authService.logout();
  }
}
