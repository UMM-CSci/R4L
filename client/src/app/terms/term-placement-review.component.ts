import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TermPlacementIssue } from './term-placement.service';

/**
 * Component for reviewing term placement issues in supply list items.
 * It displays the detected issues and provides options to fix or undo them.
 */
@Component({
  selector: 'app-term-placement-review',
  templateUrl: './term-placement-review.component.html',
  styleUrls: ['./term-placement-review.component.scss'],
  imports: [CommonModule, MatButtonModule, MatIconModule]
})
export class TermPlacementReviewComponent {
  // Input and output properties for managing term placement issues and user actions.
  @Input() issues: TermPlacementIssue[] = [];
  @Input() canUndo = false;
  @Output() fixIssue = new EventEmitter<{ issue: TermPlacementIssue; keepExistingConflicts: boolean }>();
  @Output() undo = new EventEmitter<void>();

  /**
   * Returns a human-readable label for a given term placement field.
   * @param field The term placement field.
   * @returns The human-readable label for the field.
   */
  fieldLabel(field: string): string {
    return field === 'packageSize'
      ? 'Count'
      : field.charAt(0).toUpperCase() + field.slice(1);
  }
}
