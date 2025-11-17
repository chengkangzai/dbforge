import fs from 'fs/promises';
import path from 'path';
import { formatFileSize, formatFileAge } from './utils.js';

/**
 * Discover all SQL files in a directory
 * @param {string} directory - Directory to search
 * @returns {Promise<Array>} Array of file objects
 */
export async function discoverSqlFiles(directory) {
    try {
        const files = await fs.readdir(directory);
        const sqlFiles = files.filter(file => file.endsWith('.sql'));

        const fileObjects = await Promise.all(
            sqlFiles.map(async (file) => {
                const filePath = path.join(directory, file);
                const stats = await fs.stat(filePath);

                return {
                    name: file,
                    path: filePath,
                    size: stats.size,
                    modified: stats.mtimeMs
                };
            })
        );

        // Sort by modified date, newest first
        return fileObjects.sort((a, b) => b.modified - a.modified);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Get detailed file information
 * @param {string} filePath - Path to file
 * @returns {Promise<Object>} File info object
 */
export async function getFileInfo(filePath) {
    try {
        const stats = await fs.stat(filePath);
        const size = await formatFileSize(stats.size);
        const age = await formatFileAge(filePath);

        return {
            path: filePath,
            name: path.basename(filePath),
            size,
            sizeBytes: stats.size,
            age,
            modified: stats.mtime
        };
    } catch (error) {
        return {
            path: filePath,
            name: path.basename(filePath),
            size: 'N/A',
            sizeBytes: 0,
            age: 'N/A',
            modified: null
        };
    }
}

/**
 * Load excluded tables from config file
 * @param {string} configPath - Path to exclude config file
 * @returns {Promise<Array<string>>} Array of table names to exclude
 */
export async function loadExcludeTables(configPath = './config/exclude-tables.txt') {
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        const lines = content.split('\n');

        // Filter out comments and empty lines
        return lines
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Get database name from SQL filename
 * @param {string} filename - SQL filename
 * @returns {string} Database name
 */
export function getDatabaseNameFromFile(filename) {
    const baseName = path.basename(filename, '.sql');
    // Remove _slim suffix if present
    return baseName.replace(/_slim$/, '');
}

/**
 * Ensure directory exists, create if not
 * @param {string} directory - Directory path
 * @returns {Promise<void>}
 */
export async function ensureDirectory(directory) {
    try {
        await fs.access(directory);
    } catch {
        await fs.mkdir(directory, { recursive: true });
    }
}
