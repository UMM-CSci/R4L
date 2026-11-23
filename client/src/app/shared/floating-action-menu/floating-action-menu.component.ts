import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface FloatingAction {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-floating-action-menu',
  standalone: true,
  templateUrl: './floating-action-menu.component.html',
  styleUrls: ['./floating-action-menu.component.scss'],
  imports: [MatButtonModule, MatIconModule, MatTooltipModule]
})
export class FloatingActionMenuComponent {
  @Input() actions: readonly FloatingAction[] = [];
  @Output() actionSelected = new EventEmitter<string>();

  readonly expanded = signal(false);

  toggleMenu(): void {
    this.expanded.update(value => !value);
  }

  selectAction(actionId: string): void {
    this.actionSelected.emit(actionId);
    this.expanded.set(false);
  }
}
