import { TestBed } from '@angular/core/testing';

import { CsvColumn, CsvExportService } from './csv-export.service';

interface TestRow {
  item: string;
  needed: number;
}

describe('CsvExportService', () => {
  let service: CsvExportService;

  const columns: CsvColumn<TestRow>[] = [
    { header: 'Item', value: row => row.item },
    { header: 'Needed Units', value: row => row.needed }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CsvExportService);
  });

  it('creates column headers and a row with the configured values', () => {
    const csv = service.createCsv(
      [{ item: 'Markers', needed: 12 }],
      columns
    );

    expect(csv).toBe('Item,Needed Units\r\nMarkers,12');
  });

  it('escapes commas, quotes, line breaks, and spreadsheet formulas', () => {
    const csv = service.createCsv(
      [{ item: '=SUM("Markers, washable")\nnext', needed: 12 }],
      columns
    );

    expect(csv).toBe('Item,Needed Units\r\n"\'=SUM(""Markers, washable"") next",12');
  });

  it('returns the configured headers when there are no rows', () => {
    expect(service.createCsv([], columns)).toBe('Item,Needed Units');
  });

  it('downloads the CSV with the requested file name', () => {
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:csv');
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    service.downloadCsv('inventory.csv', [{ item: 'Markers', needed: 12 }], columns);

    const link = clickSpy.calls.mostRecent().object as HTMLAnchorElement;
    expect(link.download).toBe('inventory.csv');
    expect(createObjectUrlSpy).toHaveBeenCalledWith(jasmine.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:csv');
  });
});
