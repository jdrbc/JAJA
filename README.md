# JAJA - Just Another Journal App

A modern, privacy-focused personal journaling application that runs entirely in your browser.

## Features

### 📝 **Rich Journaling Experience**
- Daily journal entries with customizable templates
- Multi-column layout for organized content
- Auto-save functionality (saves every 2 seconds after changes)
- Date-based navigation with URL support
- Drag-and-drop section reordering

### 🎨 **Customizable Templates**
- Create and manage section templates
- Pre-built templates for structured journaling
- Flexible section types and layouts

### ☁️ **Privacy-First Cloud Sync** 
- Google Drive integration using AppData scope (your data stays private)
- Automatic backup and sync across devices
- Optional cloud storage - works completely offline too

### 🛠️ **Modern Architecture**
- Built with React 18 and TypeScript
- Tailwind CSS for modern, responsive design
- SQLite WASM running directly in the browser
- IndexedDB for local persistence
- No backend required - pure frontend application

## Architecture

- **Database**: SQLite WASM (@sqlite.org/sqlite-wasm) running in the browser
- **Storage**: IndexedDB for local persistence
- **Cloud Sync**: Google Drive AppData integration (optional)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Testing**: Cypress for integration tests

## Getting Started

1. Navigate to the app directory:
   ```bash
   cd app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Testing

Run integration tests with Cypress:
```bash
npm run cypress:open
```

## TODO

- Long term goals: https://docs.google.com/document/d/1wAp0DcylMbzHzXFrdqEAC_S-Nf93OmCjlKkRVTzqHnw/edit?tab=t.0
- Week planner: https://docs.google.com/document/d/174Z-Yvlg8_8mnzsKVTmuaEHVv8tErmacv5jR4Z5S4I8/edit?tab=t.0
- Month planner: https://docs.google.com/document/d/1naMYLwju94JqvDOr_l-ApbYZCQoL1WRYXgBybxPkVKU/edit?tab=t.0
- Hosting deployment
- AI-powered features
- Review/grading system with feedback mechanisms
  - Reference: https://mtlynch.io/retrospectives/2025/05/

## Privacy & Data

JAJA prioritizes your privacy:
- All data is stored locally in your browser by default
- Cloud sync is optional and uses Google Drive's AppData scope
- Your journal data is never accessible to the app developers
- No analytics or tracking

