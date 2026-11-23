import { Injectable } from '@angular/core';

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

@Injectable({
  providedIn: 'root'
})
export class CsvExportService {
  createCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
    const headerRow = columns.map(column => this.escapeCell(column.header)).join(',');
    const dataRows = rows.map(row =>
      columns.map(column => this.escapeCell(column.value(row))).join(',')
    );

    return [headerRow, ...dataRows].join('\r\n');
  }

  downloadCsv<T>(fileName: string, rows: readonly T[], columns: readonly CsvColumn<T>[]): void {
    const blob = new Blob([this.createCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private escapeCell(value: CsvValue): string {
    const text = value === null || value === undefined
      ? ''
      : String(value).replace(/\r\n|\n|\r/g, ' ');
    const safeText = /^[\t ]*[=+\-@]/.test(text) ? `'${text}` : text;

    return /[",]/.test(safeText)
      ? `"${safeText.replace(/"/g, '""')}"`
      : safeText;
  }
}
