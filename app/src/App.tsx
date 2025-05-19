import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JournalEntryPage from './pages/JournalEntryPage';
import TemplateManagementPage from './pages/TemplateManagementPage';
import SettingsPage from './pages/SettingsPage';
import databaseService from './services/database';
import './App.css';
import { logger } from './utils/logger';

function App() {
  useEffect(() => {
    // Make database service globally available for cloud storage
    (window as any).databaseService = databaseService;

    // Initialize database service
    databaseService.initialize().catch(error => {
      logger.error('Failed to initialize database service:', error);
    });
  }, []);

  return (
    <BrowserRouter>
      <div className='min-h-screen bg-gray-50'>
        <Routes>
          <Route path='/' element={<JournalEntryPage />} />
          <Route path='/templates' element={<TemplateManagementPage />} />
          <Route path='/settings' element={<SettingsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
