import inquirer from 'inquirer';
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import {
    loadExcludeTables,
    ensureDirectory
} from './files.js';
import {
    getDatabases,
    getDatabaseInfo,
    exportSql
} from './mysql.js';
import {
    sanitizeFilename,
    getTimestamp,
    formatFileSize
} from './utils.js';

// Register autocomplete prompt
inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt);

/**
 * Main snapshot flow
 * @returns {Promise<void>}
 */
export async function snapshotFlow() {
    console.log(chalk.blue.bold('\n📸 Create Snapshot\n'));

    // Get local databases
    const databases = await getDatabases();

    if (databases.length === 0) {
        console.log(chalk.yellow('No databases found'));
        return;
    }

    // Step 1: Select database
    const dbName = await selectDatabase(databases);
    if (!dbName) {
        console.log(chalk.yellow('\nSnapshot cancelled'));
        return;
    }

    // Step 2: Enter description
    const { description } = await inquirer.prompt([{
        type: 'input',
        name: 'description',
        message: 'Snapshot description:',
        validate: (input) => {
            if (!input || input.trim().length === 0) {
                return 'Description is required';
            }
            return true;
        }
    }]);

    // Step 3: Choose snapshot type
    const { snapshotType } = await inquirer.prompt([{
        type: 'list',
        name: 'snapshotType',
        message: 'Snapshot type:',
        choices: [
            { name: 'Full snapshot (all tables)', value: 'full' },
            { name: 'Slim snapshot (exclude large tables)', value: 'slim' },
            new inquirer.Separator(),
            { name: chalk.gray('← Cancel'), value: 'cancel' }
        ]
    }]);

    if (snapshotType === 'cancel') {
        console.log(chalk.yellow('Snapshot cancelled'));
        return;
    }

    // Step 4: Create snapshot
    await createSnapshot(dbName, description, snapshotType);
}

/**
 * Select database with autocomplete
 * @param {Array<string>} databases - Available databases
 * @returns {Promise<string|null>} Selected database name
 */
async function selectDatabase(databases) {
    // Get database info for all databases
    const dbInfoMap = new Map();
    for (const db of databases) {
        const info = await getDatabaseInfo(db);
        dbInfoMap.set(db, info);
    }

    try {
        const { dbName } = await inquirer.prompt([{
            type: 'autocomplete',
            name: 'dbName',
            message: 'Select database to snapshot (type to filter):',
            source: async (answersSoFar, input) => {
                const filtered = databases.filter(db =>
                    !input || db.toLowerCase().includes(input.toLowerCase())
                );

                const choices = [];

                // Add cancel option at the top
                choices.push({
                    name: chalk.gray('← Cancel'),
                    value: null,
                    short: 'Cancel'
                });

                // Add separator
                choices.push(new inquirer.Separator(chalk.gray('─'.repeat(50))));

                // Add database choices
                filtered.forEach(db => {
                    const info = dbInfoMap.get(db);
                    choices.push({
                        name: `${db} ${chalk.gray(`(${info.tableCount} tables, ${info.sizeMB} MB)`)}`,
                        value: db,
                        short: db
                    });
                });

                return choices;
            }
        }]);

        return dbName;
    } catch (error) {
        // User pressed Ctrl+C
        return null;
    }
}

/**
 * Create snapshot of database
 * @param {string} dbName - Database name
 * @param {string} description - Snapshot description
 * @param {string} type - 'full' or 'slim'
 * @returns {Promise<void>}
 */
async function createSnapshot(dbName, description, type) {
    const timestamp = getTimestamp();
    const sanitized = sanitizeFilename(description);
    const filename = `${dbName}_snapshot_${sanitized}_${timestamp}.sql`;

    // Ensure snapshots directory exists
    await ensureDirectory('./snapshots');

    const filepath = `./snapshots/${filename}`;

    const spinner = ora('Creating snapshot...').start();

    try {
        // Load exclude tables if slim
        const excludeTables = type === 'slim'
            ? await loadExcludeTables()
            : [];

        if (type === 'slim' && excludeTables.length === 0) {
            spinner.warn('No exclude tables configured, creating full snapshot instead');
        }

        // Export database
        spinner.text = 'Exporting database...';
        await exportSql(dbName, filepath, excludeTables, () => {
            // No progress callback to keep spinner clean
        });

        // Get snapshot info
        const stats = await fs.stat(filepath);
        const size = formatFileSize(stats.size);
        const info = await getDatabaseInfo(dbName);

        spinner.succeed('Snapshot created successfully!');
        console.log(chalk.blue(`  Location: ${filepath}`));
        console.log(chalk.blue(`  Size: ${size}`));
        console.log(chalk.blue(`  Tables: ${info.tableCount}`));
        console.log(chalk.blue(`  Type: ${type === 'slim' && excludeTables.length > 0 ? 'Slim' : 'Full'}`));

    } catch (error) {
        spinner.fail('Snapshot creation failed');
        throw error;
    }
}
