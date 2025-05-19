# Journal App Integration Test

This directory contains integration tests for the Journal App frontend. These
tests run against a real running instance of the application.

## Setup

To set up for integration testing:

1. Install the required dependencies:

```bash
npm install --save-dev cypress @testing-library/cypress
```

## Running the Tests

### Prerequisites

1. Make sure your backend API is running
2. Make sure your frontend development server is running:

```bash
npm start
```

### Running the test

There are several ways to run the tests:

1. Run the test headlessly (without UI):

```bash
npm run test:e2e
```

2. Open Cypress UI to run and debug tests:

```bash
npm run cypress:open
```

## Test Description

The integration test (`journal.cy.js`) performs the following:

1. Visits the Journal App homepage
2. Verifies the page loaded correctly
3. Enters text in both the journal and gratitude sections
4. Saves the entry
5. Verifies the save was successful
6. Refreshes the page to verify persistence
7. Confirms that the entered text was saved correctly

This verifies the core functionality of the application while working with the
actual backend.
