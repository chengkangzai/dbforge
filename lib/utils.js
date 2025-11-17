import fs from 'fs/promises';

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Calculate file age and format it
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} Formatted age
 */
export async function formatFileAge(filePath) {
    try {
        const stats = await fs.stat(filePath);
        const now = Date.now();
        const modified = stats.mtimeMs;
        const diff = Math.floor((now - modified) / 1000); // seconds

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
        if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
        return `${Math.floor(diff / 31536000)}y ago`;
    } catch (error) {
        return 'N/A';
    }
}

/**
 * Sanitize filename by removing special characters
 * @param {string} name - Input filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(name) {
    return name
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
}

/**
 * Get formatted timestamp for filenames
 * @returns {string} Timestamp in YYYYMMDD_HHMMSS format
 */
export function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
