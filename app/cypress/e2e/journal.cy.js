/* eslint-env cypress/globals */
describe('Journal App Integration Test', () => {
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

  // The following are the section IDs from the template
  const JOURNAL_ENTRY_ID = 'journal_entry';
  const GRATITUDE_ID = 'gratitude';
  const MONTHLY_THEME_ID = 'monthly_theme';

  // Helper function to interact with monthly theme header
  const setMonthlyTheme = text => {
    // First, get the display element and double-click it to make it editable
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`)
      .should('be.visible')
      .dblclick();

    // Then interact with the editor once it appears
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-editor"]`)
      .should('be.visible')
      .clear()
      .type(text);
  };

  // Helper function to get monthly theme value
  const getMonthlyTheme = () => {
    // If editor is visible, get its value
    cy.get('body').then($body => {
      if ($body.find(`[data-testid="${MONTHLY_THEME_ID}-editor"]`).length > 0) {
        return cy.get(`[data-testid="${MONTHLY_THEME_ID}-editor"]`);
      } else {
        // Otherwise, get the display text
        return cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`);
      }
    });
  };

  beforeEach(() => {
    // Delete test entries before each test
    cy.request({
      method: 'DELETE',
      url: '/api/entries/2001-01-01',
      failOnStatusCode: false, // Don't fail if entries don't exist
    });
    cy.request({
      method: 'DELETE',
      url: '/api/entries/2000-01-01',
      failOnStatusCode: false, // Don't fail if entries don't exist
    });
    cy.request({
      method: 'DELETE',
      url: '/api/entries/2000-01-02',
      failOnStatusCode: false,
    });
    cy.log('Cleaned up test entries for Jan 1 and Jan 2, 2000');
  });

  it('allows a user to create and save a journal entry with auto-save', () => {
    cy.visit('/?date=2001-01-01', { timeout: 500 });
    // Enhanced debug logs
    cy.log('Starting test - checking for editors');

    // Debug the DOM structure
    cy.document().then(doc => {
      cy.log(`Document ready state: ${doc.readyState}`);
      cy.log(`Document title: ${doc.title}`);
    });

    // Wait for editors to be available with a longer timeout
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`, { timeout: 500 })
      .should('exist')
      .then($el => {
        cy.log(`Found journal-editor element: ${$el.length > 0}`);
      });

    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`, { timeout: 500 })
      .should('exist')
      .then($el => {
        cy.log(`Found gratitude-editor element: ${$el.length > 0}`);
      });

    // For monthly theme, we now need to look for the display element first
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`, { timeout: 500 })
      .should('exist')
      .then($el => {
        cy.log(`Found monthly-theme-display element: ${$el.length > 0}`);
      });

    // Test journal entry content
    const journalText = `Test journal entry created on ${today}`;
    const gratitudeText = `I am grateful for automated tests on ${today}`;
    const monthlyThemeText = `Theme for the month: Testing ${today}`;

    // Enter monthly theme text (now requires double-click to edit)
    setMonthlyTheme(monthlyThemeText);

    // Enter journal text
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`)
      .should('be.visible')
      .clear()
      .type(journalText)
      .then($el => {
        cy.log(`Journal text entered: ${$el.val() === journalText}`);
      });

    // Enter gratitude text
    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`)
      .should('be.visible')
      .clear()
      .type(gratitudeText)
      .then($el => {
        cy.log(`Gratitude text entered: ${$el.val() === gratitudeText}`);
      });

    // Wait for auto-save to complete (instead of clicking save button)
    // Look for the "All changes saved" indicator
    cy.contains('All changes saved', { timeout: 1000 })
      .should('be.visible')
      .then($el => {
        cy.log(`Auto-save indicator found: ${$el.length > 0}`);
      });

    // Reload page to verify persistence
    cy.reload();

    // Wait for data to load after page refresh
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`, {
      timeout: 1500,
    }).should('exist');

    // Verify our content was saved - monthly theme now displays as text
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`)
      .should('contain.text', monthlyThemeText)
      .then($el => {
        cy.log(
          `Monthly theme persisted: ${$el.text().includes(monthlyThemeText)}`
        );
      });

    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`)
      .should('have.value', journalText)
      .then($el => {
        cy.log(`Journal text persisted: ${$el.val() === journalText}`);
      });

    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`)
      .should('have.value', gratitudeText)
      .then($el => {
        cy.log(`Gratitude text persisted: ${$el.val() === gratitudeText}`);
      });
  });

  it('allows navigating between days with persistent data', () => {
    // Set up test to use January 1, 2000 as start date
    cy.visit('/?date=2000-01-01');
    cy.log('Starting day navigation test');

    // Wait for page to load
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`, {
      timeout: 1000,
    }).should('exist');
    cy.log('Journal editor loaded for Jan 1');

    // Add content for Jan 1
    const jan1JournalText = 'Jan 1 journal content';
    const jan1GratitudeText = 'Jan 1 gratitude';
    const monthlyThemeText = 'January 2000 theme';

    // Set monthly theme - now requires double-click
    setMonthlyTheme(monthlyThemeText);

    // Set journal entry
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`)
      .clear()
      .type(jan1JournalText);

    // Set gratitude
    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`)
      .clear()
      .type(jan1GratitudeText);

    // Wait for auto-save
    cy.contains('All changes saved', { timeout: 10000 }).should('be.visible');
    cy.log('Jan 1 entries saved');

    // Force a reload to ensure everything is saved properly
    cy.reload();

    // Wait for page to reload and verify our content was saved
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`, { timeout: 1000 })
      .should('contain.text', monthlyThemeText)
      .then($el => {
        cy.log(`After reload, monthly theme is: "${$el.text()}"`);
      });

    // Navigate to Jan 2
    cy.get('[aria-label="Next day"]').click();
    cy.log('Clicked next day button to Jan 2');

    // Verify URL was updated to Jan 2
    cy.url().should('include', '?date=2000-01-02');

    // Wait for page to load with new date
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`, {
      timeout: 1000,
    }).should('exist');
    cy.log('Journal editor loaded for Jan 2');

    // Verify date shows Jan 2
    cy.contains('Sunday, January 2, 2000').should('be.visible');

    // Debug what we're seeing for the monthly theme
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`).then($el => {
      cy.log(`Monthly theme on Jan 2 is: "${$el.text()}"`);
      // Take a screenshot to help with debugging
      cy.screenshot('jan2-monthly-theme');
    });

    // Verify Jan 2 has empty daily entries
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`).should(
      'have.value',
      ''
    );
    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`).should('have.value', '');

    // Verify the monthly theme persisted - check the display text
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`, {
      timeout: 1000,
    }).should('contain.text', monthlyThemeText);

    // Add content to Jan 2
    const jan2JournalText = 'Jan 2 journal content';
    const jan2GratitudeText = 'Jan 2 gratitude';

    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`).type(jan2JournalText);

    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`).type(jan2GratitudeText);

    // Wait for auto-save
    cy.contains('All changes saved', { timeout: 1000 }).should('be.visible');
    cy.log('Jan 2 entries saved');

    // Navigate back to Jan 1
    cy.get('[aria-label="Previous day"]').click();
    cy.log('Clicked previous day button to Jan 1');

    // Verify URL was updated to Jan 1
    cy.url().should('include', '?date=2000-01-01');

    // Wait for page to load with new date
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`, {
      timeout: 1000,
    }).should('exist');
    cy.log('Journal editor loaded for Jan 1 (again)');

    // Verify date shows Jan 1
    cy.contains('Saturday, January 1, 2000').should('be.visible');

    // Debug the values we're getting on return to Jan 1
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`).then($el => {
      cy.log(`Journal content on return to Jan 1: "${$el.val()}"`);
    });

    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`).then($el => {
      cy.log(`Gratitude content on return to Jan 1: "${$el.val()}"`);
    });

    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`).then($el => {
      cy.log(`Monthly theme on return to Jan 1: "${$el.text()}"`);
    });

    // Verify Jan 1 content is still there
    cy.get(`[data-testid="${JOURNAL_ENTRY_ID}-editor"]`, {
      timeout: 1000,
    }).should('have.value', jan1JournalText);
    cy.get(`[data-testid="${GRATITUDE_ID}-editor"]`, { timeout: 1000 }).should(
      'have.value',
      jan1GratitudeText
    );
    cy.get(`[data-testid="${MONTHLY_THEME_ID}-display"]`, {
      timeout: 1000,
    }).should('contain.text', monthlyThemeText);

    cy.log('Day navigation test completed successfully');
  });
});
