import { ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import {
    getSettings,
    getSetting,
    setSetting,
    getMySQLConfig,
    getDatabaseDirectory,
    setDatabaseDirectory,
    isFirstRun,
    setFirstRunComplete
} from './settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database directory from settings (no longer hardcoded)
function getDB_PROJECT_ROOT() {
    return getDatabaseDirectory();
}

// Import shared library modules from the CLI project
import {
    setMySQLConfig,
    testConnection,
    getDatabases,
    getDatabaseInfo,
    createDatabase,
    dropDatabase,
    databaseExists,
    importSql,
    exportSql,
    exportSlimSql
} from '../lib/mysql.js';

import {
    discoverSqlFiles,
    getFileInfo,
    loadExcludeTables,
    getDatabaseNameFromFile,
    ensureDirectory
} from '../lib/files.js';

/**
 * Ensure MySQL is configured with current electron-store settings
 * Call this before any MySQL operation
 */
function ensureMySQLConfig() {
    const config = getMySQLConfig();
    setMySQLConfig(config);
}

// MySQL operations
ipcMain.handle('mysql:testConnection', async () => {
    try {
        ensureMySQLConfig();
        const result = await testConnection();
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mysql:getDatabases', async () => {
    try {
        ensureMySQLConfig();
        const databases = await getDatabases();
        return databases;
    } catch (error) {
        throw new Error(`Failed to get databases: ${error.message}`);
    }
});

ipcMain.handle('mysql:getDatabaseInfo', async (event, dbName) => {
    try {
        ensureMySQLConfig();
        const info = await getDatabaseInfo(dbName);
        return info;
    } catch (error) {
        throw new Error(`Failed to get database info: ${error.message}`);
    }
});

// File operations
ipcMain.handle('files:discover', async (event, directory) => {
    try {
        // Convert relative directory to absolute path in the DB project
        const DB_ROOT = getDB_PROJECT_ROOT();
        const absolutePath = path.join(DB_ROOT, directory);
        console.log('📂 Discovering files in:', absolutePath);
        console.log('📂 DB_PROJECT_ROOT:', DB_ROOT);
        console.log('📂 directory:', directory);

        const files = await discoverSqlFiles(absolutePath);
        console.log('📂 Found files:', files.length);
        return files;
    } catch (error) {
        console.error('❌ Error discovering files:', error);
        throw new Error(`Failed to discover files: ${error.message}`);
    }
});

ipcMain.handle('files:getInfo', async (event, filePath) => {
    try {
        const info = await getFileInfo(filePath);
        return info;
    } catch (error) {
        throw new Error(`Failed to get file info: ${error.message}`);
    }
});

// Restore operation
ipcMain.handle('restore:start', async (event, { dbName, sqlFile, progressChannel }) => {
    try {
        ensureMySQLConfig();
        const senderWindow = event.sender;

        // Progress callback
        const onProgress = (bytesProcessed) => {
            if (!senderWindow.isDestroyed()) {
                senderWindow.send(progressChannel, { bytesProcessed });
            }
        };

        // Check if database exists, if so drop it first
        const exists = await databaseExists(dbName);
        if (exists) {
            await dropDatabase(dbName);
        }

        // Create new database
        await createDatabase(dbName);

        // Import SQL file
        await importSql(dbName, sqlFile, onProgress);

        // Get final database info
        const info = await getDatabaseInfo(dbName);

        return {
            success: true,
            message: 'Restore completed',
            tableCount: info.tableCount,
            sizeMB: info.sizeMB
        };
    } catch (error) {
        throw new Error(`Restore failed: ${error.message}`);
    }
});

// Slim operation
ipcMain.handle('slim:start', async (event, { files, progressChannel, restoreConfig }) => {
    try {
        ensureMySQLConfig();
        const senderWindow = event.sender;
        const results = [];
        const DB_ROOT = getDB_PROJECT_ROOT();

        // Load excluded tables
        const configPath = path.join(DB_ROOT, 'config/exclude-tables.txt');
        const excludeTables = await loadExcludeTables(configPath);

        // Ensure slim directory exists
        const slimDir = path.join(DB_ROOT, 'slim');
        await ensureDirectory(slimDir);

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const fullSqlPath = files[i];
            const baseName = path.basename(fullSqlPath, '.sql');
            const tempDbName = `${baseName}_temp`;
            const slimPath = path.join(slimDir, `${baseName}_slim.sql`);

            try {
                // Send progress update
                senderWindow.send(progressChannel, {
                    current: i,
                    total: files.length,
                    currentFile: baseName,
                    step: 'Creating temp database...',
                    stepProgress: 0
                });

                // Create temp database
                if (await databaseExists(tempDbName)) {
                    await dropDatabase(tempDbName);
                }
                await createDatabase(tempDbName);

                // Update progress after DB created
                senderWindow.send(progressChannel, {
                    current: i,
                    total: files.length,
                    currentFile: baseName,
                    step: 'Creating temp database...',
                    stepProgress: 100
                });

                // Get file size for progress calculation
                const fileStats = await fs.stat(fullSqlPath);
                const fileSize = fileStats.size;

                // Import full dump with progress
                senderWindow.send(progressChannel, {
                    current: i,
                    total: files.length,
                    currentFile: baseName,
                    step: 'Importing full dump...',
                    stepProgress: 0
                });

                let lastProgressUpdate = 0;
                let lastPercentage = 0;

                await importSql(tempDbName, fullSqlPath, (bytesProcessed) => {
                    const percentage = fileSize > 0 ? Math.round((bytesProcessed / fileSize) * 100) : 0;
                    const now = Date.now();

                    // Only send update if percentage changed by 1% or 200ms elapsed
                    if (percentage !== lastPercentage && (percentage - lastPercentage >= 1 || now - lastProgressUpdate > 200)) {
                        lastPercentage = percentage;
                        lastProgressUpdate = now;
                        senderWindow.send(progressChannel, {
                            current: i,
                            total: files.length,
                            currentFile: baseName,
                            step: 'Importing full dump...',
                            stepProgress: percentage
                        });
                    }
                });

                // Export slim dump with progress
                senderWindow.send(progressChannel, {
                    current: i,
                    total: files.length,
                    currentFile: baseName,
                    step: 'Exporting slim dump...',
                    stepProgress: 0
                });

                let lastExportUpdate = 0;
                let lastExportPercentage = 0;

                await exportSlimSql(tempDbName, slimPath, excludeTables, (bytesProcessed) => {
                    // For export, we don't know the final size upfront, so just show activity
                    const percentage = Math.min(95, Math.floor(bytesProcessed / (1024 * 1024))); // 1% per MB, cap at 95%
                    const now = Date.now();

                    // Only send update if percentage changed or 200ms elapsed
                    if (percentage !== lastExportPercentage || now - lastExportUpdate > 200) {
                        lastExportPercentage = percentage;
                        lastExportUpdate = now;
                        senderWindow.send(progressChannel, {
                            current: i,
                            total: files.length,
                            currentFile: baseName,
                            step: 'Exporting slim dump...',
                            stepProgress: percentage
                        });
                    }
                });

                // Cleanup
                senderWindow.send(progressChannel, {
                    current: i,
                    total: files.length,
                    currentFile: baseName,
                    step: 'Cleaning up...',
                    stepProgress: 0
                });

                await dropDatabase(tempDbName);

                // Update progress after cleanup
                senderWindow.send(progressChannel, {
                    current: i,
                    total: files.length,
                    currentFile: baseName,
                    step: 'Cleaning up...',
                    stepProgress: 100
                });

                // Restore slim dump if requested
                let restoreInfo = null;
                if (restoreConfig && restoreConfig.enabled) {
                    const targetDbName = restoreConfig.databaseNames[fullSqlPath];

                    if (targetDbName) {
                        // Drop existing database if it exists
                        senderWindow.send(progressChannel, {
                            current: i,
                            total: files.length,
                            currentFile: baseName,
                            step: `Restoring to ${targetDbName}...`,
                            stepProgress: 0
                        });

                        if (await databaseExists(targetDbName)) {
                            await dropDatabase(targetDbName);
                        }
                        await createDatabase(targetDbName);

                        // Import slim dump
                        const slimFileStats = await fs.stat(slimPath);
                        const slimFileSize = slimFileStats.size;
                        let lastRestoreUpdate = 0;
                        let lastRestorePercentage = 0;

                        await importSql(targetDbName, slimPath, (bytesProcessed) => {
                            const percentage = slimFileSize > 0 ? Math.round((bytesProcessed / slimFileSize) * 100) : 0;
                            const now = Date.now();

                            if (percentage !== lastRestorePercentage && (percentage - lastRestorePercentage >= 1 || now - lastRestoreUpdate > 200)) {
                                lastRestorePercentage = percentage;
                                lastRestoreUpdate = now;
                                senderWindow.send(progressChannel, {
                                    current: i,
                                    total: files.length,
                                    currentFile: baseName,
                                    step: `Restoring to ${targetDbName}...`,
                                    stepProgress: percentage
                                });
                            }
                        });

                        // Get database info after restore
                        const dbInfo = await getDatabaseInfo(targetDbName);
                        restoreInfo = {
                            databaseName: targetDbName,
                            tableCount: dbInfo.tableCount,
                            size: dbInfo.sizeMB
                        };
                    }
                }

                // Calculate results
                const fullStats = await fs.stat(fullSqlPath);
                const slimStats = await fs.stat(slimPath);
                const { formatFileSize } = await import('../lib/utils.js');
                const fullSize = await formatFileSize(fullStats.size);
                const slimSize = await formatFileSize(slimStats.size);
                const savings = Math.round((1 - slimStats.size / fullStats.size) * 100);

                results.push({
                    success: true,
                    fileName: baseName,
                    fullSize,
                    slimSize,
                    savings,
                    slimPath,
                    restored: restoreInfo
                });

            } catch (error) {
                // Cleanup on error
                try {
                    if (await databaseExists(tempDbName)) {
                        await dropDatabase(tempDbName);
                    }
                } catch {}

                results.push({
                    success: false,
                    fileName: baseName,
                    error: error.message
                });
            }
        }

        // Send final progress
        senderWindow.send(progressChannel, {
            current: files.length,
            total: files.length,
            currentFile: null,
            step: 'Complete'
        });

        return { success: true, results };
    } catch (error) {
        throw new Error(`Slim dump failed: ${error.message}`);
    }
});

// Snapshot operation
ipcMain.handle('snapshot:start', async (event, { dbName, description, type, progressChannel }) => {
    try {
        ensureMySQLConfig();
        const senderWindow = event.sender;
        const DB_ROOT = getDB_PROJECT_ROOT();

        // Import utility functions
        const { sanitizeFilename, getTimestamp, formatFileSize } = await import('../lib/utils.js');

        // Generate filename
        const timestamp = getTimestamp();
        const sanitized = sanitizeFilename(description);
        const filename = `${dbName}_snapshot_${sanitized}_${timestamp}.sql`;

        // Ensure snapshots directory exists
        const snapshotsDir = path.join(DB_ROOT, 'snapshots');
        await ensureDirectory(snapshotsDir);

        const filepath = path.join(snapshotsDir, filename);

        // Send initial progress
        senderWindow.send(progressChannel, {
            step: 'Exporting database...',
            stepProgress: 0
        });

        // Load exclude tables if slim
        const configPath = path.join(DB_ROOT, 'config/exclude-tables.txt');
        const excludeTables = type === 'slim'
            ? await loadExcludeTables(configPath)
            : [];

        // Export database with progress
        let lastProgressUpdate = 0;
        let lastPercentage = 0;

        // Use exportSlimSql if this is a slim snapshot with excluded tables
        const exportFunction = (type === 'slim' && excludeTables.length > 0) ? exportSlimSql : exportSql;

        await exportFunction(dbName, filepath, excludeTables, (bytesProcessed) => {
            const percentage = Math.min(95, Math.floor(bytesProcessed / (1024 * 1024))); // 1% per MB, cap at 95%
            const now = Date.now();

            if (percentage !== lastPercentage || now - lastProgressUpdate > 200) {
                lastPercentage = percentage;
                lastProgressUpdate = now;
                senderWindow.send(progressChannel, {
                    step: 'Exporting database...',
                    stepProgress: percentage
                });
            }
        });

        // Final progress
        senderWindow.send(progressChannel, {
            step: 'Complete',
            stepProgress: 100
        });

        // Get snapshot info
        const stats = await fs.stat(filepath);
        const size = await formatFileSize(stats.size);
        const info = await getDatabaseInfo(dbName);

        return {
            success: true,
            filename,
            filepath,
            size,
            tableCount: info.tableCount,
            type: type === 'slim' && excludeTables.length > 0 ? 'Slim' : 'Full'
        };
    } catch (error) {
        throw new Error(`Snapshot failed: ${error.message}`);
    }
});

// File management operations
ipcMain.handle('file:rename', async (event, { oldPath, newName }) => {
    try {
        const directory = path.dirname(oldPath);
        const newPath = path.join(directory, `${newName}.sql`);
        await fs.rename(oldPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        throw new Error(`Rename failed: ${error.message}`);
    }
});

ipcMain.handle('file:replace', async (event, { sourcePath, targetPath }) => {
    try {
        await fs.copyFile(sourcePath, targetPath);
        return { success: true };
    } catch (error) {
        throw new Error(`Replace failed: ${error.message}`);
    }
});

ipcMain.handle('file:delete', async (event, { filePaths }) => {
    try {
        for (const filePath of filePaths) {
            await fs.unlink(filePath);
        }
        return { success: true, count: filePaths.length };
    } catch (error) {
        throw new Error(`Delete failed: ${error.message}`);
    }
});

// File dialog
ipcMain.handle('dialog:openFile', async (event, options) => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            title: options?.title || 'Select file',
            filters: options?.filters || [],
        });

        if (result.canceled) {
            return null;
        }

        return result.filePaths[0];
    } catch (error) {
        throw new Error(`File selection failed: ${error.message}`);
    }
});

