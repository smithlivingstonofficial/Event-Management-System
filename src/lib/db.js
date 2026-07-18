import fs from 'fs';
import path from 'path';

import { EventEmitter } from 'events';
export const dbEmitter = new EventEmitter();
dbEmitter.setMaxListeners(100);

const DB_FILE = path.join(process.cwd(), 'db.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Helper to ensure database file exists
function ensureDbExists() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      categories: [],
      questions: [],
      events: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// Read database
export function getDb() {
  ensureDbExists();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return { categories: [], questions: [], events: [] };
  }
}

// Save database and trigger backup
export function saveDb(data) {
  try {
    // 1. Save main db
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    
    // 2. Perform automated backup
    triggerBackup(data);
    
    // 3. Emit change notification to active streams
    dbEmitter.emit('change', data);
    return true;
  } catch (error) {
    console.error('Error writing database file:', error);
    return false;
  }
}

// Backup logic (keeps last 10 backups)
function triggerBackup(data) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    // Generate timestamped backup name
    const timestamp = new Date().toISOString()
      .replace(/[^0-9]/g, '') // Keep only numbers
      .slice(0, 14); // YYYYMMDDHHMMSS
    const backupFile = path.join(BACKUP_DIR, `db_backup_${timestamp}.json`);
    
    // Save backup file
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
    
    // Maintain last 10 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Descending order (newest first)
      
    if (files.length > 10) {
      const filesToDelete = files.slice(10);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch (error) {
    console.error('Failed to create automated backup:', error);
  }
}

// Get list of local backups
export function getBackupList() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
      .sort()
      .reverse(); // Newest first
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

// Restore a backup from filename
export function restoreBackup(filename) {
  const targetPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(targetPath)) {
    return false;
  }
  try {
    const data = fs.readFileSync(targetPath, 'utf-8');
    // Validate JSON structure
    const parsed = JSON.parse(data);
    if (!parsed.categories || !parsed.questions || !parsed.events) {
      throw new Error('Invalid database backup structure');
    }
    // Write back to main DB
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to restore backup:', error);
    return false;
  }
}
