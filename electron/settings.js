import Store from 'electron-store';
import path from 'path';
import { app } from 'electron';
import os from 'os';

// Create electron-store instance
const store = new Store({
    name: 'db-manager-config',
    defaults: {
        mysql: {
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            socket: os.platform() === 'darwin' ? '/tmp/mysql_3306.sock' : ''
        },
        database: {
            directory: path.join(app.getPath('documents'), 'DatabaseManager')
        },
        firstRun: true
    }
});

export function getSettings() {
    return store.store;
}

export function getSetting(key) {
    return store.get(key);
}

export function setSetting(key, value) {
    store.set(key, value);
}

export function getMySQLConfig() {
    return store.get('mysql');
}

export function setMySQLConfig(config) {
    store.set('mysql', config);
}

export function getDatabaseDirectory() {
    return store.get('database.directory');
}

export function setDatabaseDirectory(dir) {
    store.set('database.directory', dir);
}

export function isFirstRun() {
    return store.get('firstRun', true);
}

export function setFirstRunComplete() {
    store.set('firstRun', false);
}

export function resetSettings() {
    store.clear();
}

export function getStoreFilePath() {
    return store.path;
}
