import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import {
  FloatingAction,
  FloatingActionMenuComponent
} from './floating-action-menu.component';

describe('FloatingActionMenuComponent', () => {
  let component: FloatingActionMenuComponent;
  let fixture: ComponentFixture<FloatingActionMenuComponent>;

  const actions: FloatingAction[] = [
    { id: 'export-csv', label: 'Export CSV', icon: 'table_chart' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingActionMenuComponent, NoopAnimationsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(FloatingActionMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('actions', actions);
    fixture.detectChanges();
  });

  it('reveals configured actions from the floating toggle', () => {
    expect(fixture.debugElement.query(By.css('[data-cy="floating-action-export-csv"]'))).toBeNull();

    fixture.debugElement.query(By.css('[data-cy="floating-action-toggle"]'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    const actionButton = fixture.debugElement.query(By.css('[data-cy="floating-action-export-csv"]'));
    expect(actionButton).toBeTruthy();
    expect(actionButton.attributes['aria-label']).toBe('Export CSV');
  });

  it('emits the selected action and closes the menu', () => {
    const emitSpy = spyOn(component.actionSelected, 'emit');
    component.toggleMenu();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-cy="floating-action-export-csv"]'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith('export-csv');
    expect(component.expanded()).toBeFalse();
  });

  it('does not render an empty floating menu', () => {
    fixture.componentRef.setInput('actions', []);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-cy="floating-action-toggle"]'))).toBeNull();
  });
});
