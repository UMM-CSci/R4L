// Angular Imports
import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal, viewChild, ChangeDetectionStrategy, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatTreeModule } from '@angular/material/tree';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DialogService } from '../shared/dialog/dialog.service';

// RxJS Imports
import { catchError, combineLatest, debounceTime, map, of, switchMap } from 'rxjs';

// Supply List Imports
import { SupplyList, AttributeOptions } from './supplylist';
import { SupplyListService } from './supplylist.service';
import {
  SupplyListInventoryLinkDialogComponent,
  SupplyListInventoryLinkFilters
} from './inventory-link-dialog/supply-list-inventory-link-dialog.component';
import { SupplyListBulkEntryComponent } from './bulk-entry/supply-list-bulk-entry.component';

// Auth
import { AuthService } from '../auth/auth-service';

// Component for managing the supply list modes, such as viewing, editing, and linking inventory items.
type SupplyListMode = 'view' | 'edit' | 'link';

@Component({
  selector: 'app-supplylist-component',
  standalone: true,
  templateUrl: './supplylist.component.html',
  styleUrls: ['./supplylist.component.scss'],
  imports: [
    MatTableModule,
    MatSortModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatDialogModule,
    MatSelectModule,
    MatOptionModule,
    MatRadioModule,
    MatListModule,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    MatTreeModule,
    MatExpansionModule,
    CommonModule,
    RouterLink,
    SupplyListBulkEntryComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class SupplyListComponent {
  // Table columns mirror the fields users scan when comparing supply needs.
  displayedColumns: string[] = [
    'school',
    'grade',
    'item',
    'brand',
    'color',
    'size',
    'type',
    'material',
    'packageSize',
    'quantity',
    'notes'
  ];

  dataSource = new MatTableDataSource<SupplyList>([]);
  readonly sort = viewChild<MatSort>(MatSort);

  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private dialogService = inject(DialogService);
  private supplylistService = inject(SupplyListService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  private hasScrolledToHighlight = false;
  private highlightScrollTimer: ReturnType<typeof setTimeout> | undefined;
  private scheduledHighlightId: string | undefined;
  readonly isWorkspacePage = this.route.snapshot.data['workspace'] === true;

  get canAddSupplyList(): boolean {
    return this.authService.hasPermission('add_supply_list');
  }

  get canEditSupplyList(): boolean {
    return this.authService.hasPermission('edit_supply_list');
  }

  get canDeleteSupplyList(): boolean {
    return this.authService.hasPermission('delete_supply_list');
  }

  get canUseEditMode(): boolean {
    return this.canAddSupplyList || this.canEditSupplyList || this.canDeleteSupplyList;
  }

  get noLinkedInventoryItems() {
    return (supply: SupplyList) => {
      return !supply.invIDs || supply.invIDs.length === 0;
    };
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelHighlightScroll());
    // Keep the Material data source in sync with the signal-backed server data.
    effect(() => {
      this.dataSource.data = this.visibleSupplyList();
    });
    effect(() => {
      const highlightedId = this.highlightedItemId();
      const itemExists = this.visibleSupplyList().some(item => item._id === highlightedId);
      if (!highlightedId || !itemExists || this.hasScrolledToHighlight) return;

      // Initial expansion events are not reliable during route navigation. Wait for the
      // list, panel animation, and router scroll position to settle, then find the row.
      this.scheduleHighlightScroll(highlightedId);
    });

    this.route.queryParamMap.subscribe(params => {
      const routeSchool = params.get('school')?.trim() || undefined;
      const routeGrade = params.get('grade')?.trim() || undefined;
      const routeHighlight = params.get('highlight')?.trim() || undefined;
      const routeMode = this.allowedMode(params.get('mode'));

      if (this.school() !== routeSchool) this.school.set(routeSchool);
      if (this.grade() !== routeGrade) this.grade.set(routeGrade);
      this.syncTextFilter(this.item, params.get('item'));
      this.syncTextFilter(this.brand, params.get('brand'));
      this.syncTextFilter(this.color, params.get('color'));
      this.syncTextFilter(this.size, params.get('size'));
      this.syncTextFilter(this.type, params.get('type'));
      this.syncTextFilter(this.material, params.get('material'));
      const routeQuantity = Number(params.get('quantity')) || undefined;
      if (this.quantity() !== routeQuantity) this.quantity.set(routeQuantity);
      if (this.mode() !== routeMode) this.mode.set(routeMode);
      if (this.highlightedItemId() !== routeHighlight) {
        this.highlightedItemId.set(routeHighlight);
        this.hasScrolledToHighlight = false;
      }

      if (routeHighlight) {
        this.supplylistService.getSupplyListById(routeHighlight).pipe(
          catchError(() => of(undefined))
        ).subscribe(item => this.highlightedSupplyItem.set(item));
      } else {
        this.highlightedSupplyItem.set(undefined);
      }
    });
  }

  // Signals hold the current filter state; toObservable bridges them into the
  // debounced server request below.
  school = signal<string | undefined>(this.route.snapshot.queryParamMap.get('school')?.trim() || undefined);
  grade = signal<string | undefined>(this.route.snapshot.queryParamMap.get('grade')?.trim() || undefined);
  mode = signal<SupplyListMode>(this.allowedMode(this.route.snapshot.queryParamMap.get('mode')));
  highlightedItemId = signal<string | undefined>(
    this.route.snapshot.queryParamMap.get('highlight')?.trim() || undefined
  );
  highlightedSupplyItem = signal<SupplyList | undefined>(undefined);
  private removedItemIds = signal<ReadonlySet<string>>(new Set());
  item = signal<string | undefined>(this.route.snapshot.queryParamMap.get('item')?.trim() || undefined);
  brand = signal<string | undefined>(this.route.snapshot.queryParamMap.get('brand')?.trim() || undefined);
  color = signal<string | undefined>(this.route.snapshot.queryParamMap.get('color')?.trim() || undefined);
  size = signal<string | undefined>(this.route.snapshot.queryParamMap.get('size')?.trim() || undefined);
  type = signal<string | undefined>(this.route.snapshot.queryParamMap.get('type')?.trim() || undefined);
  material = signal<string | undefined>(this.route.snapshot.queryParamMap.get('material')?.trim() || undefined);
  quantity = signal<number | undefined>(Number(this.route.snapshot.queryParamMap.get('quantity')) || undefined);

  errMsg = signal<string | undefined>(undefined);

  modeDescription = computed(() => {
    if (this.mode() === 'edit') return 'Add, update, or remove supply requests.';
    if (this.mode() === 'link') return 'Review and change inventory links without opening edit fields.';
    return 'Read the supply list without editing controls.';
  });

  // Incrementing this signal forces a re-fetch from the server (e.g. after a delete).
  private refreshTrigger = signal(0);

  // Observables for each filter signal
  private school$ = toObservable(this.school);
  private grade$ = toObservable(this.grade);
  private item$ = toObservable(this.item);
  private brand$ = toObservable(this.brand);
  private color$ = toObservable(this.color);
  private size$ = toObservable(this.size);
  private type$ = toObservable(this.type);
  private material$ = toObservable(this.material);
  private quantity$ = toObservable(this.quantity);
  private refresh$ = toObservable(this.refreshTrigger);

  /**
   * Combines filter signals into one debounced request stream. Filtering on the
   * server keeps the grouped view responsive even as the supply list grows.
   */
  private serverFilteredSupplyListState = toSignal(
    combineLatest([
      this.school$,
      this.grade$,
      this.item$,
      this.brand$,
      this.color$,
      this.size$,
      this.type$,
      this.material$,
      this.quantity$,
      this.refresh$
    ]).pipe(
      debounceTime(300),
      switchMap(([ school, grade, item, brand, color, size, type, material, quantity]) => {
        const filters = { school, grade, item, brand, color, size, type, material, ...(quantity === undefined ? {} : { quantity }) };
        return this.supplylistService.getSupplyList(filters).pipe(
          map(items => {
            this.errMsg.set(undefined);
            return {
              loaded: true,
              items: this.isWorkspacePage
                ? items.filter(supply => this.isWithinWorkspaceScope(supply, school, grade))
                : items
            };
          }),
          catchError((err) => {
            const msg = `Problem contacting the server - Error Code: ${err.status}\nMessage: ${err.message}`;
            this.errMsg.set(msg);
            this.snackBar.open(msg, 'OK', { duration: 6000 });
            return of({ loaded: true, items: [] as SupplyList[] });
          })
        );
      })
    ),
    { initialValue: { loaded: false, items: [] as SupplyList[] } }
  );

  serverFilteredSupplyList = computed(() => this.serverFilteredSupplyListState().items);

  visibleSupplyList = computed(() => {
    if (!this.serverFilteredSupplyListState().loaded) return [];
    const filtered = this.serverFilteredSupplyList().filter(item => !item._id || !this.removedItemIds().has(item._id));
    const highlighted = this.highlightedSupplyItem();
    if (!highlighted || highlighted._id !== this.highlightedItemId()
      || this.removedItemIds().has(highlighted._id)
      || filtered.some(item => item._id === highlighted._id)) return filtered;
    return [...filtered, highlighted];
  });

  groupedSupplyList = computed(() => {
    // Group by school -> grade -> teacher to match how staff distribute supply lists.
    type TeacherGroup = { teacher: string; items: SupplyList[] };
    type GradeGroup = { grade: string; teachers: TeacherGroup[] };
    type SchoolGroup = { school: string; grades: GradeGroup[] };
    const byName = (a: string, b: string) => a.localeCompare(b);

    const schoolMap = new Map<string, Map<string, Map<string, SupplyList[]>>>();
    const getOrCreate = <T>(map: Map<string, T>, key: string, init: () => T) => {
      if (!map.has(key)) map.set(key, init());
      return map.get(key)!;
    };

    for (const supply of this.visibleSupplyList()) {
      const school = supply.school || 'Unknown School';
      const grade = supply.grade || 'Unknown Grade';
      const teacher = supply.teacher || 'N/A';

      const gradeMap = getOrCreate(schoolMap, school, () => new Map<string, Map<string, SupplyList[]>>());
      const teacherMap = getOrCreate(gradeMap, grade, () => new Map<string, SupplyList[]>());
      const items = getOrCreate(teacherMap, teacher, () => []);

      items.push(supply);
    }

    const sortedSchools = Array.from(schoolMap.keys()).sort(byName);

    return sortedSchools.map((school): SchoolGroup => {
      const gradeMap = schoolMap.get(school)!;
      const sortedGrades = Array.from(gradeMap.keys()).sort(byName);

      return {
        school,
        grades: sortedGrades.map((grade): GradeGroup => {
          const teacherMap = gradeMap.get(grade)!;
          const sortedTeachers = Array.from(teacherMap.keys()).sort(byName);

          return {
            grade,
            teachers: sortedTeachers.map((teacher): TeacherGroup => ({
              teacher,
              items: teacherMap.get(teacher)!
            }))
          };
        })
      };
    });
  });

  parseStringArray(value: string): string[] {
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  setMode(mode: SupplyListMode): void {
    const allowed = this.allowedMode(mode);
    this.mode.set(allowed);
    if (allowed !== 'edit') this.cancelEdit();
    this.updateWorkspaceQuery({ mode: allowed, highlight: null });
  }

  setSchoolFilter(value: string | null | undefined): void {
    const school = value?.trim() || undefined;
    this.school.set(school);
    this.grade.set(undefined);
    this.updateWorkspaceQuery({ school: school ?? null, grade: null, highlight: null });
  }

  setGradeFilter(value: string | null | undefined): void {
    const grade = value?.trim() || undefined;
    this.grade.set(grade);
    this.updateWorkspaceQuery({ grade: grade ?? null, highlight: null });
  }

  workspaceQueryParams(school: string, grade?: string): Record<string, string> {
    return {
      school,
      ...(grade ? { grade } : {}),
      mode: this.mode(),
      returnUrl: this.router.url
    };
  }

  gradeWorkspaceQueryParams(school: string, grade: string): Record<string, string> {
    const mainReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl')?.trim();
    return {
      school,
      grade,
      mode: this.mode(),
      ...(mainReturnUrl ? { returnUrl: mainReturnUrl } : {}),
      schoolWorkspaceReturnUrl: this.router.url
    };
  }

  hasSchoolWorkspaceParent(): boolean {
    return this.isSafeSchoolWorkspaceUrl(
      this.route.snapshot.queryParamMap.get('schoolWorkspaceReturnUrl')?.trim()
    );
  }

  backToSchoolWorkspace(): void {
    const schoolWorkspaceReturnUrl = this.route.snapshot.queryParamMap.get('schoolWorkspaceReturnUrl')?.trim();
    if (this.isSafeSchoolWorkspaceUrl(schoolWorkspaceReturnUrl)) {
      void this.router.navigateByUrl(schoolWorkspaceReturnUrl!);
    }
  }

  leaveWorkspace(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const isSafeSupplyListUrl = returnUrl === '/supplylist' || returnUrl?.startsWith('/supplylist?');
    void (isSafeSupplyListUrl
      ? this.router.navigateByUrl(returnUrl)
      : this.router.navigate(['/supplylist']));
  }

  workspaceTitle(): string {
    const school = this.school() || 'Supply List';
    return this.grade() ? `${school} · ${this.grade()}` : school;
  }

  setAdvancedFilter(
    field: 'item' | 'brand' | 'color' | 'size' | 'type' | 'material',
    value: string | null | undefined
  ): void {
    const normalized = value?.trim() || undefined;
    this[field].set(normalized);
    this.updateWorkspaceQuery({ [field]: normalized ?? null, highlight: null });
  }

  isWorkspaceGrade(school: string, grade: string): boolean {
    return this.school()?.toLowerCase() === school.toLowerCase()
      && this.grade()?.toLowerCase() === grade.toLowerCase();
  }

  gradeItemCount(teachers: { items: SupplyList[] }[]): number {
    return teachers.reduce((count, teacher) => count + teacher.items.length, 0);
  }

  containsHighlightedItem(teachers: { items: SupplyList[] }[]): boolean {
    const highlightedId = this.highlightedItemId();
    return !!highlightedId && teachers.some(teacher => teacher.items.some(item => item._id === highlightedId));
  }

  onGradeExpanded(teachers: { items: SupplyList[] }[]): void {
    this.scrollToHighlightedItem(teachers);
  }

  scrollToHighlightedItem(teachers: { items: SupplyList[] }[]): void {
    const highlightedId = this.highlightedItemId();
    if (!highlightedId || this.hasScrolledToHighlight || !this.containsHighlightedItem(teachers)) return;

    this.performHighlightScroll(highlightedId);
  }

  private scheduleHighlightScroll(highlightedId: string, attemptsRemaining = 5): void {
    if (this.hasScrolledToHighlight) return;
    if (this.highlightScrollTimer) {
      if (this.scheduledHighlightId === highlightedId) return;
      clearTimeout(this.highlightScrollTimer);
    }
    this.scheduledHighlightId = highlightedId;
    this.highlightScrollTimer = setTimeout(() => {
      this.highlightScrollTimer = undefined;
      this.scheduledHighlightId = undefined;
      if (this.highlightedItemId() !== highlightedId || this.hasScrolledToHighlight) return;
      if (!this.performHighlightScroll(highlightedId) && attemptsRemaining > 1) {
        this.scheduleHighlightScroll(highlightedId, attemptsRemaining - 1);
      }
    }, 350);
  }

  private cancelHighlightScroll(): void {
    if (this.highlightScrollTimer) clearTimeout(this.highlightScrollTimer);
    this.highlightScrollTimer = undefined;
    this.scheduledHighlightId = undefined;
  }

  private performHighlightScroll(highlightedId: string): boolean {
    const row = this.document.getElementById(`supply-item-${highlightedId}`);
    if (!row) return false;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.hasScrolledToHighlight = true;
    return true;
  }

  isOutsideActiveFilters(id: string | undefined): boolean {
    return !!id && this.highlightedItemId() === id
      && !this.serverFilteredSupplyList().some(item => item._id === id);
  }

  addItemQueryParams(school = this.school(), grade = this.grade()): Record<string, string> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl')?.trim();
    const schoolWorkspaceReturnUrl = this.route.snapshot.queryParamMap.get('schoolWorkspaceReturnUrl')?.trim();
    return {
      ...(school ? { school } : {}),
      ...(grade ? { grade } : {}),
      ...(this.item() ? { item: this.item()! } : {}),
      ...(this.brand() ? { brand: this.brand()! } : {}),
      ...(this.color() ? { color: this.color()! } : {}),
      ...(this.size() ? { size: this.size()! } : {}),
      ...(this.type() ? { type: this.type()! } : {}),
      ...(this.material() ? { material: this.material()! } : {}),
      ...(this.quantity() !== undefined ? { quantity: String(this.quantity()) } : {}),
      ...(!this.isWorkspacePage && this.school() ? { returnSchool: this.school()! } : {}),
      ...(!this.isWorkspacePage && this.grade() ? { returnGrade: this.grade()! } : {}),
      ...(this.isWorkspacePage ? { returnTo: 'workspace' } : {}),
      ...(this.isWorkspacePage ? { workspaceScope: this.grade() ? 'grade' : 'school' } : {}),
      ...(this.isWorkspacePage && returnUrl ? { returnUrl } : {}),
      ...(this.isWorkspacePage && this.isSafeSchoolWorkspaceUrl(schoolWorkspaceReturnUrl)
        ? { schoolWorkspaceReturnUrl: schoolWorkspaceReturnUrl! }
        : {}),
      mode: 'edit'
    };
  }

  onBulkListChanged(highlightedId?: string): void {
    this.highlightedItemId.set(highlightedId);
    this.highlightedSupplyItem.set(undefined);
    this.hasScrolledToHighlight = false;
    this.updateWorkspaceQuery({ highlight: highlightedId ?? null });
    this.refreshTrigger.update(refresh => refresh + 1);
  }

  linkedInventorySummary(invIDs?: string[]): string {
    const linkedCount = this.normalizeInventoryIds(invIDs).length;
    return linkedCount === 0 ? 'No linked inventory' : `${linkedCount} linked item${linkedCount === 1 ? '' : 's'}`;
  }

  openInventoryLinkDialogForSupply(supply: SupplyList, saveOnClose: boolean): void {
    const dialogRef = this.dialog.open(SupplyListInventoryLinkDialogComponent, {
      width: '920px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      data: {
        requirementLabel: this.toLabel(supply),
        selectedInventoryIds: this.normalizeInventoryIds(supply.invIDs),
        actionLabel: saveOnClose ? 'Save Links' : 'Apply Links',
        filters: this.inventoryFiltersFromSupply(supply)
      }
    });

    dialogRef.afterClosed().subscribe((selectedInventoryIds: string[] | undefined) => {
      if (selectedInventoryIds === undefined) {
        return;
      }

      supply.invIDs = this.normalizeInventoryIds(selectedInventoryIds);
      if (saveOnClose) {
        this.saveEdit(supply);
      }
    });
  }

  /** Builds a compact human-readable label for an item, mirroring the server-side toString(). */
  toLabel(s: SupplyList): string {
    const attrStr = (a: AttributeOptions | undefined) => {
      return [a?.exactly, ...(a?.anyOf ?? [])].filter(v => v && v !== 'N/A').join('/');
    };
    const parts: string[] = [];
    const qty = s.quantity > 0 ? s.quantity : null;
    if (qty) parts.push(`${qty}x`);
    if (s.packageSize > 1) parts.push(`${s.packageSize}ct.`);
    const sizeStr = attrStr(s.size);
    if (sizeStr) parts.push(sizeStr);
    const itemStr = s.item?.join(' or ') ?? '';
    if (itemStr) {
      const plural = (qty === null || (qty ?? 0) > 1) && !itemStr.endsWith('s');
      parts.push(plural ? `${itemStr}s` : itemStr);
    }
    const brandStr = attrStr(s.brand); if (brandStr) parts.push(brandStr);
    const colorStr = attrStr(s.color); if (colorStr) parts.push(colorStr);
    const typeStr = attrStr(s.type); if (typeStr) parts.push(typeStr);
    const matStr = attrStr(s.material); if (matStr) parts.push(matStr);
    if (s.notes && s.notes !== 'N/A') parts.push(`(${s.notes})`);
    return parts.join(' ');
  }

  /** Prompts confirmation then deletes an item, removing it from the local grouped data. */
  confirmDelete(id: string | undefined) {
    if (!id) return;
    const dialogRef = this.dialogService.openDialog({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item?',
      buttonOne: 'Cancel',
      buttonTwo: 'Delete'
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.supplylistService.deleteSupplyList(id).subscribe({
        next: () => {
          this.removeDeletedItemFromView(id);
        },
        error: (err) => {
          if (err.status === 404) {
            // The row was already removed elsewhere, but may still be visible in this page's cached results.
            this.removeDeletedItemFromView(id);
            this.snackBar.open('Item was already removed', undefined, { duration: 3000 });
            return;
          }
          this.errMsg.set(`Problem deleting item – Error Code: ${err.status}\nMessage: ${err.message}`);
          this.snackBar.open(this.errMsg() ?? '', 'OK', { duration: 6000 });
        }
      });
    });
  }

  // Track which item is currently being edited
  editingItemId: string | null = null;
  private editingBackup: SupplyList | null = null;

  // Controls whether all grade panels are expanded
  allExpanded = signal(false);
  // Item-level filters stay collapsed by default because school and grade are
  // the most common way staff narrow this page.
  advancedFiltersExpanded = signal(false);

  toggleAll() {
    this.allExpanded.update(v => !v);
  }

  toggleAdvancedFilters() {
    this.advancedFiltersExpanded.update(expanded => !expanded);
  }

  startEdit(item: SupplyList) {
    this.editingItemId = item._id ?? null;
    this.editingBackup = this.cloneSupplyList(item);
  }

  cancelEdit() {
    if (this.editingBackup) {
      this.restoreEditedItem(this.editingBackup);
    }
    this.editingItemId = null;
    this.editingBackup = null;
  }

  saveEdit(item: SupplyList) {
    if (!item._id) return;
    this.supplylistService.editSupplyList(item._id, item).subscribe({
      next: () => {
        this.editingItemId = null;
        this.editingBackup = null;
        this.snackBar.open('Item updated', undefined, { duration: 2000 });
      },
      error: (err) => {
        this.errMsg.set(`Problem saving item – Error Code: ${err.status}\nMessage: ${err.message}`);
        this.snackBar.open(this.errMsg() ?? '', 'OK', { duration: 6000 });
      }
    });
  }

  resetFilters() {
    this.item.set(undefined);
    this.brand.set(undefined);
    this.color.set(undefined);
    this.size.set(undefined);
    this.type.set(undefined);
    this.material.set(undefined);
    if (!this.isWorkspacePage) {
      this.school.set(undefined);
      this.grade.set(undefined);
    }
    this.quantity.set(undefined);
    this.advancedFiltersExpanded.set(false);
    this.updateWorkspaceQuery({
      ...(!this.isWorkspacePage ? { school: null, grade: null } : {}),
      item: null,
      brand: null,
      color: null,
      size: null,
      type: null,
      material: null,
      quantity: null,
      highlight: null
    });
  }

  private removeDeletedItemFromView(id: string): void {
    this.removedItemIds.update(ids => new Set([...ids, id]));
    if (this.highlightedItemId() === id) {
      this.highlightedItemId.set(undefined);
      this.highlightedSupplyItem.set(undefined);
      this.updateWorkspaceQuery({ highlight: null });
    }
    this.refreshTrigger.update(n => n + 1);
  }

  private allowedMode(mode: string | null): SupplyListMode {
    if (mode === 'edit' && this.canUseEditMode) return 'edit';
    if (mode === 'link' && this.canEditSupplyList) return 'link';
    return 'view';
  }

  private isSafeSchoolWorkspaceUrl(url: string | undefined): boolean {
    return !!url
      && url.startsWith('/supplylist/workspace?')
      && /(?:^|[?&])school=/.test(url)
      && !/(?:^|[?&])grade=/.test(url);
  }

  private isWithinWorkspaceScope(supply: SupplyList, school?: string, grade?: string): boolean {
    const sameSchool = !school || supply.school?.trim().toLowerCase() === school.trim().toLowerCase();
    const sameGrade = !grade || supply.grade?.trim().toLowerCase() === grade.trim().toLowerCase();
    return sameSchool && sameGrade;
  }

  private updateWorkspaceQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private syncTextFilter(target: WritableSignal<string | undefined>, value: string | null): void {
    const normalized = value?.trim() || undefined;
    if (target() !== normalized) target.set(normalized);
  }

  private inventoryFiltersFromSupply(supply: SupplyList): SupplyListInventoryLinkFilters {
    return {
      item: this.firstInventoryItemToken(supply.item),
      brand: this.firstAttributeToken(supply.brand),
      color: this.firstAttributeToken(supply.color),
      size: this.firstAttributeToken(supply.size),
      type: this.firstAttributeToken(supply.type),
      material: this.firstAttributeToken(supply.material)
    };
  }

  private firstInventoryItemToken(items: string[] | undefined): string | undefined {
    return items?.map(item => item.trim()).find(item => !!item && item !== 'N/A');
  }

  private firstAttributeToken(attribute: AttributeOptions | undefined): string | undefined {
    return [
      attribute?.exactly,
      ...(attribute?.anyOf ?? [])
    ].map(value => value?.trim()).find(value => !!value && value !== 'N/A');
  }

  private normalizeInventoryIds(ids: string[] | undefined): string[] {
    const normalized: string[] = [];

    for (const id of ids ?? []) {
      const trimmed = id.trim();
      if (trimmed && !normalized.includes(trimmed)) {
        normalized.push(trimmed);
      }
    }

    return normalized;
  }

  private restoreEditedItem(backup: SupplyList): void {
    this.restoreItemInCollection(this.serverFilteredSupplyList(), backup);
    this.restoreItemInCollection(this.dataSource.data, backup);
    this.dataSource.data = [...this.dataSource.data];
  }

  private restoreItemInCollection(items: SupplyList[], backup: SupplyList): void {
    const item = items.find(i => i._id === backup._id);
    if (item) {
      Object.assign(item, this.cloneSupplyList(backup));
    }
  }

  private cloneSupplyList(item: SupplyList): SupplyList {
    return JSON.parse(JSON.stringify(item));
  }
}
export { SupplyListService };
