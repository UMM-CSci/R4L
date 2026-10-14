import { DescriptionParserService } from './description-parser.service';
import { Terms } from './terms';

describe('DescriptionParserService', () => {
  const parser = new DescriptionParserService();
  const terms: Terms = {
    item: ['Construction Paper', 'Glue Stick', 'Crayon', 'Marker', 'Washable Marker', 'Pencil'],
    brand: ["Elmer's", 'Crayola'],
    color: ['Red', 'Blue', 'Black'],
    size: ['Large'],
    type: ['Wide Tip'],
    material: ['Paper']
  };

  it('claims the whole item before its material substring', () => {
    const parsed = parser.parse('Construction paper', terms);
    expect(parsed.item).toBe('Construction Paper');
    expect(parsed.material).toBeUndefined();
  });

  it('extracts a plural item, brand, size and quantity without reuse', () => {
    const parsed = parser.parse("2 large Elmer's glue sticks", terms);
    expect(parsed).toEqual({ notes: [], quantity: '2', item: 'Glue Stick', brand: "Elmer's", size: 'Large' });
  });

  it('recognizes a written leading quantity', () => {
    const parsed = parser.parse('two glue sticks', terms);
    expect(parsed.quantity).toBe('2');
    expect(parsed.item).toBe('Glue Stick');
  });

  it('uses a local or only for alternatives in that field', () => {
    const parsed = parser.parse('red or blue construction paper', terms);
    expect(parsed.color).toBe('Red | Blue');
    expect(parsed.item).toBe('Construction Paper');
    expect(parsed.material).toBeUndefined();
  });

  it('treats an Oxford-comma color list as alternatives without using and', () => {
    const parsed = parser.parse('Blue, Black, or Red folders', {
      ...terms,
      item: ['Folder']
    });
    expect(parsed.color).toBe('Blue | Black | Red');
    expect(parsed.item).toBe('Folder');
  });

  it('treats multiple recognized attribute values as alternatives even when the input says and', () => {
    expect(parser.parse('Blue and Red folders', { ...terms, item: ['Folder'] }).color)
      .toBe('Blue | Red');
  });

  it('separates package size from item and type', () => {
    const parsed = parser.parse('24-count Crayola washable markers', terms);
    expect(parsed.packageSize).toBe('24');
    expect(parsed.quantity).toBeUndefined();
    expect(parsed.brand).toBe('Crayola');
    expect(parsed.type).toBeUndefined();
    expect(parsed.item).toBe('Washable Marker');
  });

  it('recognizes a written package count without treating it as quantity', () => {
    const parsed = parser.parse('ten count washable markers', terms);
    expect(parsed.packageSize).toBe('10');
    expect(parsed.quantity).toBeUndefined();
    expect(parsed.type).toBeUndefined();
    expect(parsed.item).toBe('Washable Marker');
  });

  it('distinguishes a leading quantity from a later package count', () => {
    const parsed = parser.parse('3 boxes of 24-count crayons', terms);
    expect(parsed.quantity).toBe('3');
    expect(parsed.packageSize).toBe('24');
    expect(parsed.item).toBe('Crayon');
  });

  it('allows a packaged item to omit its package count', () => {
    for (const [description, quantity] of [
      ['1 box of crayons', '1'],
      ['two packs of crayons', '2'],
      ['1 bag of crayons', '1'],
      ['one container of crayons', '1']
    ]) {
      const parsed = parser.parse(description, terms);
      expect(parsed.quantity).withContext(description).toBe(quantity);
      expect(parsed.packageSize).withContext(description).toBeUndefined();
      expect(parsed.incompletePackage).withContext(description).toBeFalse();
      expect(parsed.item).withContext(description).toBe('Crayon');
    }
  });

  it('flattens package arithmetic for an individual item', () => {
    const parsed = parser.parse('2 packs of 10 pencils', terms);
    expect(parsed.quantity).toBe('20');
    expect(parsed.packageSize).toBe('1');
    expect(parsed.item).toBe('Pencil');
  });

  it('requires a choice for count ranges', () => {
    const parsed = parser.parse('230–280 ct. construction paper', terms);
    expect(parsed.countChoice).toBe('230 or 280');
    expect(parsed.packageSize).toBeUndefined();
  });

  it('keeps preferred brands unresolved for the user', () => {
    const parsed = parser.parse('Crayola preferred markers', terms);
    expect(parsed.preferenceBrand).toBe('Crayola');
    expect(parsed.item).toBe('Marker');
  });

  it('keeps a flexible color preference in notes instead of requiring the color', () => {
    const parsed = parser.parse(
      '1 set of expo markers(preferably black but others are okay)',
      {
        ...terms,
        item: [...terms.item, 'Dry Erase Marker'],
        brand: [...terms.brand, 'Expo']
      },
      { expo: ['marker', 'dry erase marker', 'dry erase'] }
    );

    expect(parsed.item).toBe('Dry Erase Marker');
    expect(parsed.brand).toBe('Expo');
    expect(parsed.color).toBeUndefined();
    expect(parsed.notes).toEqual(['preferably black but others are okay']);
    expect(parsed.quantity).toBeUndefined();
    expect(parsed.packageSize).toBe('1');
    expect(parsed.incompletePackage).toBeTrue();
  });

  it('accepts a package quantity when the item count is explicit', () => {
    const parsed = parser.parse('1 box of 24 crayons', terms);
    expect(parsed.quantity).toBe('1');
    expect(parsed.packageSize).toBe('24');
    expect(parsed.incompletePackage).toBeUndefined();
  });

  it('parses a leading pack quantity separately from a later count', () => {
    const parsed = parser.parse('1 pack of 50 count construction paper', terms);
    expect(parsed).toEqual({
      notes: [],
      quantity: '1',
      packageSize: '50',
      item: 'Construction Paper'
    });
  });

  it('does not make unrelated fields alternatives because one field has or', () => {
    const parsed = parser.parse('red or blue large glue sticks', terms);
    expect(parsed.color).toBe('Red | Blue');
    expect(parsed.size).toBe('Large');
    expect(parsed.item).toBe('Glue Stick');
  });

  it('matches singular and plural aliases without changing canonical terms', () => {
    expect(parser.parse('crayons', terms).item).toBe('Crayon');
    expect(parser.parse('marker', { ...terms, item: ['Markers'] }).item).toBe('Markers');
    expect(parser.parse('brushes', { ...terms, item: ['Brush'] }).item).toBe('Brush');
    expect(parser.parse('candies', { ...terms, item: ['Candy'] }).item).toBe('Candy');
  });

  it('requires word boundaries instead of matching inside other words', () => {
    expect(parser.parse('pencil', { ...terms, item: ['Pen'] }).item).toBeUndefined();
  });

  it('normalizes numeric measurements without enumerating every alias', () => {
    expect(parser.parse('4oz liquid glue', { ...terms, item: ['Liquid Glue'] }).size).toBe('4 oz');
    expect(parser.parse('8" x 5" pencil box', { ...terms, item: ['Pencil Box'] }).size).toBe('8 in x 5 in');
  });

  it('takes the longest overlapping item phrase', () => {
    expect(parser.parse('glue sticks', { ...terms, item: ['Glue', 'Glue Stick'] }).item).toBe('Glue Stick');
  });

  it('normalizes common school-list item wording', () => {
    const vocabulary: Terms = {
      ...terms,
      item: [
        ...terms.item,
        'Liquid Glue', 'Pencil Box', 'Pencil Pouch', 'Loose-Leaf Paper',
        'Notebook', 'Single-Subject Notebook', 'Single-Subject Spiral Notebook'
      ],
      type: [...terms.type, 'Single Subject', 'Wide Ruled']
    };

    expect(parser.parse('1 bottle of glue', vocabulary).item).toBe('Liquid Glue');
    expect(parser.parse('1 pencil zipper pouch', vocabulary).item).toBe('Pencil Pouch');
    expect(parser.parse('1 pencil/crayon box', vocabulary).item).toBe('Pencil Box');
    expect(parser.parse('wide ruled filler paper', vocabulary).item).toBe('Loose-Leaf Paper');
    expect(parser.parse('3 single subject wide-ruled notebooks', vocabulary)).toEqual(jasmine.objectContaining({
      item: 'Single-Subject Notebook',
      type: 'Wide Ruled'
    }));
    expect(parser.parse('2 single subject spiral bound wide-ruled notebooks', vocabulary)).toEqual(
      jasmine.objectContaining({ item: 'Single-Subject Spiral Notebook', type: 'Wide Ruled' })
    );
  });

  it('uses Washable Marker when washable modifies a separated marker phrase', () => {
    expect(parser.parse('wide markers (basic colors - washable)', terms).item).toBe('Washable Marker');
  });

  it('collects matching terms only once', () => {
    expect(parser.parse('red and red crayons', terms).color).toBe('Red');
  });

  it('uses a brand hint even when the stored item is plural', () => {
    const vocabulary = { ...terms, item: ['Tissues'], brand: ['Kleenex'] };
    expect(parser.parse('Kleenex', vocabulary, { kleenex: ['tissue'] }).item).toBe('Tissues');
  });
});
