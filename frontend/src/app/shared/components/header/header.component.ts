import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="app-header">
      <div class="header-left">
        @if (showBackLink) {
          <a [routerLink]="backLinkUrl" class="back-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            {{ backLinkText }}
          </a>
        }
        @if (title) {
          <h1>{{ title }}</h1>
        }
      </div>

      @if (authService.isAuthenticated()) {
        <nav class="header-nav">
          @if (showNav) {
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">Dashboard</a>
            <a routerLink="/settings/profile" routerLinkActive="active" class="nav-link">Profile</a>
          }
          <button class="logout-btn" (click)="logout()">Logout</button>
        </nav>
      }
    </header>
  `,
  styles: [`
    .app-header {
      background: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .header-left h1 {
      margin: 0;
      font-size: 24px;
      color: #333;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #666;
      text-decoration: none;
      font-size: 14px;
    }

    .back-link:hover {
      color: #007bff;
    }

    .header-nav {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .nav-link {
      color: #666;
      text-decoration: none;
      font-size: 14px;
      padding: 8px 12px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .nav-link:hover {
      color: #007bff;
      background: #f5f5f5;
    }

    .nav-link.active {
      color: #007bff;
      background: #e7f1ff;
    }

    .logout-btn {
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
      font-size: 14px;
    }

    .logout-btn:hover {
      background: #c82333;
    }
  `],
})
export class HeaderComponent {
  authService = inject(AuthService);

  @Input() title = '';
  @Input() showNav = true;
  @Input() showBackLink = false;
  @Input() backLinkUrl = '/dashboard';
  @Input() backLinkText = 'Back';

  logout(): void {
    this.authService.logout();
  }
}
