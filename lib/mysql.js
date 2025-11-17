import mysql from 'mysql2/promise';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';

let connection = null;
let connectionConfig = null;

/**
 * Set MySQL configuration from electron-store
 * This should be called by the Electron main process before any MySQL operations
 * @param {Object} config - MySQL configuration from electron-store
 * @param {string} config.host - MySQL host
 * @param {number} config.port - MySQL port
 * @param {string} config.user - MySQL username
 * @param {string} config.password - MySQL password
 * @param {string} [config.socket] - MySQL socket path (optional)
 */
export function setMySQLConfig(config) {
    // Close existing connection when config changes
    if (connection) {
        connection.end().catch(() => {});
        connection = null;
    }

    // Store the config for use by MySQL operations
    connectionConfig = {
        host: config.host || 'localhost',
        user: config.user || 'root',
        password: config.password || '',
        port: config.port || 3306,
        socketPath: config.socket || null
    };
}

/**
 * Create MySQL connection using the configured settings
 * @returns {Promise<void>}
 */
export async function createConnection() {
    if (connection) {
        return;
    }

    if (!connectionConfig) {
        throw new Error('MySQL configuration not set. Call setMySQLConfig() first.');
    }

    try {
        // Build connection options
        const connOptions = {
            host: connectionConfig.host,
            user: connectionConfig.user,
            password: connectionConfig.password,
            port: connectionConfig.port
        };

        // Use socket if provided, otherwise use TCP
        if (connectionConfig.socketPath) {
            connOptions.socketPath = connectionConfig.socketPath;
            // Remove host/port when using socket
            delete connOptions.host;
            delete connOptions.port;
        }

        connection = await mysql.createConnection(connOptions);
        await connection.execute('SELECT 1');
    } catch (error) {
        throw new Error(`Cannot connect to MySQL: ${error.message}`);
    }
}

/**
 * Close MySQL connection
 * @returns {Promise<void>}
 */
export async function closeConnection() {
    if (connection) {
        await connection.end();
        connection = null;
    }
}

/**
 * Get connection configuration for mysql CLI
 * @returns {Array<string>} MySQL CLI arguments
 */
function getMysqlCliArgs() {
    const args = ['-u' + connectionConfig.user];

    if (connectionConfig.password) {
        args.push('-p' + connectionConfig.password);
    }

    if (connectionConfig.socketPath) {
        args.push('--socket=' + connectionConfig.socketPath);
    } else {
        args.push('-h' + connectionConfig.host);
        args.push('-P' + connectionConfig.port);
    }

    return args;
}

/**
 * Get list of non-system databases
 * @returns {Promise<Array<string>>} Array of database names
 */
export async function getDatabases() {
    if (!connection) await createConnection();

    const [rows] = await connection.query('SHOW DATABASES');
    const systemDbs = ['information_schema', 'mysql', 'performance_schema', 'sys'];

    return rows
        .map(row => row.Database)
        .filter(db => !systemDbs.includes(db))
        .sort();
}

/**
 * Get database information
 * @param {string} dbName - Database name
 * @returns {Promise<Object>} Database info
 */
export async function getDatabaseInfo(dbName) {
    if (!connection) await createConnection();

    const [tableCount] = await connection.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?',
        [dbName]
    );

    const [sizeResult] = await connection.query(
        'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size FROM information_schema.tables WHERE table_schema = ? GROUP BY table_schema',
        [dbName]
    );

    return {
        tableCount: tableCount[0].count,
        sizeMB: sizeResult[0]?.size || 0
    };
}

/**
 * Check if database exists
 * @param {string} dbName - Database name
 * @returns {Promise<boolean>}
 */
export async function databaseExists(dbName) {
    return new Promise((resolve, reject) => {
        const args = [...getMysqlCliArgs(), '-e', `SHOW DATABASES LIKE '${dbName}'`];
        const mysql = spawn('mysql', args);

        let stdout = '';
        let stderr = '';

        mysql.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        mysql.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        mysql.on('close', (code) => {
            if (code === 0) {
                // Check if any rows were returned (excluding header)
                const lines = stdout.trim().split('\n');
                resolve(lines.length > 1);
            } else {
                reject(new Error(`MySQL check database failed: ${stderr}`));
            }
        });
    });
}

/**
 * Drop database
 * @param {string} dbName - Database name
 * @returns {Promise<void>}
 */
export async function dropDatabase(dbName) {
    return new Promise((resolve, reject) => {
        const args = [...getMysqlCliArgs(), '-e', `DROP DATABASE \`${dbName}\``];
        const mysql = spawn('mysql', args);

        let stderr = '';
        mysql.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        mysql.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`MySQL drop database failed: ${stderr}`));
            }
        });
    });
}

/**
 * Create database
 * @param {string} dbName - Database name
 * @returns {Promise<void>}
 */
export async function createDatabase(dbName) {
    return new Promise((resolve, reject) => {
        const args = [...getMysqlCliArgs(), '-e', `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`];
        const mysql = spawn('mysql', args);

        let stderr = '';
        mysql.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        mysql.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`MySQL create database failed: ${stderr}`));
            }
        });
    });
}

/**
 * Import SQL file into database
 * @param {string} dbName - Database name
 * @param {string} sqlFile - Path to SQL file
 * @param {Function} onProgress - Progress callback (bytesProcessed)
 * @returns {Promise<void>}
 */
