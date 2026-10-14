import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../shared/dialog/dialog.service';
import { Terms } from '../../terms/terms';
import { TermsService } from '../../terms/terms.service';
import { SupplyList } from '../supplylist';
import { SupplyListService } from '../supplylist.service';
import { SupplyListBulkEntryComponent } from './supply-list-bulk-entry.component';

const terms: Terms = {
  item: ['Glue Stick', 'Construction Paper', 'Crayon', 'Facial Tissue', 'Disinfectant Wipes', 'Folder', 'Marker', 'Dry Erase Marker'],
  brand: ['Kleenex', 'Expo'],
  color: ['Black', 'Blue', 'Green', 'Red', 'Yellow'],
  size: ['Large'],
  type: [],
  material: ['Paper']
};

function supply(id: string, item = 'Glue Stick'): SupplyList {
  return {
    _id: id,
    academicYear: '',
    school: 'MHS',
    grade: '1',
    teacher: '',
    item: [item],
    brand: { exactly: '', anyOf: [] },
    color: { exactly: '', anyOf: [] },
    size: { exactly: '', anyOf: [] },
    type: { exactly: '', anyOf: [] },
    material: { exactly: '', anyOf: [] },
    packageSize: 1,
    quantity: 1,
    notes: '',
    supplyID: '',
    invIDs: [],
    percentageFilled: 0
  };
}

