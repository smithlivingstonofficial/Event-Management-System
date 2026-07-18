import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'bca-quiz-data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Ensure data folder exists
function ensureDataDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Get the absolute path for a data file
export function getDataFilePath(fileName) {
  ensureDataDirExists();
  return path.join(DATA_DIR, fileName);
}

// Read database file
export function getBcaDb(fileName, defaultData = []) {
  const filePath = getDataFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading database file ${fileName}:`, error);
    return defaultData;
  }
}

// Save database file and trigger backup
export function saveBcaDb(fileName, data) {
  try {
    ensureDataDirExists();
    const filePath = path.join(DATA_DIR, fileName);
    
    // Save main db file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Perform automated backup
    triggerBackup(fileName, data);
    return true;
  } catch (error) {
    console.error(`Error writing database file ${fileName}:`, error);
    return false;
  }
}

// Backup logic (keeps last 10 backups per file type)
function triggerBackup(fileName, data) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const baseName = path.basename(fileName, '.json');
    
    // Generate timestamped backup name
    const timestamp = new Date().toISOString()
      .replace(/[^0-9]/g, '') // Keep only numbers
      .slice(0, 14); // YYYYMMDDHHMMSS
    const backupFile = path.join(BACKUP_DIR, `${baseName}_backup_${timestamp}.json`);
    
    // Save backup file
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
    
    // Maintain last 10 backups for this specific file type
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(`${baseName}_backup_`) && f.endsWith('.json'))
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
    console.error(`Failed to create automated backup for ${fileName}:`, error);
  }
}