export async function importSql(dbName, sqlFile, onProgress) {
    return new Promise((resolve, reject) => {
        const args = [...getMysqlCliArgs(), dbName];
        const mysql = spawn('mysql', args);

        const fileStream = createReadStream(sqlFile);
        let bytesProcessed = 0;

        fileStream.on('data', (chunk) => {
            bytesProcessed += chunk.length;
            if (onProgress) {
                onProgress(bytesProcessed);
            }
        });

        fileStream.pipe(mysql.stdin);

        let stderr = '';
        mysql.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        mysql.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`MySQL import failed: ${stderr}`));
            }
        });
    });
}

/**
 * Export database to SQL file
 * @param {string} dbName - Database name
 * @param {string} outFile - Output SQL file path
 * @param {Array<string>} ignoreTables - Tables to ignore
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<void>}
 */
export async function exportSql(dbName, outFile, ignoreTables = [], onProgress) {
    return new Promise((resolve, reject) => {
        const args = [...getMysqlCliArgs()];

        // Add ignore-table parameters
        for (const table of ignoreTables) {
            args.push(`--ignore-table=${dbName}.${table}`);
        }

        args.push(dbName);

        const mysqldump = spawn('mysqldump', args);
        const fileStream = createWriteStream(outFile);

        let bytesWritten = 0;
        mysqldump.stdout.on('data', (data) => {
            bytesWritten += data.length;
            if (onProgress) {
                onProgress(bytesWritten);
            }
        });

        mysqldump.stdout.pipe(fileStream);

        let stderr = '';
        mysqldump.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        mysqldump.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`MySQL export failed: ${stderr}`));
            }
        });
    });
}

/**
 * Export database to SQL file with table structures but excluding data from specified tables
 * This creates a "slim" dump where excluded tables exist but are empty
 * @param {string} dbName - Database name
 * @param {string} outFile - Output SQL file path
 * @param {Array<string>} excludeDataTables - Tables to exclude data from (but keep structure)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<void>}
 */
export async function exportSlimSql(dbName, outFile, excludeDataTables = [], onProgress) {
    const tempDir = path.dirname(outFile);
    const structureFile = path.join(tempDir, `._temp_structure_${Date.now()}.sql`);
    const dataFile = path.join(tempDir, `._temp_data_${Date.now()}.sql`);

    try {
        // Phase 1: Export all table structures (no data)
        await new Promise((resolve, reject) => {
            const args = [...getMysqlCliArgs(), '--no-data', dbName];
            const mysqldump = spawn('mysqldump', args);
            const fileStream = createWriteStream(structureFile);

            let bytesWritten = 0;
            mysqldump.stdout.on('data', (data) => {
                bytesWritten += data.length;
                if (onProgress) {
                    // Report 50% progress for structure phase
                    onProgress(Math.floor(bytesWritten / 2));
                }
            });

            mysqldump.stdout.pipe(fileStream);

            let stderr = '';
            mysqldump.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            mysqldump.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`MySQL structure export failed: ${stderr}`));
                }
            });
        });

        // Phase 2: Export data only for non-excluded tables
        await new Promise((resolve, reject) => {
            const args = [...getMysqlCliArgs(), '--no-create-info'];

            // Add ignore-table parameters for excluded tables
            for (const table of excludeDataTables) {
                args.push(`--ignore-table=${dbName}.${table}`);
            }

            args.push(dbName);

            const mysqldump = spawn('mysqldump', args);
            const fileStream = createWriteStream(dataFile);

            let bytesWritten = 0;
            mysqldump.stdout.on('data', (data) => {
                bytesWritten += data.length;
                if (onProgress) {
                    // Report 50-100% progress for data phase
                    onProgress(Math.floor(bytesWritten / 2) + bytesWritten);
                }
            });

            mysqldump.stdout.pipe(fileStream);

            let stderr = '';
            mysqldump.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            mysqldump.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`MySQL data export failed: ${stderr}`));
                }
            });
        });

        // Phase 3: Concatenate structure + data into final output file
        await new Promise((resolve, reject) => {
            const output = createWriteStream(outFile);
            const structure = createReadStream(structureFile);
            const data = createReadStream(dataFile);

            // First pipe structure file
            structure.pipe(output, { end: false });

            structure.on('end', () => {
                // Then pipe data file and ensure output ends when data ends
                data.pipe(output);

                // Explicitly listen for data stream end to ensure output closes
                data.on('end', () => {
                    if (!output.destroyed) {
                        output.end();
                    }
                });
            });

            output.on('finish', resolve);
            output.on('error', reject);
            structure.on('error', reject);
            data.on('error', reject);
        });

        // Clean up temp files
        await fs.unlink(structureFile).catch(() => {});
        await fs.unlink(dataFile).catch(() => {});

    } catch (error) {
        // Clean up temp files on error
        await fs.unlink(structureFile).catch(() => {});
        await fs.unlink(dataFile).catch(() => {});
        throw error;
    }
}

/**
 * Test connection and return status
 * @returns {Promise<Object>}
 */
export async function testConnection() {
    try {
        await createConnection();
        const connectionType = connectionConfig.socketPath
            ? `Socket (${connectionConfig.socketPath})`
            : `TCP (${connectionConfig.host}:${connectionConfig.port})`;

        return {
            success: true,
            type: connectionType,
            user: connectionConfig.user
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}
