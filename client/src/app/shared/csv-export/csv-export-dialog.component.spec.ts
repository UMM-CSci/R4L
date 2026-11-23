import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import {
  CsvExportDialogComponent,
  CsvExportDialogData
} from './csv-export-dialog.component';
import { CsvColumn, CsvExportService } from './csv-export.service';

interface TestRow {
  item: string;
  quantity: number;
}

describe('CsvExportDialogComponent', () => {
  let component: CsvExportDialogComponent<TestRow>;
  let fixture: ComponentFixture<CsvExportDialogComponent<TestRow>>;
  let csvExportService: jasmine.SpyObj<CsvExportService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<CsvExportDialogComponent<TestRow>>>;

  const rows: TestRow[] = [{ item: 'Markers', quantity: 12 }];
  const columns: CsvColumn<TestRow>[] = [
    { header: 'Item', value: row => row.item },
    { header: 'Quantity', value: row => row.quantity }
  ];
  const dialogData: CsvExportDialogData<TestRow> = {
    fileName: 'inventory.csv',
    rows,
    columns
  };

  beforeEach(async () => {
    csvExportService = jasmine.createSpyObj<CsvExportService>('CsvExportService', ['downloadCsv']);
    dialogRef = jasmine.createSpyObj<MatDialogRef<CsvExportDialogComponent<TestRow>>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [CsvExportDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: CsvExportService, useValue: csvExportService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CsvExportDialogComponent<TestRow>);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('selects every available column initially', () => {
    expect(component.selectedColumns).toEqual(columns);
  });

  it('shows the number of rows and selected columns', () => {
    const exportSize = fixture.debugElement.query(By.css('[data-cy="csv-export-size"]'));

    expect(exportSize.nativeElement.textContent).toContain('1 row');
    expect(exportSize.nativeElement.textContent).toContain('2 of 2 columns');
  });

  it('clears and selects all available columns', () => {
    fixture.debugElement.query(By.css('[data-cy="csv-clear-columns"]'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    expect(component.selectedColumns).toEqual([]);

    fixture.debugElement.query(By.css('[data-cy="csv-select-all-columns"]'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    expect(component.selectedColumns).toEqual(columns);
  });

  it('starts with the default filename and exports an edited filename', () => {
    const fileNameInput = fixture.debugElement.query(By.css('[data-cy="csv-file-name"]'))
      .nativeElement as HTMLInputElement;
    expect(fileNameInput.value).toBe('inventory.csv');

    fileNameInput.value = 'school-supplies';
    fileNameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-cy="csv-dialog-export"]'))
      .triggerEventHandler('click');

    expect(csvExportService.downloadCsv).toHaveBeenCalledWith(
      'school-supplies.csv',
      rows,
      columns
    );
  });

  it('uses the shared dialog layout and surface styles', () => {
    expect(fixture.debugElement.query(By.css('.app-dialog-shell'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.app-dialog-header'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.app-panel-muted'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.app-action-row-end'))).not.toBeNull();
  });

  it('downloads only checked columns and closes the dialog', () => {
    const checkboxes = fixture.debugElement.queryAll(By.css('[data-cy="csv-column-option"]'));
    checkboxes[0].triggerEventHandler('change', { checked: false });
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-cy="csv-dialog-export"]'))
      .triggerEventHandler('click');

    expect(csvExportService.downloadCsv).toHaveBeenCalledWith(
      'inventory.csv',
      rows,
      [columns[1]]
    );
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('disables download when no columns are selected', () => {
    component.selectedColumns = [];
    fixture.detectChanges();

    const exportButton = fixture.debugElement.query(By.css('[data-cy="csv-dialog-export"]'));
    expect(exportButton.nativeElement.disabled).toBeTrue();
  });

  it('disables download when the filename is empty', () => {
    const fileNameInput = fixture.debugElement.query(By.css('[data-cy="csv-file-name"]'))
      .nativeElement as HTMLInputElement;
    fileNameInput.value = '   ';
    fileNameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const exportButton = fixture.debugElement.query(By.css('[data-cy="csv-dialog-export"]'));
    expect(exportButton.nativeElement.disabled).toBeTrue();
  });
});
