import { DescriptionParserService } from './description-parser.service';
import { TermPlacementService } from './term-placement.service';

describe('TermPlacementService', () => {
  const service = new TermPlacementService(new DescriptionParserService());

  it('keeps a compound item together instead of reusing paper as material', () => {
    expect(service.analyze({ item: 'Construction Paper' })).toEqual([]);
  });

  it('moves a written quantity out of the item field', () => {
    const issue = service.analyze({ item: 'two folder' })[0];
    expect(issue.changes).toEqual(jasmine.objectContaining({ item: 'Folder', quantity: 2 }));
  });

  it('moves size while keeping the complete compound item', () => {
    const issue = service.analyze({ item: 'Large Glue Stick' })[0];
    expect(issue.changes).toEqual(jasmine.objectContaining({ item: 'Glue Stick', size: 'Large' }));
  });

  it('separates a package count from a plural item', () => {
    const issue = service.analyze({ item: '50 count crayons' })[0];
    expect(issue.changes).toEqual(jasmine.objectContaining({ item: 'Crayon', packageSize: 50 }));
  });

  it('reports a conflict instead of silently replacing an existing value', () => {
    const issue = service.analyze({ item: 'Red Folder', color: 'Blue' })[0];
    expect(issue.conflicts).toEqual([{ field: 'color', currentValue: 'Blue', suggestedValue: 'Red' }]);
  });

  it('normalizes known aliases even when they are already in the right field', () => {
    const issue = service.analyze({ item: 'folders' })[0];
    expect(issue.changes.item).toBe('Folder');
  });

  it('normalizes canonical capitalization and singular item names', () => {
    expect(service.analyze({ color: 'red' })[0].changes.color).toBe('Red');
    expect(service.analyze({ item: 'backpack' })[0].changes.item).toBe('Backpack');
    expect(service.analyze({ item: 'backpacks' })[0].changes.item).toBe('Backpack');
  });

  it('recognizes a brand embedded in the item field', () => {
    const issue = service.analyze({ item: 'Elmers Glue Stick' })[0];
    expect(issue.changes).toEqual(jasmine.objectContaining({ item: 'Glue Stick', brand: "Elmer's" }));
  });

  it('moves misplaced package size and size values', () => {
    expect(service.analyze({ type: '200ct' })[0].changes)
      .toEqual(jasmine.objectContaining({ type: '', packageSize: 200 }));
    expect(service.analyze({ type: 'Small' })[0].changes)
      .toEqual(jasmine.objectContaining({ type: '', size: 'Small' }));
  });

  it('leaves a valid compound binder and unknown item unchanged', () => {
    expect(service.analyze({ item: '3-Ring Binder' })).toEqual([]);
    expect(service.analyze({ item: 'Unrecognized Classroom Thing' })).toEqual([]);
    expect(service.analyze({ item: 'two unrecognized classroom things' })).toEqual([]);
  });

  it('allows valid any-of alternatives only for supply list fields', () => {
    expect(service.analyze({ color: 'Red | Blue' }, undefined, 'supplyList')).toEqual([]);
    expect(service.analyze({ brand: 'Crayola | Expo' }, undefined, 'supplyList')).toEqual([]);
  });

  it('normalizes each recognized any-of alternative', () => {
    expect(service.analyze({ color: 'red | blue' }, undefined, 'supplyList')[0].changes.color).toBe('Red | Blue');
  });

  it('requires one inventory value instead of writing alternatives into a scalar field', () => {
    const pipeIssue = service.analyze({ color: 'Blue | Red' })[0];
    const wordingIssue = service.analyze({ item: 'Blue or Red folders' })[0];

    expect(pipeIssue.fixable).toBeFalse();
    expect(pipeIssue.changes).toEqual({});
    expect(wordingIssue.fixable).toBeFalse();
    expect(wordingIssue.message).toContain('one color value');
  });

  it('allows correctly placed inventory fields alongside an unknown item and brand', () => {
    expect(service.analyze({
      item: 'Notebook',
      brand: 'Five Star',
      color: 'Yellow',
      size: 'Regular',
      type: 'Wide Ruled',
      material: 'Paper',
      packageSize: 1,
      quantity: 2
    })).toEqual([]);
  });

  it('separates the folder identity from its secondary feature', () => {
    const issue = service.analyze({ item: '3-prong, 2-pocket folder' })[0];
    expect(issue.changes).toEqual(jasmine.objectContaining({ item: '3-Prong Folder', type: '2-Pocket' }));
  });

  it('can preserve an existing conflicting field while cleaning the source', () => {
    const values = { item: 'Red Folder', color: 'Blue' };
    const issue = service.analyze(values)[0];
    expect(service.apply(values, issue, true)).toEqual({ item: 'Folder', color: 'Blue' });
    expect(service.apply(values, issue, false)).toEqual({ item: 'Folder', color: 'Red' });
  });
});
