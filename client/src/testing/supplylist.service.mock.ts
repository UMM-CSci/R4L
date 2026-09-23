import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AppComponent } from 'src/app/app.component';
import { SupplyList } from '../app/supplylist/supplylist';
import { SupplyListService } from 'src/app/supplylist/supplylist.service';

@Injectable({
  providedIn: AppComponent
})

export class MockSupplyListService implements Pick<SupplyListService, 'getSupplyList'> {
  // Static test supply list data used across all mock methods
  static testSupplyList: SupplyList[] = [
    {
      _id: '1',
      academicYear: '2023-2024',
      teacher: 'Ms. Smith',
      school: "MHS",
      grade: "PreK",
      item: ["Markers"],
      brand: { exactly: "Crayola", anyOf: []},
      color: { exactly: "", anyOf: []},
      packageSize: 8,
      size: { exactly: "Wide", anyOf: []},
      type: { exactly: "Washable", anyOf: []},
      material: { exactly: "N/A", anyOf: []},
      quantity: 0,
      notes: "N/A",
      supplyID: "N/A",
      invIDs: [],
      percentageFilled: 0
    },
    {
      _id: '2',
      academicYear: '2023-2024',
      teacher: 'Mr. Johnson',
      school: "Herman",
      grade: "preK",
      item: ["Folder"],
      brand: { exactly: "N/A", anyOf: []},
      color: { exactly: "Red", anyOf: []},
      packageSize: 1,
      size: { exactly: "N/A", anyOf: []},
      type: { exactly: "2 Prong", anyOf: []},
      material: { exactly: "Plastic", anyOf: []},
      quantity: 0,
      notes: "N/A",
      supplyID: "N/A",
      invIDs: [],
      percentageFilled: 0
    },
    {
      _id: '3',
      academicYear: '2023-2024',
      teacher: 'Ms. Lee',
      school: "MHS",
      grade: "6th grade",
      item: ["Notebook"],
      brand: { exactly: "Five Star", anyOf: []},
      color: { exactly: "Yellow", anyOf: []},
      packageSize: 1,
      size: { exactly: "Wide Ruled", anyOf: []},
      type: { exactly: "Spiral", anyOf: []},
      material: { exactly: "N/A", anyOf: []},
      quantity: 0,
      notes: "N/A",
      supplyID: "N/A",
      invIDs: [],
      percentageFilled: 0
    }
  ];

  /* eslint-disable @typescript-eslint/no-unused-vars */
  // Get the supply list based on filters
  getSupplyList(_filters: { school?: string, grade?: string, item?: string, brand?: string, color?: string, size?: string, type?: string, material?: string }): Observable<SupplyList[]> {
    return of(MockSupplyListService.testSupplyList);
  }

  // Get a supply list item by its ID
  getSupplyListById(id: string): Observable<SupplyList> {
    return of(MockSupplyListService.testSupplyList.find(item => item._id === id)
      ?? { ...MockSupplyListService.testSupplyList[0], _id: id });
  }

  // Add a new supply list item
  addSupplyList(newItem: Partial<SupplyList>): Observable<SupplyList> {
    return of({
      ...MockSupplyListService.testSupplyList[0], // Use the first test supply list item as a base for the new item
      ...newItem, // Override the base item with the new item's properties
      _id: 'new-supply-item' // Assign a new ID for the newly added supply list item
    });
  }

  // Delete a supply list item by its ID
  deleteSupplyList(_id: string): Observable<unknown> {
    return of(undefined);
  }

  // Edit an existing supply list item by its ID
  editSupplyList(_id: string, _updatedItem: Partial<SupplyList>): Observable<void> {
    return of(undefined);
  }
}
