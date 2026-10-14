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
import { itemPackageMode } from '../../terms/term-standard';
import { expandColorAllocations } from '../../terms/request-expansion';
import { TermsService } from '../../terms/terms.service';
import {
  TermPlacementIssue,
  TermPlacementService,
  TermPlacementValues
} from '../../terms/term-placement.service';
import { TermPlacementReviewComponent } from '../../terms/term-placement-review.component';
import { AttributeOptions, SupplyList } from '../supplylist';
import { SupplyListService } from '../supplylist.service';

type BulkDraft = {
  source: string;
  alternativeText?: string;
  quantity: string;
  packageSize: string;
  item: string;
  brand: string;
  color: string;
  size: string;
  type: string;
  material: string;
  notes: string;
  incompletePackage: boolean;
  countChoice: string;
  preferenceBrand: string;
  choiceGroupId?: string;
  choiceGroupMode?: 'ONE_OF';
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
    MatInputModule,
    TermPlacementReviewComponent
  ]
})
export class SupplyListBulkEntryComponent implements OnInit {
  @Input({ required: true }) school = '';
  @Input({ required: true }) grade = '';
  @Output() readonly listChanged = new EventEmitter<string | undefined>();

  private readonly supplyListService = inject(SupplyListService);
  private readonly termsService = inject(TermsService);
  private readonly descriptionParser = inject(DescriptionParserService);
  private readonly termPlacement = inject(TermPlacementService);
  private readonly dialogService = inject(DialogService);
  private readonly snackBar = inject(MatSnackBar);

  text = '';
  drafts: BulkDraft[] = [];
  saving = false;
  termsReady = false;
  termsLoading = false;
  termsLoadFailed = false;
  terms: Terms = { item: [], brand: [], color: [], size: [], type: [], material: [] };

  // Stores the previous term placement values for each draft, allowing undo operations.
  private readonly placementUndo = new WeakMap<BulkDraft, TermPlacementValues>();
  private choiceGroupSequence = 0;

  // Provides hints for inferring the item based on the brand, used when the item field is not explicitly set.
  private readonly brandItemHints: Record<string, string[]> = {
    puffs: ['tissue', 'facial tissue'],
    kleenex: ['tissue', 'facial tissue'],
    clorox: ['disinfectant wipe', 'wipe', 'disinfecting wipe'],
    lysol: ['disinfectant wipe', 'wipe', 'disinfecting wipe', 'spray'],
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

  // Loads the terms from the service and updates the component state accordingly.
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

  // Previews the current text input by parsing it into unique drafts and displaying any duplicate line warnings.
  // Each line is treated as a separate draft, and the parsed attributes are used to populate the draft fields.
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

    this.drafts = uniqueLines.flatMap(source => this.draftsForLine(source));
  }

  private draftsForLine(source: string): BulkDraft[] {
    const alternatives = source.split(/\s+OR\s+/i).map(value => value.trim()).filter(Boolean);
    if (alternatives.length === 2) {
      const parsedAlternatives = alternatives.map(value => this.descriptionParser.parse(value, this.terms, this.brandItemHints));
      if (parsedAlternatives.every(parsed => !!parsed.item)) {
        const groupId = `choice-${Date.now()}-${++this.choiceGroupSequence}`;
        return parsedAlternatives.map((parsed, index) => this.draftFromParsed(
          source,
          parsed,
          alternatives[index],
          groupId
        ));
      }
    }
    const parsed = this.descriptionParser.parse(source, this.terms, this.brandItemHints);
    return expandColorAllocations(source, parsed).map(variant => this.draftFromParsed(source, variant));
  }

  private draftFromParsed(
    source: string,
    parsed: ReturnType<DescriptionParserService['parse']>,
    alternativeText?: string,
    choiceGroupId?: string
  ): BulkDraft {
    return {
      source,
      alternativeText,
      quantity: parsed.incompletePackage ? '' : parsed.quantity ?? '1',
      packageSize: itemPackageMode(parsed.item, this.terms) === 'PACKAGED' ? parsed.packageSize ?? '' : '1',
      item: parsed.item ?? '',
      brand: parsed.preferenceBrand ? '' : parsed.brand ?? '',
      color: parsed.color ?? '',
      size: parsed.size ?? '',
      type: parsed.type ?? '',
      material: parsed.material ?? '',
      notes: parsed.notes.join('; '),
      incompletePackage: parsed.incompletePackage === true,
      countChoice: parsed.countChoice ?? '',
      preferenceBrand: parsed.preferenceBrand ?? '',
      choiceGroupId,
      choiceGroupMode: choiceGroupId ? 'ONE_OF' : undefined
    };
  }

  // Removes the draft at the specified index from the list of current drafts.
  removeDraft(index: number): void {
    this.drafts = this.drafts.filter((_, draftIndex) => draftIndex !== index);
  }

  // Determines if the current drafts can be submitted based on validation rules,
  // such as having valid quantities and no placement issues.
  get canSubmit(): boolean {
    return !this.saving && this.drafts.length > 0 && this.drafts.every(draft =>
      !!draft.item.trim()
      && Number(draft.quantity) >= 1
      && (this.isPackaged(draft) || Number(draft.packageSize) === 1)
      && !draft.countChoice
      && !draft.preferenceBrand
      && this.placementIssues(draft).length === 0);
  }

