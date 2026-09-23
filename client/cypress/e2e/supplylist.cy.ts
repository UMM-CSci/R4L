import { SupplyListPage } from "../support/supplylist.po";

const page = new SupplyListPage();
const FILTERS_TEST = {
  school: 'Hancock',
  grade: 'Kindergarten',
};

const HANCOCK_GROUP = {
  school: 'Hancock Elementary School',
  grade: 'Kindergarten',
  teacher: 'N/A',
  item: 'Binder',
};

describe('Supply List', () => {
  before(() => {
    cy.task('seed:database');
  });

  beforeEach(() => {
    cy.loginAsRole('admin');
    page.navigateTo();
  });

  it('Should have the correct title', () => {
    page.getAppTitle().should('contain', 'Supply List');
  });

  it('Should navigate to Supply List via Operations menu and back to Home', () => {
    cy.visit('/');

    // Open Operations dropdown in desktop nav and click Supply List
    page.clickOperationsMenu();
    cy.contains('[mat-menu-item]', 'Supply List').click();
    cy.url().should('match', /\/supplylist$/);

    // Navigate back home using the app title link
    cy.get('.app-title').click();
    cy.url().should('match', /^https?:\/\/[^/]+\/?$/);
  });

  it('Should display Supply List items', () => {
    cy.url().should('match', /\/supplylist$/);
    page.getResultsCard().should('contain', 'Hancock Elementary');
  });

  // Cypress tests to ensure the filter boxes are there
  // for all specification fields

  it('Should have specification filters', () => {
    cy.url().should('match', /\/supplylist$/);

    // Expand advanced filters to make item/brand/color/size/type/material visible
    cy.get('.advanced-filter-toggle').click();

    const errors: string[] = [];

    const recordError = (message: string) => {
      errors.push(message);
      cy.log(message);
      console.warn(message);
    }
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="filter-school"]').length === 0) {
        recordError(`Empty filter input for School`);
      }
      if ($body.find('[data-cy="filter-item"]').length === 0) {
        recordError(`Empty filter input for Item`);
      }
      if ($body.find('[data-cy="filter-brand"]').length === 0) {
        recordError(`Empty filter input for Brand`);
      }
      if ($body.find('[data-cy="filter-color"]').length === 0) {
        recordError(`Empty filter input for Color`);
      }
      if ($body.find('[data-cy="filter-size"]').length === 0) {
        recordError(`Empty filter input for Size`);
      }
      if ($body.find('[data-cy="filter-type"]').length === 0) {
        recordError(`Empty filter input for Type`);
      }
      if ($body.find('[data-cy="filter-material"]').length === 0) {
        recordError(`Empty filter input for Material`);
      }
    });

    cy.then(() => {
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }
    });
  });

  it('Should have grade filter', () => {
    cy.url().should('match', /\/supplylist$/);

    const errors: string[] = [];

    const recordError = (message: string) => {
      errors.push(message);
      cy.log(message);
      console.warn(message);
    }
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="filter-grade"]').length === 0) {
        recordError(`Empty filter input for Grade`);
      }
    });
  });

  it("Should be able to take an input and display the correct filtered results", () => {
    cy.intercept('GET', '/api/supplylist*').as('filterSupplyList');

    cy.get('[data-cy="filter-school"]').type(FILTERS_TEST.school);
    cy.get('[data-cy="filter-grade"]').type(FILTERS_TEST.grade);

    cy.wait('@filterSupplyList');

    page.getSupplyListSchool().should('have.length', 1);
    page.getResultsCard().should('contain', HANCOCK_GROUP.school);
    page.getResultsCard().should('not.contain', 'Chokio-Alberta Elementary');
    page.expandGradePanel(HANCOCK_GROUP.school, HANCOCK_GROUP.grade);
    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .should('exist');
    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .should('contain', HANCOCK_GROUP.item);
    page.getResultsCard().should('not.contain', '1st Grade');
  });

  it('Should have the tree view', () => {
    page.getResultsCard().should('exist');
    page.getSupplyListSchool().its('length').should('be.greaterThan', 0);
  });

  it('Should display grouped items when a grade panel is expanded', () => {
    page.expandGradePanel(HANCOCK_GROUP.school, HANCOCK_GROUP.grade);
    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .should('contain', 'Teacher(s):');
    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .should('contain', 'Backpack');
    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .should('contain', HANCOCK_GROUP.item);
  });

  it('Should enter inline edit mode when edit is clicked', () => {
    cy.get('[data-cy="mode-edit"]').click();
    page.expandGradePanel(HANCOCK_GROUP.school, HANCOCK_GROUP.grade);
    page.getFirstItemRow(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .scrollIntoView()
      .find('[data-cy="edit-item"]')
      .click();

    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .find('[data-cy="save-item"]')
      .should('be.visible');
    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .find('[data-cy="cancel-edit"]')
      .should('be.visible');
  });

  it('Should leave inline edit mode when Cancel is clicked', () => {
    cy.get('[data-cy="mode-edit"]').click();
    page.expandGradePanel(HANCOCK_GROUP.school, HANCOCK_GROUP.grade);
    page.getFirstItemRow(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .scrollIntoView()
      .find('[data-cy="edit-item"]')
      .click();

    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .find('[data-cy="cancel-edit"]')
      .click();

    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .find('[data-cy="edit-item"]')
      .should('be.visible');
    page.getTeacherGroup(HANCOCK_GROUP.school, HANCOCK_GROUP.grade, HANCOCK_GROUP.teacher)
      .find('[data-cy="save-item"]')
      .should('not.exist');
  });

  it('Should preserve school-workspace context while visiting a grade workspace', () => {
    const school = HANCOCK_GROUP.school;
    cy.visit(`/supplylist/workspace?school=${encodeURIComponent(school)}&mode=edit&returnUrl=%2Fsupplylist`);
    page.expandGradePanel(school, HANCOCK_GROUP.grade);
    page.getGradePanel(school, HANCOCK_GROUP.grade)
      .find('[data-cy="open-grade-workspace"]')
      .click();

    cy.url().should('include', `grade=${encodeURIComponent(HANCOCK_GROUP.grade)}`);
    cy.get('[data-cy="back-to-school-workspace"]').should('be.visible').click();
    cy.url().should('include', '/supplylist/workspace?');
    cy.url().should('not.include', 'grade=');
  });

  it('Should not invent a school-workspace back button for a directly opened grade workspace', () => {
    cy.visit(`/supplylist/workspace?school=${encodeURIComponent(HANCOCK_GROUP.school)}`
      + `&grade=${encodeURIComponent(HANCOCK_GROUP.grade)}&mode=edit&returnUrl=%2Fsupplylist`);

    cy.get('[data-cy="grade-bulk-entry"]').should('be.visible');
    cy.get('[data-cy="leave-workspace"]').should('be.visible');
    cy.get('[data-cy="back-to-school-workspace"]').should('not.exist');
  });

  it('Should bulk-add parsed lines through the API', () => {
    cy.intercept('POST', '/api/supplylist').as('bulkAdd');
    cy.visit(`/supplylist/workspace?school=${encodeURIComponent(HANCOCK_GROUP.school)}`
      + `&grade=${encodeURIComponent(HANCOCK_GROUP.grade)}&mode=edit&returnUrl=%2Fsupplylist`);

    cy.get('[data-cy="bulk-entry-text"]')
      .type('two glue sticks{enter}1 pack of 50 count construction paper');
    cy.get('[data-cy="preview-bulk-items"]').click();
    cy.get('[data-cy="bulk-preview-item"]').should('have.length', 2);
    cy.get('[data-cy="bulk-add-all"]').click();

    cy.wait(['@bulkAdd', '@bulkAdd']).then(interceptions => {
      const requests = interceptions.map(interception => interception.request.body);
      expect(requests).to.deep.include({
        school: HANCOCK_GROUP.school,
        grade: HANCOCK_GROUP.grade,
        item: ['Glue Stick'],
        brand: { exactly: '', anyOf: [] },
        color: { exactly: '', anyOf: [] },
        size: { exactly: '', anyOf: [] },
        type: { exactly: '', anyOf: [] },
        material: { exactly: '', anyOf: [] },
        packageSize: 1,
        quantity: 2,
        notes: ''
      });
      expect(requests.some(request => request.item?.[0] === 'Construction Paper'
        && request.quantity === 1 && request.packageSize === 50)).to.eq(true);
    });
  });

  it('Should replace an exact grade list through the API', () => {
    cy.visit(`/supplylist/workspace?school=${encodeURIComponent(HANCOCK_GROUP.school)}`
      + `&grade=${encodeURIComponent(HANCOCK_GROUP.grade)}&mode=edit&returnUrl=%2Fsupplylist`);

    cy.get('[data-cy="bulk-entry-text"]').type('two glue sticks');
    cy.get('[data-cy="preview-bulk-items"]').click();
    cy.get('[data-cy="bulk-replace-list"]').click();
    cy.contains('button', 'Replace List').click();
    cy.contains('Grade list replaced with 1 item(s)').should('be.visible');

    cy.request({
      url: '/api/supplylist',
      qs: { school: HANCOCK_GROUP.school, grade: HANCOCK_GROUP.grade }
    }).then(response => {
      const exactGrade = (response.body as Array<{ school: string; grade: string; item: string[]; quantity: number }>)
        .filter(item => item.school === HANCOCK_GROUP.school && item.grade === HANCOCK_GROUP.grade);
      expect(exactGrade).to.have.length(1);
      expect(exactGrade[0].item).to.deep.equal(['Glue Stick']);
      expect(exactGrade[0].quantity).to.equal(2);
    });
  });
});
