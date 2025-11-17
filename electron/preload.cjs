const { contextBridge, ipcRenderer } = require('electron');

console.log('🔧 Preload script is loading...');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('dbManager', {
    // MySQL operations
    testConnection: () => ipcRenderer.invoke('mysql:testConnection'),
    getDatabases: () => ipcRenderer.invoke('mysql:getDatabases'),
    getDatabaseInfo: (dbName) => ipcRenderer.invoke('mysql:getDatabaseInfo', dbName),

    // File operations
    discoverSqlFiles: (directory) => ipcRenderer.invoke('files:discover', directory),
    getFileInfo: (filePath) => ipcRenderer.invoke('files:getInfo', filePath),

    // Restore operation
    restoreDatabase: (dbName, sqlFile, onProgress) => {
        const channel = `restore:progress:${Date.now()}`;

        // Listen for progress updates
        if (onProgress) {
            ipcRenderer.on(channel, (event, progress) => {
                onProgress(progress);
            });
        }

        // Start the restore operation
        return ipcRenderer.invoke('restore:start', { dbName, sqlFile, progressChannel: channel });
    },

    // Slim operation
    createSlimDumps: (files, onProgress, restoreConfig) => {
        const channel = `slim:progress:${Date.now()}`;

        if (onProgress) {
            ipcRenderer.on(channel, (event, progress) => {
                onProgress(progress);
            });
        }

        return ipcRenderer.invoke('slim:start', { files, progressChannel: channel, restoreConfig });
    },

    // Snapshot operation
    createSnapshot: (dbName, description, type, onProgress) => {
        const channel = `snapshot:progress:${Date.now()}`;

        if (onProgress) {
            ipcRenderer.on(channel, (event, progress) => {
                onProgress(progress);
            });
        }

        return ipcRenderer.invoke('snapshot:start', { dbName, description, type, progressChannel: channel });
    },

    // File management operations
    renameFile: (oldPath, newName) => ipcRenderer.invoke('file:rename', { oldPath, newName }),
    replaceFile: (sourcePath, targetPath) => ipcRenderer.invoke('file:replace', { sourcePath, targetPath }),
    deleteFiles: (filePaths) => ipcRenderer.invoke('file:delete', { filePaths }),
    selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

    // Database management operations
    bulkDeleteDatabases: (dbNames, onProgress) => {
        const channel = `database:delete:progress:${Date.now()}`;

        if (onProgress) {
            ipcRenderer.on(channel, (event, progress) => {
                onProgress(progress);
            });
        }

        return ipcRenderer.invoke('database:bulkDelete', { dbNames, progressChannel: channel });
    },

    // Settings operations
    getSettings: () => ipcRenderer.invoke('settings:getAll'),
    getSetting: (key) => ipcRenderer.invoke('settings:get', key),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
    getMySQLConfig: () => ipcRenderer.invoke('settings:getMySQLConfig'),
    saveMySQLConfig: (config) => ipcRenderer.invoke('settings:saveMySQLConfig', config),
    getDatabaseDirectory: () => ipcRenderer.invoke('settings:getDatabaseDirectory'),
    saveDatabaseDirectory: (dir) => ipcRenderer.invoke('settings:saveDatabaseDirectory', dir),
    isFirstRun: () => ipcRenderer.invoke('settings:isFirstRun'),
    setFirstRunComplete: () => ipcRenderer.invoke('settings:setFirstRunComplete'),
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

    // Utility
    onLog: (callback) => {
        ipcRenderer.on('log', (event, message) => callback(message));
    },
    offLog: () => {
        ipcRenderer.removeAllListeners('log');
    }
});

console.log('✅ Preload script loaded successfully. window.dbManager is now available.');