// Directory dialog
ipcMain.handle('dialog:selectDirectory', async () => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select Database Directory'
        });

        if (result.canceled) {
            return null;
        }

        return result.filePaths[0];
    } catch (error) {
        throw new Error(`Directory selection failed: ${error.message}`);
    }
});

// Bulk database deletion
ipcMain.handle('database:bulkDelete', async (event, { dbNames, progressChannel }) => {
    try {
        ensureMySQLConfig();
        const senderWindow = event.sender;
        const deleted = [];
        const errors = [];

        for (let i = 0; i < dbNames.length; i++) {
            const dbName = dbNames[i];

            try {
                // Send progress update
                senderWindow.send(progressChannel, {
                    current: i + 1,
                    total: dbNames.length,
                    currentDb: dbName
                });

                // Delete the database
                await dropDatabase(dbName);
                deleted.push(dbName);
            } catch (error) {
                errors.push({
                    database: dbName,
                    error: error.message
                });
            }
        }

        // Send final progress
        senderWindow.send(progressChannel, {
            current: dbNames.length,
            total: dbNames.length,
            currentDb: null
        });

        return {
            success: true,
            deleted,
            errors
        };
    } catch (error) {
        throw new Error(`Bulk delete failed: ${error.message}`);
    }
});

// Settings handlers
ipcMain.handle('settings:getAll', async () => {
    return getSettings();
});

ipcMain.handle('settings:get', async (event, key) => {
    return getSetting(key);
});

ipcMain.handle('settings:save', async (event, settings) => {
    Object.keys(settings).forEach(key => {
        setSetting(key, settings[key]);
    });
    return { success: true };
});

ipcMain.handle('settings:getMySQLConfig', async () => {
    return getMySQLConfig();
});

ipcMain.handle('settings:saveMySQLConfig', async (event, config) => {
    setMySQLConfig(config);
    return { success: true };
});

ipcMain.handle('settings:getDatabaseDirectory', async () => {
    return getDatabaseDirectory();
});

ipcMain.handle('settings:saveDatabaseDirectory', async (event, dir) => {
    setDatabaseDirectory(dir);
    return { success: true };
});

ipcMain.handle('settings:isFirstRun', async () => {
    return isFirstRun();
});

ipcMain.handle('settings:setFirstRunComplete', async () => {
    setFirstRunComplete();
    return { success: true };
});

// Log helper
export function sendLog(window, message) {
    if (window && !window.isDestroyed()) {
        window.webContents.send('log', message);
    }
}
