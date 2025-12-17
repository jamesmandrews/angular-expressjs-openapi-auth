import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="home-container">
      <div class="home-content">
        <h1>Welcome</h1>
        <p class="subtitle">{{ organizationsOnlyEnabled ? 'Create your organization to get started' : 'Choose how you\\'d like to get started' }}</p>

        <div class="options">
          @if (organizationsOnlyEnabled) {
            <!-- Organizations only mode: single card for org registration -->
            <div class="option-card">
              <div class="option-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h2>Create Organization</h2>
              <p>Register and create your organization to get started</p>
              <a routerLink="/register" class="btn btn-primary">Get Started</a>
            </div>
          } @else {
            <!-- Standard mode: individual account option -->
            <div class="option-card">
              <div class="option-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <h2>Individual Account</h2>
              <p>Create a personal account for yourself</p>
              <a routerLink="/register" class="btn btn-primary">Create Account</a>
            </div>

            @if (organizationsEnabled) {
              <!-- Optional organization registration -->
              <div class="option-card">
                <div class="option-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <h2>Organization</h2>
                <p>Create an organization and invite team members</p>
                <a [routerLink]="['/register']" [queryParams]="{ type: 'organization' }" class="btn btn-primary">Create Organization</a>
              </div>
            }
          }
        </div>

        <div class="login-link">
          <span>Already have an account?</span>
          <a routerLink="/login">Sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .home-content {
      text-align: center;
      max-width: 800px;
    }

    h1 {
      color: white;
      font-size: 3rem;
      margin: 0 0 8px;
      font-weight: 700;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.25rem;
      margin: 0 0 48px;
    }

    .options {
      display: flex;
      gap: 24px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .option-card {
      background: white;
      border-radius: 12px;
      padding: 40px 32px;
      width: 280px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .option-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
    }

    .option-icon {
      color: #667eea;
      margin-bottom: 16px;
    }

    .option-card h2 {
      color: #333;
      font-size: 1.5rem;
      margin: 0 0 8px;
    }

    .option-card p {
      color: #666;
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .btn {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.2s, transform 0.1s;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5a6fd6;
    }

    .btn-primary:active {
      transform: scale(0.98);
    }

    .login-link {
      margin-top: 48px;
      color: rgba(255, 255, 255, 0.9);
    }

    .login-link span {
      margin-right: 8px;
    }

    .login-link a {
      color: white;
      font-weight: 600;
      text-decoration: none;
    }

    .login-link a:hover {
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      h1 {
        font-size: 2rem;
      }

      .subtitle {
        font-size: 1rem;
      }

      .options {
        flex-direction: column;
        align-items: center;
      }

      .option-card {
        width: 100%;
        max-width: 320px;
      }
    }
  `],
})
export class HomeComponent {
  organizationsEnabled = environment.organizationsEnabled;
  organizationsOnlyEnabled = environment.organizationsOnlyEnabled;
}
