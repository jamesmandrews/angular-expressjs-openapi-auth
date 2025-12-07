import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="spinner" [class.light]="light" [style.width.px]="size" [style.height.px]="size"></span>
  `,
  styles: [`
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0, 0, 0, 0.2);
      border-top-color: #333;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner.light {
      border-color: rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
})
export class SpinnerComponent {
  @Input() size = 16;
  @Input() light = false;
}