describe('SupplyListBulkEntryComponent', () => {
  let fixture: ComponentFixture<SupplyListBulkEntryComponent>;
  let component: SupplyListBulkEntryComponent;
  let supplyService: jasmine.SpyObj<SupplyListService>;
  let dialogService: jasmine.SpyObj<DialogService>;
  let termsService: jasmine.SpyObj<TermsService>;
  let snackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    supplyService = jasmine.createSpyObj<SupplyListService>('SupplyListService', [
      'getSupplyList', 'addSupplyList', 'deleteSupplyList'
    ]);
    dialogService = jasmine.createSpyObj<DialogService>('DialogService', ['openDialog']);
    termsService = jasmine.createSpyObj<TermsService>('TermsService', ['getTerms']);
    termsService.getTerms.and.returnValue(of(terms));
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [SupplyListBulkEntryComponent],
      providers: [
        provideNoopAnimations(),
        { provide: SupplyListService, useValue: supplyService },
        { provide: TermsService, useValue: termsService },
        { provide: DialogService, useValue: dialogService },
        { provide: MatSnackBar, useValue: snackBar }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SupplyListBulkEntryComponent);
    component = fixture.componentInstance;
    component.school = 'MHS';
    component.grade = '1';
    fixture.detectChanges();
  });

  it('parses one request per line and keeps quantity separate from count', () => {
    component.text = '2 large glue sticks\n1 pack of 50 count construction paper';

    component.previewLines();

    expect(component.drafts.length).toBe(2);
    expect(component.drafts[0]).toEqual(jasmine.objectContaining({
      quantity: '2', size: 'Large', item: 'Glue Stick'
    }));
    expect(component.drafts[1]).toEqual(jasmine.objectContaining({
      quantity: '1', packageSize: '50', item: 'Construction Paper', material: ''
    }));
  });

  it('allows a packaged request with an unspecified count', () => {
    component.text = '1 box of crayons';

    component.previewLines();

    expect(component.drafts[0]).toEqual(jasmine.objectContaining({
      quantity: '1', packageSize: '', item: 'Crayon', incompletePackage: false
    }));
    expect(component.canSubmit).toBeTrue();
  });

  it('parses written quantities, ignores blank lines, and skips duplicate requests', () => {
    component.text = 'two glue sticks\n\nTWO GLUE STICKS\n1 construction paper';

    component.previewLines();

    expect(component.drafts.length).toBe(2);
    expect(component.drafts[0]).toEqual(jasmine.objectContaining({ quantity: '2', item: 'Glue Stick' }));
    expect(snackBar.open).toHaveBeenCalledWith('1 duplicate line(s) were skipped.', undefined, { duration: 3500 });
  });

  it('represents two item alternatives as a shared one-of group', () => {
    component.text = '2 boxes of Kleenex OR 1 container of disinfectant wipes';

    component.previewLines();

    expect(component.drafts.length).toBe(2);
    expect(component.drafts.map(draft => draft.item)).toEqual(['Facial Tissue', 'Disinfectant Wipes']);
    expect(component.drafts[0].choiceGroupId).toBeTruthy();
    expect(component.drafts[1].choiceGroupId).toBe(component.drafts[0].choiceGroupId);
    expect(component.drafts.every(draft => draft.choiceGroupMode === 'ONE_OF')).toBeTrue();
  });

  it('splits one-in-each-color folders into separate requests', () => {
    component.text = '4 double pocket folders (one in each color: blue, red, yellow, green)';

    component.previewLines();

    expect(component.drafts.length).toBe(4);
    expect(component.drafts.map(draft => ({ quantity: draft.quantity, color: draft.color }))).toEqual([
      { quantity: '1', color: 'Blue' },
      { quantity: '1', color: 'Red' },
      { quantity: '1', color: 'Yellow' },
      { quantity: '1', color: 'Green' }
    ]);
    expect(component.drafts.every(draft => draft.source === component.text)).toBeTrue();
  });

  it('splits a required color minimum from the remaining quantity', () => {
    component.text = '3 dry erase markers(at least 1 black or blue)';

    component.previewLines();

    expect(component.drafts.map(draft => ({ quantity: draft.quantity, color: draft.color }))).toEqual([
      { quantity: '1', color: 'Black | Blue' },
      { quantity: '2', color: '' }
    ]);
  });

  it('splits a specified color from a color-of-choice remainder', () => {
    component.text = '2 plastic folders-1 green & 1 color of your choice';

    component.previewLines();

    expect(component.drafts.map(draft => ({ quantity: draft.quantity, color: draft.color }))).toEqual([
      { quantity: '1', color: 'Green' },
      { quantity: '1', color: '' }
    ]);
  });

  it('requires a quantity decision for an unspecified set of individual markers', () => {
    component.text = '1 set of expo markers(preferably black but others are okay)';

    component.previewLines();

    expect(component.drafts[0]).toEqual(jasmine.objectContaining({
      item: 'Dry Erase Marker',
      brand: 'Expo',
      color: '',
      quantity: '',
      packageSize: '1',
      notes: 'preferably black but others are okay',
      incompletePackage: true
    }));
    expect(component.canSubmit).toBeFalse();
  });

  it('previews a large pasted list without dropping requests', () => {
    component.text = Array.from({ length: 250 }, (_, index) => `${index + 1} glue sticks`).join('\n');

    component.previewLines();

    expect(component.drafts.length).toBe(250);
    expect(component.drafts[249].quantity).toBe('250');
  });

  it('allows terms loading to be retried after an error', () => {
    termsService.getTerms.and.returnValue(throwError(() => ({ status: 500 })));
    component.loadTerms();
    expect(component.termsLoadFailed).toBeTrue();
    expect(component.termsReady).toBeFalse();

    termsService.getTerms.and.returnValue(of(terms));
    component.loadTerms();

    expect(component.termsLoadFailed).toBeFalse();
    expect(component.termsReady).toBeTrue();
  });

  it('adds each preview as an ordinary supply-list item', () => {
    supplyService.addSupplyList.and.callFake(payload => of(supply(
      payload.item?.[0] === 'Glue Stick' ? 'new-1' : 'new-2', payload.item?.[0]
    )));
    spyOn(component.listChanged, 'emit');
    component.text = '2 large glue sticks\n1 pack of 50 count construction paper';
    component.previewLines();

    component.addAll();

    expect(supplyService.addSupplyList).toHaveBeenCalledTimes(2);
    expect(supplyService.addSupplyList.calls.first().args[0]).toEqual(jasmine.objectContaining({
      school: 'MHS', grade: '1', quantity: 2, item: ['Glue Stick'],
      sourceText: '2 large glue sticks', parserVersion: 'terms-v2'
    }));
    expect(component.listChanged.emit).toHaveBeenCalledWith('new-2');
    expect(component.drafts).toEqual([]);
  });

  it('keeps only failed lines after a partial add', () => {
    let request = 0;
    supplyService.addSupplyList.and.callFake(() => {
      request += 1;
      return request === 1 ? of(supply('new-1')) : throwError(() => ({ status: 500 }));
    });
    spyOn(component.listChanged, 'emit');
    component.text = '2 large glue sticks\n1 construction paper';
    component.previewLines();

    component.addAll();

    expect(component.listChanged.emit).toHaveBeenCalledWith('new-1');
    expect(component.drafts.length).toBe(1);
    expect(component.drafts[0].item).toBe('Construction Paper');
    expect(component.text).toBe('1 construction paper');
  });

  it('creates the replacement before deleting the existing grade list', () => {
    const operations: string[] = [];
    supplyService.getSupplyList.and.returnValue(of([supply('old-1')]));
    supplyService.addSupplyList.and.callFake(() => {
      operations.push('create');
      return of(supply('new-1'));
    });
    supplyService.deleteSupplyList.and.callFake(id => {
      operations.push(`delete:${id}`);
      return of(undefined);
    });
    dialogService.openDialog.and.returnValue({ afterClosed: () => of(true) } as never);
    component.text = '2 large glue sticks';
    component.previewLines();

    component.confirmReplace();

    expect(supplyService.getSupplyList).toHaveBeenCalledWith({ school: 'MHS', grade: '1' });
    expect(operations).toEqual(['create', 'delete:old-1']);
  });

  it('does not delete partial server matches from another grade', () => {
    supplyService.getSupplyList.and.returnValue(of([
      supply('grade-1'),
      { ...supply('grade-10'), grade: '10' }
    ]));
    supplyService.addSupplyList.and.returnValue(of(supply('new-1')));
    supplyService.deleteSupplyList.and.returnValue(of(undefined));
    dialogService.openDialog.and.returnValue({ afterClosed: () => of(true) } as never);
    component.text = '2 large glue sticks';
    component.previewLines();

    component.confirmReplace();

    expect(supplyService.deleteSupplyList).toHaveBeenCalledWith('grade-1');
    expect(supplyService.deleteSupplyList).not.toHaveBeenCalledWith('grade-10');
  });

  it('finishes replacement and warns when an old item cannot be deleted', () => {
    supplyService.getSupplyList.and.returnValue(of([supply('old-1'), supply('old-2')]));
    supplyService.addSupplyList.and.returnValue(of(supply('new-1')));
    supplyService.deleteSupplyList.and.callFake(id =>
      id === 'old-1' ? throwError(() => ({ status: 500 })) : of(undefined));
    dialogService.openDialog.and.returnValue({ afterClosed: () => of(true) } as never);
    spyOn(component.listChanged, 'emit');
    component.text = '2 large glue sticks';
    component.previewLines();

    component.confirmReplace();

    expect(supplyService.deleteSupplyList).toHaveBeenCalledWith('old-1');
    expect(supplyService.deleteSupplyList).toHaveBeenCalledWith('old-2');
    expect(component.listChanged.emit).toHaveBeenCalledWith('new-1');
    expect(snackBar.open).toHaveBeenCalledWith(
      'New list saved, but 1 old item(s) could not be removed. Please review the grade list.',
      'OK',
      { duration: 7000 }
    );
  });

  it('keeps the old list when a replacement item cannot be created', () => {
    supplyService.getSupplyList.and.returnValue(of([supply('old-1')]));
    supplyService.addSupplyList.and.returnValue(throwError(() => ({ status: 500 })));
    dialogService.openDialog.and.returnValue({ afterClosed: () => of(true) } as never);
    component.text = '2 large glue sticks';
    component.previewLines();

    component.confirmReplace();

    expect(supplyService.deleteSupplyList).not.toHaveBeenCalledWith('old-1');
    expect(component.drafts.length).toBe(1);
  });
});
