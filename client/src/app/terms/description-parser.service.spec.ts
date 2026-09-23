import { DescriptionParserService } from './description-parser.service';
import { Terms } from './terms';

describe('DescriptionParserService', () => {
  const parser = new DescriptionParserService();
  const terms: Terms = {
    item: ['Construction Paper', 'Glue Stick', 'Crayon', 'Marker', 'Pencil'],
    brand: ["Elmer's", 'Crayola'],
    color: ['Red', 'Blue'],
    size: ['Large'],
    type: ['Washable'],
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

  it('separates package size from item and type', () => {
    const parsed = parser.parse('24-count Crayola washable markers', terms);
    expect(parsed.packageSize).toBe('24');
    expect(parsed.quantity).toBeUndefined();
    expect(parsed.brand).toBe('Crayola');
    expect(parsed.type).toBe('Washable');
    expect(parsed.item).toBe('Marker');
  });

  it('distinguishes a leading quantity from a later package count', () => {
    const parsed = parser.parse('3 boxes of 24-count crayons', terms);
    expect(parsed.quantity).toBe('3');
    expect(parsed.packageSize).toBe('24');
    expect(parsed.item).toBe('Crayon');
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

  it('takes the longest overlapping item phrase', () => {
    expect(parser.parse('glue sticks', { ...terms, item: ['Glue', 'Glue Stick'] }).item).toBe('Glue Stick');
  });

  it('collects matching terms only once', () => {
    expect(parser.parse('red and red crayons', terms).color).toBe('Red');
  });

  it('uses a brand hint even when the stored item is plural', () => {
    const vocabulary = { ...terms, item: ['Tissues'], brand: ['Kleenex'] };
    expect(parser.parse('Kleenex', vocabulary, { kleenex: ['tissue'] }).item).toBe('Tissues');
  });
});
