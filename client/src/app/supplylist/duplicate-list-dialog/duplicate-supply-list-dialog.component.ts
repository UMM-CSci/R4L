import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export type SupplyListDestination = { school: string; grade: string };

export interface DuplicateSupplyListDialogData {
  sourceSchool: string;
  sourceGrade: string;
  itemCount: number;
}

@Component({
  selector: 'app-duplicate-supply-list-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './duplicate-supply-list-dialog.component.html',
  styleUrls: ['./duplicate-supply-list-dialog.component.scss']
})
export class DuplicateSupplyListDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DuplicateSupplyListDialogComponent, SupplyListDestination[]>);
  readonly data = inject<DuplicateSupplyListDialogData>(MAT_DIALOG_DATA);

  school = this.data.sourceSchool;
  grades = '';
  destinations: SupplyListDestination[] = [];

  addDestination(): void {
    const school = this.school.trim();
    const grades = this.grades.split(',').map(grade => grade.trim()).filter(Boolean);
    if (!school || !grades.length) return;

    for (const grade of grades) {
      const duplicate = this.destinations.some(destination =>
        destination.school.toLowerCase() === school.toLowerCase()
        && destination.grade.toLowerCase() === grade.toLowerCase());
      const isSource = school.toLowerCase() === this.data.sourceSchool.toLowerCase()
        && grade.toLowerCase() === this.data.sourceGrade.toLowerCase();
      if (!duplicate && !isSource) this.destinations.push({ school, grade });
    }
    this.destinations = [...this.destinations];
    this.grades = '';
  }

  removeDestination(index: number): void {
    this.destinations = this.destinations.filter((_, destinationIndex) => destinationIndex !== index);
  }

  save(): void {
    if (this.destinations.length) this.dialogRef.close(this.destinations);
  }
}
