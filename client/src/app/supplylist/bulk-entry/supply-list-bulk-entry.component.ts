import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { DialogService } from '../../shared/dialog/dialog.service';
import { DescriptionParserService } from '../../terms/description-parser.service';
import { Terms } from '../../terms/terms';
import { TermsService } from '../../terms/terms.service';
import { AttributeOptions, SupplyList } from '../supplylist';
import { SupplyListService } from '../supplylist.service';

type BulkDraft = {
  source: string;
  quantity: string;
  packageSize: string;
  item: string;
  brand: string;
  color: string;
  size: string;
  type: string;
  material: string;
  notes: string;
};

type CreateResult = { draft: BulkDraft; item?: SupplyList; error?: unknown };

@Component({
  selector: 'app-supply-list-bulk-entry',
  standalone: true,
  templateUrl: './supply-list-bulk-entry.component.html',
  styleUrls: ['./supply-list-bulk-entry.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ]
})
export class SupplyListBulkEntryComponent implements OnInit {
  @Input({ required: true }) school = '';
  @Input({ required: true }) grade = '';
  @Output() readonly listChanged = new EventEmitter<string | undefined>();

  private readonly supplyListService = inject(SupplyListService);
  private readonly termsService = inject(TermsService);
  private readonly descriptionParser = inject(DescriptionParserService);
  private readonly dialogService = inject(DialogService);
  private readonly snackBar = inject(MatSnackBar);

  text = '';
  drafts: BulkDraft[] = [];
  saving = false;
  termsReady = false;
  termsLoading = false;
  termsLoadFailed = false;
  terms: Terms = { item: [], brand: [], color: [], size: [], type: [], material: [] };

  private readonly brandItemHints: Record<string, string[]> = {
    puffs: ['tissue', 'facial tissue'],
    kleenex: ['tissue', 'facial tissue'],
    clorox: ['disinfectant wipe', 'wipe', 'disinfecting wipe'],
    lysol: ['disinfectant wipe', 'wipe', 'disinfecting wipe', 'spray'],
    crayola: ['crayon', 'marker', 'colored pencil', 'paint', 'watercolor'],
    fiskars: ['scissors'],
    sharpie: ['marker', 'permanent marker'],
    expo: ['marker', 'dry erase marker', 'dry erase'],
    elmer: ['glue', 'glue stick'],
    scotch: ['tape', 'scissors'],
    avery: ['label', 'binder', 'divider'],
    'post-it': ['sticky note', 'note', 'flag'],
    ticonderoga: ['pencil'],
    dixon: ['pencil'],
    papermate: ['pencil', 'pen', 'eraser'],
    bic: ['pen', 'pencil', 'eraser'],
    pentel: ['pen', 'pencil', 'marker'],
    pilot: ['pen', 'marker'],
    hammermill: ['paper', 'copy paper'],
    astrobrights: ['paper', 'cardstock'],
    mead: ['notebook', 'folder', 'binder', 'composition book'],
    'five star': ['notebook', 'folder', 'binder'],
    oxford: ['index card', 'notebook'],
    purell: ['hand sanitizer', 'sanitizer'],
    'germ-x': ['hand sanitizer', 'sanitizer'],
    dial: ['soap', 'hand soap']
  };

  ngOnInit(): void {
    this.loadTerms();
  }

  loadTerms(): void {
    this.termsLoading = true;
    this.termsLoadFailed = false;
    this.termsService.getTerms().subscribe({
      next: terms => {
        this.terms = terms;
        this.termsReady = true;
        this.termsLoading = false;
      },
      error: () => {
        this.termsReady = false;
        this.termsLoading = false;
        this.termsLoadFailed = true;
        this.snackBar.open('The term list could not be loaded. Try again before previewing items.', 'OK', {
          duration: 6000
        });
      }
    });
  }

  previewLines(): void {
    if (!this.termsReady) {
      this.snackBar.open('The term list is still loading.', undefined, { duration: 2500 });
      return;
    }

    const lines = this.nonEmptyLines(this.text);
    const seen = new Set<string>();
    const uniqueLines = lines.filter(line => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const duplicateCount = lines.length - uniqueLines.length;
    if (duplicateCount) {
      this.snackBar.open(`${duplicateCount} duplicate line(s) were skipped.`, undefined, { duration: 3500 });
    }

    this.drafts = uniqueLines.map(source => {
      const parsed = this.descriptionParser.parse(source, this.terms, this.brandItemHints);
      return {
        source,
        quantity: parsed.quantity ?? '1',
        packageSize: parsed.packageSize ?? '1',
        item: parsed.item ?? '',
        brand: parsed.brand ?? '',
        color: parsed.color ?? '',
        size: parsed.size ?? '',
        type: parsed.type ?? '',
        material: parsed.material ?? '',
        notes: parsed.notes.join('; ')
      };
    });
  }

  removeDraft(index: number): void {
    this.drafts = this.drafts.filter((_, draftIndex) => draftIndex !== index);
  }

  get canSubmit(): boolean {
    return !this.saving && this.drafts.length > 0 && this.drafts.every(draft =>
      !!draft.item.trim() && Number(draft.quantity) >= 1 && Number(draft.packageSize) >= 1);
  }

  addAll(): void {
    if (!this.canSubmit) return;
    this.saving = true;
    this.createDrafts(this.drafts).subscribe(results => {
      const failed = results.filter(result => !!result.error);
      const created = results.filter(result => !!result.item);
      this.saving = false;
      this.drafts = failed.map(result => result.draft);
      this.text = this.drafts.map(draft => draft.source).join('\n');
      this.listChanged.emit(created.at(-1)?.item?._id);

      if (failed.length) {
        this.snackBar.open(
          `${created.length} item(s) added; ${failed.length} item(s) still need attention.`,
          'OK',
          { duration: 6000 }
        );
      } else {
        this.text = '';
        this.snackBar.open(`${created.length} item(s) added`, undefined, { duration: 3000 });
      }
    });
  }

  confirmReplace(): void {
    if (!this.canSubmit) return;
    const dialogRef = this.dialogService.openDialog({
      title: 'Replace Grade List',
      message: `Replace every existing ${this.school} · ${this.grade} request with these ${this.drafts.length} item(s)?`,
      buttonOne: 'Cancel',
      buttonTwo: 'Replace List'
    }, '480px', '240px');

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.replaceAll();
    });
  }

  description(draft: BulkDraft): string {
    const parts: string[] = [];
    const quantity = Number(draft.quantity) || 1;
    const packageSize = Number(draft.packageSize) || 1;
    parts.push(`${quantity}x`);
    if (packageSize > 1) parts.push(`${packageSize}ct.`);
    if (draft.size.trim()) parts.push(this.displayAttribute(draft.size));
    const item = draft.item.trim();
    if (item) parts.push(quantity > 1 ? this.pluralize(item) : item);
    for (const value of [draft.brand, draft.color, draft.type, draft.material]) {
      const display = this.displayAttribute(value);
      if (display && !parts.some(part => part.toLowerCase().includes(display.toLowerCase()))) parts.push(display);
    }
    if (draft.notes.trim()) parts.push(`(${draft.notes.trim()})`);
    return parts.join(' ');
  }

  private replaceAll(): void {
    this.saving = true;
    this.supplyListService.getSupplyList({ school: this.school, grade: this.grade }).pipe(
      switchMap(serverMatches => {
        const existing = serverMatches.filter(item =>
          item.school?.trim().toLowerCase() === this.school.trim().toLowerCase()
          && item.grade?.trim().toLowerCase() === this.grade.trim().toLowerCase());
        return this.createDrafts(this.drafts).pipe(
          switchMap(results => {
            const created = results.filter(result => !!result.item);
            const failed = results.filter(result => !!result.error);
            if (failed.length) {
              const createdIds = created.map(result => result.item?._id).filter((id): id is string => !!id);
              const rollback = createdIds.length
                ? forkJoin(createdIds.map(id => this.supplyListService.deleteSupplyList(id).pipe(catchError(() => of(undefined)))))
                : of([]);
              return rollback.pipe(map(() => ({
                existing,
                results,
                replacementFailed: true,
                deleted: undefined as boolean[] | undefined
              })));
            }
            const originalIds = existing.map(item => item._id).filter((id): id is string => !!id);
            const removals = originalIds.length
              ? forkJoin(originalIds.map(id => this.supplyListService.deleteSupplyList(id).pipe(
                map(() => true),
                catchError(error => of(error?.status === 404))
              )))
              : of([] as boolean[]);
            return removals.pipe(map(deleted => ({ existing, results, replacementFailed: false, deleted })));
          }));
      }),
      catchError(error => of({ requestError: error }))
    ).subscribe(result => {
      this.saving = false;
      if ('requestError' in result) {
        this.snackBar.open('The grade list could not be replaced. The existing list was left in place.', 'OK', {
          duration: 6000
        });
        return;
      }
      if (result.replacementFailed) {
        this.snackBar.open('No changes were made because one or more new items could not be saved.', 'OK', {
          duration: 6000
        });
        return;
      }

      const created = result.results.filter(entry => !!entry.item);
      const deleteFailures = result.deleted?.filter(deleted => !deleted).length ?? 0;
      this.text = '';
      this.drafts = [];
      this.listChanged.emit(created.at(-1)?.item?._id);
      this.snackBar.open(
        deleteFailures
          ? `New list saved, but ${deleteFailures} old item(s) could not be removed. Please review the grade list.`
          : `Grade list replaced with ${created.length} item(s)`,
        deleteFailures ? 'OK' : undefined,
        { duration: deleteFailures ? 7000 : 3500 }
      );
    });
  }

  private createDrafts(drafts: BulkDraft[]) {
    return forkJoin(drafts.map(draft => this.supplyListService.addSupplyList(this.toPayload(draft)).pipe(
      map(item => ({ draft, item }) as CreateResult),
      catchError(error => of({ draft, error } as CreateResult))
    )));
  }

  private toPayload(draft: BulkDraft): Partial<SupplyList> {
    return {
      school: this.school,
      grade: this.grade,
      item: [draft.item.trim()],
      brand: this.toAttribute(draft.brand),
      color: this.toAttribute(draft.color),
      size: this.toAttribute(draft.size),
      type: this.toAttribute(draft.type),
      material: this.toAttribute(draft.material),
      packageSize: Number(draft.packageSize) || 1,
      quantity: Number(draft.quantity) || 1,
      notes: draft.notes.trim()
    };
  }

  private toAttribute(value: string): AttributeOptions {
    const normalized = value.trim();
    if (!normalized) return { exactly: '', anyOf: [] };
    if (normalized.includes('|')) {
      return { exactly: '', anyOf: normalized.split('|').map(term => term.trim()).filter(Boolean) };
    }
    return { exactly: normalized.split(',')[0].trim(), anyOf: [] };
  }

  private nonEmptyLines(value: string): string[] {
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  private displayAttribute(value: string): string {
    return value.split('|').map(term => term.trim()).filter(Boolean).join(' or ');
  }

  private pluralize(item: string): string {
    if (/[^aeiou]y$/i.test(item)) return `${item.slice(0, -1)}ies`;
    if (/(?:s|x|z|ch|sh)$/i.test(item)) return `${item}es`;
    return item.endsWith('s') ? item : `${item}s`;
  }
}
