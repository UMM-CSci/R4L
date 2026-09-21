import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, startWith } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { SupplyListService } from '../supplylist.service';
import { TermsService } from '../../terms/terms.service';
import { Terms } from '../../terms/terms';
import { DescriptionParserService } from '../../terms/description-parser.service';
import { GRADES } from '../supplylist';
import { SettingsService } from '../../settings/settings.service';
import {
  SupplyListInventoryLinkDialogComponent,
  SupplyListInventoryLinkFilters
} from '../inventory-link-dialog/supply-list-inventory-link-dialog.component';

@Component({
  selector: 'app-add-supplylist',
  templateUrl: './add-supplylist.component.html',
  styleUrls: ['./add-supplylist.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSelectModule,
    MatAutocompleteModule,
    RouterLink,
    CommonModule
  ]
})
export class AddSupplyListComponent implements OnInit {
  private supplyListService = inject(SupplyListService);
  private termsService = inject(TermsService);
  private descriptionParser = inject(DescriptionParserService);
  private settingsService = inject(SettingsService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Schools loaded from settings for the dropdown
  availableSchools$ = this.settingsService.getSettings().pipe(
    map(settings => settings.schools.map(s => s.name))
  );

  // Grades list shared with add-family
  readonly grades = GRADES;

  // All terms loaded from the server
  private terms: Terms = { item: [], brand: [], color: [], size: [], type: [], material: [] };

  // Maps well-known brand names (lowercase) to item keywords to try when no item is detected.
  // Keywords are checked against this.terms.item using the same plural-aware matching.
  private readonly brandItemHints: Record<string, string[]> = {
    // Tissues
    'puffs': ['tissue', 'facial tissue'],
    'kleenex': ['tissue', 'facial tissue'],
    // Disinfecting
    'clorox': ['disinfectant wipe', 'wipe', 'disinfecting wipe'],
    'lysol': ['disinfectant wipe', 'wipe', 'disinfecting wipe', 'spray'],
    // Art / drawing
    'crayola': ['crayon', 'marker', 'colored pencil', 'paint', 'watercolor'],
    'fiskars': ['scissors'],
    'sharpie': ['marker', 'permanent marker'],
    'expo': ['marker', 'dry erase marker', 'dry erase'],
    // Adhesives / office
    'elmer': ['glue', 'glue stick'],
    'scotch': ['tape', 'scissors'],
    'avery': ['label', 'binder', 'divider'],
    'post-it': ['sticky note', 'note', 'flag'],
    // Writing
    'ticonderoga': ['pencil'],
    'dixon': ['pencil'],
    'papermate': ['pencil', 'pen', 'eraser'],
    'bic': ['pen', 'pencil', 'eraser'],
    'pentel': ['pen', 'pencil', 'marker'],
    'pilot': ['pen', 'marker'],
    // Paper
    'hammermill': ['paper', 'copy paper'],
    'astrobrights': ['paper', 'cardstock'],
    // Storage / organization
    'mead': ['notebook', 'folder', 'binder', 'composition book'],
    'five star': ['notebook', 'folder', 'binder'],
    'oxford': ['index card', 'notebook'],
    // Hygiene
    'purell': ['hand sanitizer', 'sanitizer'],
    'germ-x': ['hand sanitizer', 'sanitizer'],
    'dial': ['soap', 'hand soap'],
  };

  // Natural language description input
  descriptionInput = '';

  // Controls whether the preview card is visible
  showPreview = false;

  // Filtered suggestion lists for each autocomplete field
  filteredItem$!: Observable<string[]>;
  filteredBrand$!: Observable<string[]>;
  filteredColor$!: Observable<string[]>;
  filteredSize$!: Observable<string[]>;
  filteredType$!: Observable<string[]>;
  filteredMaterial$!: Observable<string[]>;

  addSupplyListForm = new FormGroup({
    school: new FormControl('', Validators.required),
    grade: new FormControl('', Validators.required),
    item: new FormControl('', Validators.required),
    brand: new FormControl(''),
    color: new FormControl(''),
    packageSize: new FormControl('', Validators.min(1)),
    size: new FormControl(''),
    type: new FormControl(''),
    material: new FormControl(''),
    quantity: new FormControl('', [Validators.required, Validators.min(1)]),
    notes: new FormControl(''),
    invIDs: new FormControl<string[]>([])
  });

  readonly validationMessages = {
    school: [{ type: 'required', message: 'School is required' }],
    grade: [{ type: 'required', message: 'Grade is required' }],
    item: [{ type: 'required', message: 'Item is required' }],
    brand: [{ type: 'required', message: 'Brand is required' }],
    color: [{ type: 'required', message: 'Color is required' }],
    packageSize: [
      { type: 'required', message: 'Count is required' },
      { type: 'min', message: 'Count must be at least 1' }
    ],
    size: [{ type: 'required', message: 'Size is required' }],
    type: [{ type: 'required', message: 'Type is required' }],
    material: [{ type: 'required', message: 'Material is required' }],
    quantity: [
      { type: 'required', message: 'Quantity is required' },
      { type: 'min', message: 'Quantity must be at least 1' }
    ],
    notes: [],
    invIDs: []
  };

  ngOnInit() {
    // Pre-populate school and grade from query params (when navigating from the supply list view)
    const school = this.route.snapshot.queryParamMap.get('school');
    const grade = this.route.snapshot.queryParamMap.get('grade');
    if (school) this.addSupplyListForm.patchValue({ school });
    if (grade) this.addSupplyListForm.patchValue({ grade });

    // Load terms from the server and wire up filtered observables
    this.termsService.getTerms().subscribe({
      next: (terms) => {
        this.terms = terms;
        this.filteredItem$ = this.filterFor('item', terms.item);
        this.filteredBrand$ = this.filterFor('brand', terms.brand);
        this.filteredColor$ = this.filterFor('color', terms.color);
        this.filteredSize$ = this.filterFor('size', terms.size);
        this.filteredType$ = this.filterFor('type', terms.type);
        this.filteredMaterial$ = this.filterFor('material', terms.material);
      },
      error: () => {
        // Terms are optional; autocomplete just will not suggest anything.
        this.filteredItem$ = of([]);
        this.filteredBrand$ = of([]);
        this.filteredColor$ = of([]);
        this.filteredSize$ = of([]);
        this.filteredType$ = of([]);
        this.filteredMaterial$ = of([]);
      }
    });
  }

  /** Returns an observable of suggestions filtered to the current field value. */
  private filterFor(controlName: string, allTerms: string[]): Observable<string[]> {
    return this.addSupplyListForm.get(controlName)!.valueChanges.pipe(
      startWith(''),
      map(value => {
        const lower = (value ?? '').toLowerCase();
        // Show suggestions for the last comma-separated token being typed
        const lastToken = lower.split(',').pop()?.trim() ?? '';
        if (!lastToken) {
          return allTerms.slice(0, 50);
        }
        return allTerms.filter(t => t.toLowerCase().includes(lastToken)).slice(0, 50);
      })
    );
  }

  formControlHasError(controlName: string): boolean {
    const control = this.addSupplyListForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getErrorMessage(controlName: keyof typeof this.validationMessages): string {
    const messages = this.validationMessages[controlName];
    for (const { type, message } of messages) {
      if (this.addSupplyListForm.get(controlName)?.hasError(type)) {
        return message;
      }
    }
    return 'Unknown error';
  }

  /**
   * Parses a natural language description (e.g. "1 box of 24 count Crayola crayons") and
   * pre-fills any form fields it can confidently identify. Unrecognised fields are left
   * as-is so the user can fill them manually. After parsing the preview card appears.
   */
  parseDescription(input: string): void {
    if (!input.trim()) return;
    const parsed = this.descriptionParser.parse(input, this.terms, this.brandItemHints);
    const { notes, ...patch } = parsed;
    if (notes.length) {
      const existing = (this.addSupplyListForm.get('notes')?.value ?? '').trim();
      patch['notes'] = [existing, ...notes].filter(Boolean).join('; ');
    }
    this.addSupplyListForm.patchValue(patch);
    this.showPreview = true;
  }

  /** Returns the parsed form values in a shape ready for display in the preview. */
  get previewValues() {
    return this.addSupplyListForm.value;
  }

  linkedInventoryIds(): string[] {
    return this.normalizeInventoryIds(this.addSupplyListForm.controls.invIDs.value);
  }

  linkedInventorySummary(): string {
    const linkedCount = this.linkedInventoryIds().length;
    return linkedCount === 0 ? 'No linked inventory' : `${linkedCount} linked item${linkedCount === 1 ? '' : 's'}`;
  }

  openInventoryLinkDialog(): void {
    const dialogRef = this.dialog.open(SupplyListInventoryLinkDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      data: {
        requirementLabel: this.requirementLabelFromForm(),
        selectedInventoryIds: this.linkedInventoryIds(),
        filters: this.inventoryFiltersFromForm()
      }
    });

    dialogRef.afterClosed().subscribe((selectedInventoryIds: string[] | undefined) => {
      if (selectedInventoryIds === undefined) {
        return;
      }

      this.addSupplyListForm.patchValue({
        invIDs: this.normalizeInventoryIds(selectedInventoryIds)
      });
      this.addSupplyListForm.controls.invIDs.markAsDirty();
    });
  }

  clearForm(): void {
    this.addSupplyListForm.reset();
    this.addSupplyListForm.patchValue({ invIDs: [] });
    this.descriptionInput = '';
    this.showPreview = false;
  }

  submitForm() {
    const raw = this.addSupplyListForm.value;
    // For AttributeOptions fields, '|' means anyOf; otherwise value is stored in exactly.
    const toAttr = (val: string | null | undefined): import('../supplylist').AttributeOptions => {
      if (!val || !val.trim()) {
        return { exactly: '', anyOf: [] };
      }
      if (val.includes('|')) {
        return { exactly: '', anyOf: val.split('|').map(s => s.trim()).filter(Boolean) };
      }
      return { exactly: val.split(',').map(s => s.trim()).filter(Boolean)[0] ?? '', anyOf: [] };
    };

    // Color keeps exactly/anyOf as string arrays.
    const toColorAttr = (val: string | null | undefined): import('../supplylist').AttributeOptions => {
      if (!val || !val.trim()) {
        return { exactly: "", anyOf: [] };
      }
      if (val.includes('|')) {
        return { exactly: "", anyOf: val.split('|').map(s => s.trim()).filter(Boolean) };
      }
      return { exactly: val.split(',').map(s => s.trim()).filter(Boolean)[0] ?? '', anyOf: [] };
    };

    const formData: Partial<import('../supplylist').SupplyList> = {
      school: raw.school ?? undefined,
      grade: raw.grade ?? undefined,
      item: raw.item ? raw.item.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      brand: toAttr(raw.brand),
      color: toColorAttr(raw.color),
      size: toAttr(raw.size),
      type: toAttr(raw.type),
      material: toAttr(raw.material),
      notes: raw.notes ?? undefined,
      packageSize: raw.packageSize ? parseInt(raw.packageSize, 10) : 1,
      quantity: raw.quantity ? parseInt(raw.quantity, 10) : 1,
      invIDs: raw.invIDs && raw.invIDs.length > 0 ? this.normalizeInventoryIds(raw.invIDs) : undefined
    };

    this.supplyListService.addSupplyList(formData).subscribe({
      next: () => {
        this.snackBar.open('Added supply list item', undefined, { duration: 2000 });
        this.router.navigate(['/supplylist']);
      },
      error: (err) => {
        this.snackBar.open(
          `Failed to add item - Error Code: ${err.status}\nMessage: ${err.message}`,
          'OK',
          { duration: 6000 }
        );
      }
    });
  }

  private inventoryFiltersFromForm(): SupplyListInventoryLinkFilters {
    const raw = this.addSupplyListForm.value;
    return {
      item: this.firstFilterToken(raw.item),
      brand: this.firstFilterToken(raw.brand),
      color: this.firstFilterToken(raw.color),
      size: this.firstFilterToken(raw.size),
      type: this.firstFilterToken(raw.type),
      material: this.firstFilterToken(raw.material)
    };
  }

  private requirementLabelFromForm(): string {
    const raw = this.addSupplyListForm.value;
    const parts = [
      raw.quantity ? `${raw.quantity}x` : undefined,
      raw.packageSize ? `${raw.packageSize}ct.` : undefined,
      this.firstFilterToken(raw.item),
      this.firstFilterToken(raw.brand),
      this.firstFilterToken(raw.color),
      this.firstFilterToken(raw.size),
      this.firstFilterToken(raw.type),
      this.firstFilterToken(raw.material)
    ].filter((value): value is string => !!value);

    return parts.join(' ') || 'New supply list item';
  }

  private firstFilterToken(value: string | null | undefined): string | undefined {
    const token = (value ?? '')
      .split(/[|,]/)
      .map(v => v.trim())
      .find(v => v && v !== 'N/A');
    return token || undefined;
  }

  private normalizeInventoryIds(ids: string[] | null | undefined): string[] {
    const normalized: string[] = [];

    for (const id of ids ?? []) {
      const trimmed = id.trim();
      if (trimmed && !normalized.includes(trimmed)) {
        normalized.push(trimmed);
      }
    }

    return normalized;
  }
}
