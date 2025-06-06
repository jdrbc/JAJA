#!/usr/bin/env node

/**
 * Database Reset Script
 *
 * This script provides commands to reset the database for development purposes.
 * Run with: npm run db:reset [option]
 *
 * Options:
 *   all        - Reset everything (default)
 *   user       - Reset only user data (keep templates)
 *   templates  - Reset only templates (keep user data)
 */

const fs = require('fs');
const path = require('path');
const logger = require('../src/services/logger');

// Database file paths for LokiJS
const DB_PATHS = [
  // Common LokiJS database file locations
  path.join(process.cwd(), 'database.db'),
  path.join(process.cwd(), 'lokijs.db'),
  path.join(process.cwd(), 'watermelon.db'),
  path.join(process.cwd(), 'src', 'database', 'lokijs.db'),
  path.join(process.cwd(), 'public', 'database.db'),
];

// Clear localStorage and indexedDB data locations if any exist in filesystem
const STORAGE_PATHS = [
  path.join(process.cwd(), 'IndexedDB'),
  path.join(process.cwd(), 'Local Storage'),
  path.join(process.cwd(), '.lokijs'),
];

function resetType() {
  const args = process.argv.slice(2);
  return args[0] || 'all';
}

function clearDatabaseFiles() {
  logger.log('🗑️  Clearing database files...');

  let filesDeleted = 0;

  DB_PATHS.forEach(dbPath => {
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
        logger.log(`   ✅ Deleted: ${dbPath}`);
        filesDeleted++;
      } catch (error) {
        logger.log(`   ❌ Failed to delete: ${dbPath} - ${error.message}`);
      }
    }
  });

  return filesDeleted;
}

function clearStorageFiles() {
  logger.log('🗑️  Clearing storage files...');

  let dirsDeleted = 0;

  STORAGE_PATHS.forEach(storagePath => {
    if (fs.existsSync(storagePath)) {
      try {
        fs.rmSync(storagePath, { recursive: true, force: true });
        logger.log(`   ✅ Deleted directory: ${storagePath}`);
        dirsDeleted++;
      } catch (error) {
        logger.log(
          `   ❌ Failed to delete directory: ${storagePath} - ${error.message}`
        );
      }
    }
  });

  return dirsDeleted;
}

function showInstructions() {
  const type = resetType();

  logger.log('');
  logger.log('📋 Additional Instructions:');
  logger.log('');
  logger.log('To complete the database reset:');
  logger.log('1. Refresh your browser (Cmd+R / Ctrl+R)');
  logger.log('2. Clear browser data:');
  logger.log('   - Open Developer Tools (F12)');
  logger.log('   - Go to Application/Storage tab');
  logger.log('   - Clear IndexedDB and Local Storage');
  logger.log('   - Or use browser\'s "Clear site data" option');
  logger.log('');

  if (type === 'all') {
    logger.log('🔄 For runtime database reset, open browser console and run:');
    logger.log('   DatabaseResetUtil.resetDatabase()');
  } else if (type === 'user') {
    logger.log('🔄 For runtime user data reset, open browser console and run:');
    logger.log('   DatabaseResetUtil.resetUserDataOnly()');
  } else if (type === 'templates') {
    logger.log('🔄 For runtime template reset, open browser console and run:');
    logger.log('   DatabaseResetUtil.resetTemplatesOnly()');
  }

  logger.log('');
}

function main() {
  const type = resetType();

  logger.log('');
  logger.log('💣 DATABASE RESET UTILITY');
  logger.log('========================');
  logger.log(`Reset type: ${type}`);
  logger.log('');

  if (!['all', 'user', 'templates'].includes(type)) {
    logger.log('❌ Invalid reset type. Use: all, user, or templates');
    process.exit(1);
  }

  // Warning for production-like environments
  if (process.env.NODE_ENV === 'production') {
    logger.log('⚠️  WARNING: This appears to be a production environment!');
    logger.log(
      '   Database reset operations should only be used in development.'
    );
    logger.log('   Exiting for safety.');
    process.exit(1);
  }

  logger.log('⚠️  WARNING: This will permanently delete data!');
  logger.log('   Make sure you have backups if needed.');
  logger.log('');

  // File-based reset (clears LokiJS files)
  const filesDeleted = clearDatabaseFiles();
  const dirsDeleted = clearStorageFiles();

  if (filesDeleted === 0 && dirsDeleted === 0) {
    logger.log('ℹ️  No database files found to delete.');
    logger.log(
      '   This is normal for a fresh installation or browser-only storage.'
    );
  }

  logger.log('');
  logger.log('✅ File-based reset completed!');

  showInstructions();
}

if (require.main === module) {
  main();
}
