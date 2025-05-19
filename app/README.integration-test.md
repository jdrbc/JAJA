# Journal App Integration Testing

This documentation explains how to set up and run integration tests against a
locally running instance of the Journal App.

## Prerequisites

- Node.js installed
- Journal backend API running
- Journal frontend running

## Setup

1. Install the required dependencies:

```bash
cd frontend
npm install --save-dev cypress @testing-library/cypress
```

2. Ensure your application is running:
   - Backend API service should be running
   - Frontend development server should be running (`npm start`)

## Running the Integration Test

There are two ways to run the integration test:

### 1. Headless Mode (Command Line)

Run the test in headless mode (without opening a browser UI):

```bash
cd frontend
npm run test:e2e
```

This will run the journal entry test and output results to the logger.

### 2. Interactive Mode

Open the Cypress Test Runner UI to run and debug tests:

```bash
cd frontend
npm run cypress:open
```

Then click on the "E2E Testing" option, choose a browser, and select the
`journal.cy.js` test to run.

## What the Test Covers

The integration test verifies the core functionality of the Journal App:

1. Creating journal entries
2. Creating gratitude entries
3. Saving entries to the backend
4. Verifying data persistence after page refresh

## Troubleshooting

- If tests fail with API errors, ensure your backend API is running
- If element selectors fail, check that the data-testid attributes match between
  tests and components
- For timeouts, you may need to adjust the timeout values in the test

## Extending the Tests

To add more tests:

1. Create new test files in the `cypress/e2e` directory
2. Add new test cases to the existing test file
