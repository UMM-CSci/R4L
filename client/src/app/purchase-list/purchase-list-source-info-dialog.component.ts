import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import { PurchaseListSource } from './purchase-list';

interface PurchaseListSourceDialogData {
  itemDescription: string;
  sources: PurchaseListSource[];
}

@Component({
  selector: 'app-purchase-list-source-info-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    CommonModule
  ],
  templateUrl: './purchase-list-source-info-dialog.component.html',
  styleUrls: ['./purchase-list-source-info-dialog.component.scss']
})
export class PurchaseListSourceInfoDialogComponent {

  readonly data = inject<PurchaseListSourceDialogData>(MAT_DIALOG_DATA);

  perStudentLabel(source: PurchaseListSource): string {
    const packageSize = this.packageSize(source);
    if (packageSize > 1) {
      const packageUnit = source.quantityPerStudent === 1 ? 'pack' : 'packs';
      return `${source.quantityPerStudent} ${packageUnit} \u00D7 ${packageSize} ${this.itemUnitLabel(source, packageSize)}`;
    }
    return `${source.quantityPerStudent} ${this.itemUnitLabel(source, source.quantityPerStudent)}`;
  }

  totalNeededLabel(source: PurchaseListSource): string {
    return `${source.totalNeeded} ${this.itemUnitLabel(source, source.totalNeeded)}`;
  }

  private packageSize(source: PurchaseListSource): number {
    if (source.packageSize && source.packageSize > 0) {
      return source.packageSize;
    }
    const requestedPackages = source.studentCount * source.quantityPerStudent;
    if (requestedPackages <= 0 || source.totalNeeded % requestedPackages !== 0) {
      return 1;
    }
    return Math.max(1, source.totalNeeded / requestedPackages);
  }

  private itemUnitLabel(source: PurchaseListSource, quantity: number): string {
    const requestedItem = source.requestedItems.length === 1
      ? source.requestedItems[0].trim()
      : '';
    if (!requestedItem) {
      return quantity === 1 ? 'unit' : 'units';
    }
    return quantity === 1 || requestedItem.toLowerCase().endsWith('s')
      ? requestedItem
      : `${requestedItem}s`;
  }
}
