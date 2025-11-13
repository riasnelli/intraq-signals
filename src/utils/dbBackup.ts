// dbBackup.ts
// Export and import entire IndexedDB database to/from JSON

import { db } from '../db';

export interface DatabaseBackup {
  version: string;
  exportDate: string;
  signals: any[];
  backtests: any[];
}

// Export entire database to JSON
export async function exportDatabaseToJSON(): Promise<string> {
  console.log('📦 Exporting database to JSON...');
  
  const signals = await db.signals.toArray();
  const backtests = await db.backtests.toArray();
  
  const backup: DatabaseBackup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    signals,
    backtests,
  };
  
  console.log(`✅ Exported ${signals.length} signals and ${backtests.length} backtests`);
  
  return JSON.stringify(backup, null, 2);
}

// Import database from JSON (replaces existing data)
export async function importDatabaseFromJSON(jsonString: string): Promise<void> {
  console.log('📥 Importing database from JSON...');
  
  try {
    const backup: DatabaseBackup = JSON.parse(jsonString);
    
    // Validate backup structure
    if (!backup.signals || !Array.isArray(backup.signals)) {
      throw new Error('Invalid backup format: missing signals array');
    }
    
    console.log(`📊 Found ${backup.signals.length} signals and ${backup.backtests?.length || 0} backtests`);
    
    // Confirm before replacing data
    const currentSignals = await db.signals.count();
    if (currentSignals > 0) {
      const confirmReplace = confirm(
        `⚠️ Warning: Import will REPLACE existing data!\n\nCurrent database: ${currentSignals} signals\nImport file: ${backup.signals.length} signals\n\nContinue with import?`
      );
      if (!confirmReplace) {
        console.log('❌ Import cancelled by user');
        return;
      }
    }
    
    // Clear existing data
    await db.signals.clear();
    await db.backtests.clear();
    
    // Import new data
    if (backup.signals.length > 0) {
      await db.signals.bulkPut(backup.signals);
    }
    if (backup.backtests && backup.backtests.length > 0) {
      await db.backtests.bulkPut(backup.backtests);
    }
    
    console.log('✅ Import completed successfully');
    alert(`✅ Successfully imported!\n\n${backup.signals.length} signals restored\n${backup.backtests?.length || 0} backtest records restored\n\nExported on: ${new Date(backup.exportDate).toLocaleString()}`);
  } catch (err) {
    console.error('❌ Import failed:', err);
    throw new Error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// Download JSON backup file
export async function downloadBackup(): Promise<void> {
  const json = await exportDatabaseToJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intraq_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('✅ Backup file downloaded');
}

// Upload and import JSON backup file
export async function uploadBackup(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const jsonString = e.target?.result as string;
        await importDatabaseFromJSON(jsonString);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

