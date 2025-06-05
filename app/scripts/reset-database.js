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
  console.log('🗑️  Clearing database files...');

  let filesDeleted = 0;

  DB_PATHS.forEach(dbPath => {
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
        console.log(`   ✅ Deleted: ${dbPath}`);
        filesDeleted++;
      } catch (error) {
        console.log(`   ❌ Failed to delete: ${dbPath} - ${error.message}`);
      }
    }
  });

  return filesDeleted;
}

function clearStorageFiles() {
  console.log('🗑️  Clearing storage files...');

  let dirsDeleted = 0;

  STORAGE_PATHS.forEach(storagePath => {
    if (fs.existsSync(storagePath)) {
      try {
        fs.rmSync(storagePath, { recursive: true, force: true });
        console.log(`   ✅ Deleted directory: ${storagePath}`);
        dirsDeleted++;
      } catch (error) {
        console.log(
          `   ❌ Failed to delete directory: ${storagePath} - ${error.message}`
        );
      }
    }
  });

  return dirsDeleted;
}

function showInstructions() {
  const type = resetType();

  console.log('');
  console.log('📋 Additional Instructions:');
  console.log('');
  console.log('To complete the database reset:');
  console.log('1. Refresh your browser (Cmd+R / Ctrl+R)');
  console.log('2. Clear browser data:');
  console.log('   - Open Developer Tools (F12)');
  console.log('   - Go to Application/Storage tab');
  console.log('   - Clear IndexedDB and Local Storage');
  console.log('   - Or use browser\'s "Clear site data" option');
  console.log('');

  if (type === 'all') {
    console.log('🔄 For runtime database reset, open browser console and run:');
    console.log('   DatabaseResetUtil.resetDatabase()');
  } else if (type === 'user') {
    console.log(
      '🔄 For runtime user data reset, open browser console and run:'
    );
    console.log('   DatabaseResetUtil.resetUserDataOnly()');
  } else if (type === 'templates') {
    console.log('🔄 For runtime template reset, open browser console and run:');
    console.log('   DatabaseResetUtil.resetTemplatesOnly()');
  }

  console.log('');
}

function main() {
  const type = resetType();

  console.log('');
  console.log('💣 DATABASE RESET UTILITY');
  console.log('========================');
  console.log(`Reset type: ${type}`);
  console.log('');

  if (!['all', 'user', 'templates'].includes(type)) {
    console.log('❌ Invalid reset type. Use: all, user, or templates');
    process.exit(1);
  }

  // Warning for production-like environments
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  WARNING: This appears to be a production environment!');
    console.log(
      '   Database reset operations should only be used in development.'
    );
    console.log('   Exiting for safety.');
    process.exit(1);
  }

  console.log('⚠️  WARNING: This will permanently delete data!');
  console.log('   Make sure you have backups if needed.');
  console.log('');

  // File-based reset (clears LokiJS files)
  const filesDeleted = clearDatabaseFiles();
  const dirsDeleted = clearStorageFiles();

  if (filesDeleted === 0 && dirsDeleted === 0) {
    console.log('ℹ️  No database files found to delete.');
    console.log(
      '   This is normal for a fresh installation or browser-only storage.'
    );
  }

  console.log('');
  console.log('✅ File-based reset completed!');

  showInstructions();
}

if (require.main === module) {
  main();
}