  resolveBrandPreference(draft: BulkDraft, requireBrand: boolean): void {
    const brand = draft.preferenceBrand;
    if (!brand) return;
    draft.brand = requireBrand ? brand : '';
    draft.notes = [draft.notes.trim(), `${brand} preferred`].filter(Boolean).join('; ');
    draft.preferenceBrand = '';
  }

  // Analyzes the given draft for any term placement issues and returns a list of issues.
  placementIssues(draft: BulkDraft): TermPlacementIssue[] {
    return this.termPlacement.analyze(draft, this.terms, 'supplyList');
  }

  // Applies a fix to the term placement for the given draft based on the specified issue and conflict resolution preference.
  fixPlacement(
    draft: BulkDraft,
    event: { issue: TermPlacementIssue; keepExistingConflicts: boolean }
  ): void {
    this.placementUndo.set(draft, { ...draft });
    const fixed = this.termPlacement.apply(draft, event.issue, event.keepExistingConflicts);
    this.assignPlacementValues(draft, fixed);
  }

  // Reverts the last applied term placement fix for the given draft.
  undoPlacementFix(draft: BulkDraft): void {
    const previous = this.placementUndo.get(draft);
    if (!previous) return;
    this.assignPlacementValues(draft, previous);
    this.placementUndo.delete(draft);
  }

  // Checks if there is a previous term placement fix that can be undone for the given draft.
  canUndoPlacementFix(draft: BulkDraft): boolean {
    return this.placementUndo.has(draft);
  }

  // Clears the stored previous term placement values for the given draft, preventing undo.
  clearPlacementUndo(draft: BulkDraft): void {
    this.placementUndo.delete(draft);
  }

  // Adds all current drafts to the supply list, handling success and failure cases.
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

  // Confirms with the user before replacing the entire grade list with the current drafts.
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

  // Generates a human-readable description of the given draft, including quantity, package size, and attributes.
  description(draft: BulkDraft): string {
    const parts: string[] = [];
    const quantity = Number(draft.quantity);
    const packageSize = Number(draft.packageSize) || 1;
    if (quantity > 0) parts.push(`${quantity}x`);
    if (this.isPackaged(draft) && !draft.packageSize) parts.push('package of');
    if (packageSize > 1) parts.push(`${packageSize}ct.`);
    if (draft.size.trim()) parts.push(this.displayAttribute(draft.size));
    if (draft.color.trim()) parts.push(this.displayAttribute(draft.color));
    const item = draft.item.trim();
    if (item) parts.push(quantity > 1 ? this.pluralize(item) : item);
    for (const value of [draft.brand, draft.type, draft.material]) {
      const display = this.displayAttribute(value);
      if (display && !parts.some(part => part.toLowerCase().includes(display.toLowerCase()))) parts.push(display);
    }
    if (draft.notes.trim()) parts.push(`(${draft.notes.trim()})`);
    return parts.join(' ');
  }

  // Replaces all existing supply list items for the current school and grade with the current drafts.
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

  // Creates drafts for the given array of BulkDrafts by submitting them to the supply list service.
  private createDrafts(drafts: BulkDraft[]) {
    return forkJoin(drafts.map(draft => this.supplyListService.addSupplyList(this.toPayload(draft)).pipe(
      map(item => ({ draft, item }) as CreateResult),
      catchError(error => of({ draft, error } as CreateResult))
    )));
  }

  // Converts a BulkDraft into a Partial<SupplyList> payload suitable for submission to the service.
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
      packageSize: this.isPackaged(draft) ? (Number(draft.packageSize) || null) : 1,
      quantity: Number(draft.quantity) || 1,
      notes: draft.notes.trim(),
      sourceText: draft.source,
      parserVersion: 'terms-v2',
      choiceGroupId: draft.choiceGroupId,
      choiceGroupMode: draft.choiceGroupMode
    };
  }

  isPackaged(draft: BulkDraft): boolean {
    return itemPackageMode(draft.item, this.terms) === 'PACKAGED';
  }

  // Converts a string value into an AttributeOptions object, splitting by '|' for multiple options.
  private toAttribute(value: string): AttributeOptions {
    const normalized = value.trim();
    if (!normalized) return { exactly: '', anyOf: [] };
    if (normalized.includes('|')) {
      return { exactly: '', anyOf: normalized.split('|').map(term => term.trim()).filter(Boolean) };
    }
    return { exactly: normalized.split(',')[0].trim(), anyOf: [] };
  }

  // Splits the input string into non-empty lines, trimming whitespace from each line.
  private nonEmptyLines(value: string): string[] {
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  // Assigns the provided term placement values to the corresponding fields in the draft.
  private assignPlacementValues(draft: BulkDraft, values: TermPlacementValues): void {
    for (const field of ['item', 'brand', 'color', 'size', 'type', 'material', 'quantity', 'packageSize'] as const) {
      draft[field] = values[field] === null || values[field] === undefined ? '' : String(values[field]);
    }
  }

  private displayAttribute(value: string): string {
    const terms = value.split('|').map(term => term.trim()).filter(Boolean);
    if (terms.length === 2) return `(${terms.join(' or ')})`;
    if (terms.length > 2) return `(${terms.slice(0, -1).join(', ')}, or ${terms.at(-1)})`;
    return terms[0] ?? '';
  }

  private pluralize(item: string): string {
    if (/[^aeiou]y$/i.test(item)) return `${item.slice(0, -1)}ies`;
    if (/(?:s|x|z|ch|sh)$/i.test(item)) return `${item}es`;
    return item.endsWith('s') ? item : `${item}s`;
  }
}
