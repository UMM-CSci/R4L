import { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import type { PurchaseListSource } from './purchase-list';
import { PurchaseListSourceInfoDialogComponent } from './purchase-list-source-info-dialog.component';

describe('PurchaseListSourceInfoDialogComponent', () => {
  let fixture: ComponentFixture<PurchaseListSourceInfoDialogComponent>;
  let dialogData: { itemDescription: string; sources: PurchaseListSource[] };

  const sources: PurchaseListSource[] = [
    {
      supplyListId: 'SL-1',
      school: 'Morris Area Elementary School',
      grade: '5',
      teacher: 'Ms. Doe',
      requestedItems: ['Marker'],
      supplyListDescription: '2x Markers',
      studentCount: 12,
      quantityPerStudent: 2,
      packageSize: 1,
      totalNeeded: 24
    },
    {
      supplyListId: 'SL-2',
      school: 'Morris Area High School',
      grade: 'High School',
      teacher: '',
      requestedItems: ['Marker'],
      supplyListDescription: '1x 12ct Marker',
      studentCount: 6,
      quantityPerStudent: 1,
      packageSize: 12,
      totalNeeded: 72
    }
  ];

  beforeEach(async () => {
    dialogData = {
      itemDescription: 'Blue markers',
      sources
    };

    await TestBed.configureTestingModule({
      imports: [
        PurchaseListSourceInfoDialogComponent
      ],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useFactory: () => dialogData
        }
      ]
    }).compileComponents();
  });

  it('displays the purchase-list item description and source table columns', () => {
    createComponent();

    const title = fixture.debugElement.query(By.css('h2')).nativeElement.textContent.trim();
    const headers = fixture.debugElement.queryAll(By.css('thead th'))
      .map(header => header.nativeElement.textContent.trim());

    expect(title).toBe('Sources For Blue markers');
    expect(headers).toEqual([
      'School',
      'Grade',
      'Teacher',
      'Supply List Item',
      'Students',
      'Per Student',
      'Total Units Needed'
    ]);
  });

  it('displays each source row with school, grade, teacher, and quantities', () => {
    createComponent();

    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    const firstRowCells = cellText(rows[0]);
    const secondRowCells = cellText(rows[1]);

    expect(firstRowCells).toEqual([
      'Morris Area Elementary School',
      '5',
      'Ms. Doe',
      '2x Markers',
      '12',
      '2 Markers',
      '24 Markers'
    ]);
    expect(secondRowCells).toEqual([
      'Morris Area High School',
      'High School',
      'N/A',
      '1x 12ct Marker',
      '6',
      '1 pack × 12 Markers',
      '72 Markers'
    ]);
  });

  it('derives package size for a previously saved source that does not contain it', () => {
    dialogData = {
      itemDescription: 'Blue markers',
      sources: [{ ...sources[1], packageSize: undefined }]
    };

    createComponent();

    const rowCells = cellText(fixture.debugElement.query(By.css('tbody tr')));
    expect(rowCells[5]).toBe('1 pack × 12 Markers');
    expect(rowCells[6]).toBe('72 Markers');
  });

  it('shows an empty state when there are no sources', () => {
    dialogData = {
      itemDescription: 'Glue sticks',
      sources: []
    };

    createComponent();

    expect(fixture.nativeElement.textContent).toContain('No Sources Found');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(PurchaseListSourceInfoDialogComponent);
    fixture.detectChanges();
  }

  function cellText(row: DebugElement): string[] {
    return row.queryAll(By.css('td'))
      .map(cell => cell.nativeElement.textContent?.trim() ?? '');
  }
});
