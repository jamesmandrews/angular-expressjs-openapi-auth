import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Requirement {
  label: string;
  met: boolean;
}

@Component({
  selector: 'app-password-requirements',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="password-requirements" [class.hidden]="!password">
      <div class="requirements-header">Password requirements:</div>
      <ul class="requirements-list">
        @for (req of requirements; track req.label) {
          <li [class.met]="req.met">
            <span class="icon">{{ req.met ? '✓' : '○' }}</span>
            {{ req.label }}
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .password-requirements {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 12px;
      margin-top: 8px;
      font-size: 14px;
    }

    .password-requirements.hidden {
      display: none;
    }

    .requirements-header {
      font-weight: 500;
      color: #555;
      margin-bottom: 8px;
    }

    .requirements-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .requirements-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      color: #666;
    }

    .requirements-list li.met {
      color: #28a745;
    }

    .icon {
      width: 16px;
      text-align: center;
      font-weight: bold;
    }

    .requirements-list li:not(.met) .icon {
      color: #999;
    }
  `],
})
export class PasswordRequirementsComponent implements OnChanges {
  @Input() password = '';

  requirements: Requirement[] = [
    { label: 'At least 16 characters', met: false },
    { label: 'At least one uppercase letter (A-Z)', met: false },
    { label: 'At least one lowercase letter (a-z)', met: false },
    { label: 'At least one number (0-9)', met: false },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['password']) {
      this.checkRequirements();
    }
  }

  private checkRequirements(): void {
    const pwd = this.password || '';
    this.requirements = [
      { label: 'At least 16 characters', met: pwd.length >= 16 },
      { label: 'At least one uppercase letter (A-Z)', met: /[A-Z]/.test(pwd) },
      { label: 'At least one lowercase letter (a-z)', met: /[a-z]/.test(pwd) },
      { label: 'At least one number (0-9)', met: /[0-9]/.test(pwd) },
    ];
  }
}
