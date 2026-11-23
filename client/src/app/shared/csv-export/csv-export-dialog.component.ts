import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { CsvColumn, CsvExportService } from './csv-export.service';

export interface CsvExportDialogData<T> {
  fileName: string;
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
}

@Component({
  selector: 'app-csv-export-dialog',
  standalone: true,
  templateUrl: './csv-export-dialog.component.html',
  styleUrls: ['./csv-export-dialog.component.scss'],
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ]
})
export class CsvExportDialogComponent<T> {
  private csvExportService = inject(CsvExportService);
  private dialogRef = inject(MatDialogRef<CsvExportDialogComponent<T>>);
  readonly data = inject<CsvExportDialogData<T>>(MAT_DIALOG_DATA);

  fileName = this.data.fileName;
  selectedColumns: CsvColumn<T>[] = [...this.data.columns];

  selectAllColumns(): void {
    this.selectedColumns = [...this.data.columns];
  }

  clearColumns(): void {
    this.selectedColumns = [];
  }

  setColumnSelected(column: CsvColumn<T>, selected: boolean): void {
    this.selectedColumns = selected
      ? [...this.selectedColumns, column]
      : this.selectedColumns.filter(selectedColumn => selectedColumn !== column);
  }

  exportCsv(): void {
    const fileName = this.fileName.trim();
    if (!fileName || this.data.rows.length === 0 || this.selectedColumns.length === 0) {
      return;
    }

    const columns = this.data.columns.filter(column =>
      this.selectedColumns.includes(column)
    );
    const csvFileName = fileName.toLowerCase().endsWith('.csv')
      ? fileName
      : `${fileName}.csv`;
    this.csvExportService.downloadCsv(csvFileName, this.data.rows, columns);
    this.dialogRef.close(true);
  }
}
