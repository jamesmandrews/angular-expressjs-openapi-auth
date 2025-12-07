import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, HeaderComponent],
  template: `
    <div class="dashboard">
      <app-header title="Dashboard"></app-header>

      <main>
        <div class="welcome-card">
          <h2>Welcome, {{ user()?.firstName || user()?.email }}!</h2>
          <p>You are successfully logged in.</p>
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

    main {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .welcome-card,
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

    .action-card h3 {
      margin: 0 0 16px;
      color: #333;
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
}
