import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth-service';
import { FamilyService } from '../family/family.service';
import { NeededItemLog } from '../family/family';
import { SupplyList } from '../supplylist/supplylist';
import { SupplyListService } from '../supplylist/supplylist.service';
import { TermsService } from '../terms/terms.service';
import { ItemPackageMode, Terms } from '../terms/terms';
import { TermPlacementService, TermPlacementValues } from '../terms/term-placement.service';

type NeededItemGroup = {
  key: string;
  sectionTitle: string;
  guardianName: string;
  items: NeededItemLog[];
};

type UnknownTermReview = {
  key: string;
  term: string;
  canonicalTerm: string;
  records: SupplyList[];
};

type PlacementReview = { record: SupplyList; messages: string[] };

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink
  ],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})

export class AdminPanelComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly familyService = inject(FamilyService);
  private readonly supplyListService = inject(SupplyListService);
  private readonly termsService = inject(TermsService);
  private readonly termPlacement = inject(TermPlacementService);

  readonly neededItemLogs = signal<NeededItemLog[]>([]);
  readonly unknownTermReviews = signal<UnknownTermReview[]>([]);
  readonly placementReviews = signal<PlacementReview[]>([]);
  readonly reviewingTerm = signal<string | undefined>(undefined);
  readonly neededItemGroups = computed(() => {
    const groups = new Map<string, NeededItemGroup>();

    for (const log of this.neededItemLogs()) {
      const key = `${log.familyId}-${log.sectionId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          sectionTitle: log.sectionTitle,
          guardianName: log.guardianName,
          items: []
        });
      }

      groups.get(key)!.items.push(log);
    }

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        items: [...group.items].sort((first, second) => first.label.localeCompare(second.label))
      }))
      .sort((first, second) =>
        first.guardianName.localeCompare(second.guardianName)
        || first.sectionTitle.localeCompare(second.sectionTitle));
  });

  ngOnInit(): void {
    this.familyService.getNeededItemLogs().subscribe(logs => {
      this.neededItemLogs.set(logs);
    });
    this.loadTermReviews();
  }

  loadTermReviews(): void {
    forkJoin({
      supplyList: this.supplyListService.getSupplyList(),
      terms: this.termsService.getTerms()
    }).subscribe(({ supplyList, terms }) => this.buildTermReviews(supplyList, terms));
  }

  approveTerm(review: UnknownTermReview, packageMode: ItemPackageMode): void {
    review.canonicalTerm = review.canonicalTerm.trim();
    if (!review.canonicalTerm) return;
    this.reviewingTerm.set(review.key);
    this.termsService.approveItemTerm(review.canonicalTerm, packageMode).pipe(
      switchMap(() => {
        const updates = review.records
          .filter(record => !!record._id)
          .map(record => this.supplyListService.editSupplyList(record._id, {
            ...record,
            item: (record.item ?? []).map(item =>
              item.trim().toLowerCase() === review.term.toLowerCase() ? review.canonicalTerm : item),
            packageSize: packageMode === 'INDIVIDUAL' ? 1 : record.packageSize
          }));
        return updates.length ? forkJoin(updates) : of([]);
      })
    ).subscribe({
      next: () => {
        this.reviewingTerm.set(undefined);
        this.loadTermReviews();
      },
      error: () => this.reviewingTerm.set(undefined)
    });
  }

  requestLabel(record: SupplyList): string {
    return record.sourceText?.trim() || record.item?.join(' or ') || 'Supply request';
  }

  private buildTermReviews(supplyList: SupplyList[], terms: Terms): void {
    const knownItems = new Set((terms.item ?? []).map(item => item.trim().toLowerCase()));
    const unknown = new Map<string, UnknownTermReview>();
    const placements: PlacementReview[] = [];

    for (const record of supplyList) {
      for (const item of record.item ?? []) {
        const term = item.trim();
        const key = term.toLowerCase();
        if (term && !knownItems.has(key)) {
          const review = unknown.get(key) ?? {
            key,
            term,
            canonicalTerm: this.titleCase(term),
            records: []
          };
          review.records.push(record);
          unknown.set(key, review);
        }
      }

      const messages = this.termPlacement.analyze(this.placementValues(record), terms, 'supplyList')
        .map(issue => issue.message);
      if (messages.length) placements.push({ record, messages });
    }

    this.unknownTermReviews.set([...unknown.values()].sort((a, b) => a.term.localeCompare(b.term)));
    this.placementReviews.set(placements);
  }

  private placementValues(record: SupplyList): TermPlacementValues {
    const attribute = (value: { exactly?: string; anyOf?: string[] } | undefined) =>
      value?.exactly?.trim() || (value?.anyOf ?? []).filter(Boolean).join(' | ');
    return {
      item: record.item?.join(', ') ?? '',
      brand: attribute(record.brand),
      color: attribute(record.color),
      size: attribute(record.size),
      type: attribute(record.type),
      material: attribute(record.material),
      quantity: record.quantity,
      packageSize: record.packageSize
    };
  }

  private titleCase(value: string): string {
    return value.replace(/\b\w/g, letter => letter.toUpperCase());
  }

  reasonLabel(reason: string): string {
    switch (reason) {
    case 'item_not_avaliable':
    case 'item_not_available':
      return 'Item not available';
    case 'not_available_didnt_receive':
      return 'Not received';
    default:
      return reason;
    }
  }
}
