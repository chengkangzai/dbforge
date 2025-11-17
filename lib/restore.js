import inquirer from 'inquirer';
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import fs from 'fs/promises';
import {
    discoverSqlFiles,
    getFileInfo,
    getDatabaseNameFromFile
} from './files.js';
import {
    getDatabases,
    getDatabaseInfo,
    databaseExists,
    dropDatabase,
    createDatabase,
    importSql
} from './mysql.js';

// Register autocomplete prompt
inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt);

/**
 * Main restore flow
 * @returns {Promise<void>}
 */
export async function restoreFlow() {
    console.log(chalk.blue.bold('\n📥 Restore Database\n'));

    // Step 1: Select SQL file
    const sqlFile = await selectSqlFile();
    if (!sqlFile) return;

    // Step 2: Choose restore type
    const { restoreType } = await inquirer.prompt([{
        type: 'list',
        name: 'restoreType',
        message: 'Restore to:',
        choices: [
            { name: 'New database', value: 'new' },
            { name: 'Existing database', value: 'existing' },
            new inquirer.Separator(),
            { name: chalk.gray('← Cancel'), value: 'cancel' }
        ]
    }]);

    if (restoreType === 'cancel') {
        console.log(chalk.yellow('Restore cancelled'));
        return;
    }

    // Step 3: Get database name
    let dbName;
    if (restoreType === 'new') {
        dbName = await promptNewDatabaseName(sqlFile);
    } else {
        dbName = await selectExistingDatabase();
    }

    if (!dbName) return;

    // Step 4: Confirm and restore
    await confirmAndRestore(dbName, sqlFile);
}

/**
 * Select SQL file from all available dumps
 * @returns {Promise<string|null>} Selected file path
 */
async function selectSqlFile() {
    const fullFiles = await discoverSqlFiles('./full');
    const slimFiles = await discoverSqlFiles('./slim');
    const snapshotFiles = await discoverSqlFiles('./snapshots');

    const allFiles = [...fullFiles, ...slimFiles, ...snapshotFiles];

    if (allFiles.length === 0) {
        console.log(chalk.yellow('No SQL files found in full/, slim/, or snapshots/ directories'));
        return null;
    }

    // Create choices with file info
    const choices = [];

    if (fullFiles.length > 0) {
        choices.push(new inquirer.Separator(chalk.gray('─── Full Dumps ───')));
        for (const file of fullFiles) {
            const info = await getFileInfo(file.path);
            choices.push({
                name: `${file.name} ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                short: file.name
            });
        }
    }

    if (slimFiles.length > 0) {
        choices.push(new inquirer.Separator(chalk.gray('─── Slim Dumps ───')));
        for (const file of slimFiles) {
            const info = await getFileInfo(file.path);
            choices.push({
                name: `${file.name} ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                short: file.name
            });
        }
    }

    if (snapshotFiles.length > 0) {
        choices.push(new inquirer.Separator(chalk.gray('─── Snapshots ───')));
        for (const file of snapshotFiles.slice(0, 10)) {
            const info = await getFileInfo(file.path);
            choices.push({
                name: `${file.name} ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                short: file.name
            });
        }
        if (snapshotFiles.length > 10) {
            choices.push(new inquirer.Separator(chalk.gray(`... and ${snapshotFiles.length - 10} more`)));
        }
    }

    // Add cancel option
    choices.push(new inquirer.Separator());
    choices.push({
        name: chalk.gray('← Cancel'),
        value: null,
        short: 'Cancel'
    });

    const { file } = await inquirer.prompt([{
        type: 'list',
        name: 'file',
        message: 'Select SQL file to restore:',
        choices,
        pageSize: 15
    }]);

    return file;
}

/**
 * Prompt for new database name
 * @param {string} sqlFile - SQL file path
 * @returns {Promise<string|null>} Database name
 */
async function promptNewDatabaseName(sqlFile) {
    const suggestedName = getDatabaseNameFromFile(sqlFile);

    const { dbName } = await inquirer.prompt([{
        type: 'input',
        name: 'dbName',
        message: 'Enter new database name:',
        default: suggestedName,
        validate: (input) => {
            if (!input) return 'Database name is required';
            if (!/^[a-zA-Z0-9_]+$/.test(input)) {
                return 'Database name can only contain letters, numbers, and underscores';
            }
            return true;
        }
    }]);

    // Check if database already exists
    if (await databaseExists(dbName)) {
        const { overwrite } = await inquirer.prompt([{
            type: 'confirm',
            name: 'overwrite',
            message: `Database '${dbName}' already exists. Drop and recreate?`,
            default: true
        }]);

        if (!overwrite) {
            console.log(chalk.yellow('Restore cancelled'));
            return null;
        }
    }

    return dbName;
}

/**
 * Select existing database with autocomplete
 * @returns {Promise<string|null>} Database name
 */
async function selectExistingDatabase() {
    const databases = await getDatabases();

    if (databases.length === 0) {
        console.log(chalk.yellow('No existing databases found'));
        return null;
    }

    // Get database info for all databases
    const dbInfoMap = new Map();
    for (const db of databases) {
        const info = await getDatabaseInfo(db);
        dbInfoMap.set(db, info);
    }

    let dbName;
    try {
        const answer = await inquirer.prompt([{
            type: 'autocomplete',
            name: 'dbName',
            message: 'Select database (type to filter):',
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
                        name: `${db} ${chalk.gray(`(${info.tableCount} tables)`)}`,
                        value: db,
                        short: db
                    });
                });

                return choices;
            }
        }]);
        dbName = answer.dbName;
    } catch (error) {
        // User pressed Ctrl+C
        console.log(chalk.yellow('\nRestore cancelled'));
        return null;
    }

    // Check if user selected cancel
    if (!dbName) {
        console.log(chalk.yellow('Restore cancelled'));
        return null;
    }

    // Confirm overwrite
    const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: `This will OVERWRITE all data in '${dbName}'. Continue?`,
        default: true
    }]);

    if (!confirmed) {
        console.log(chalk.yellow('Restore cancelled'));
        return null;
    }

    return dbName;
}

/**
 * Confirm and perform restore
 * @param {string} dbName - Database name
 * @param {string} sqlFile - SQL file path
 * @returns {Promise<void>}
 */
async function confirmAndRestore(dbName, sqlFile) {
    const spinner = ora('Preparing database...').start();

    try {
        // Drop and recreate database
        if (await databaseExists(dbName)) {
            await dropDatabase(dbName);
        }
        await createDatabase(dbName);

        spinner.succeed('Database prepared');

        // Get file size for progress bar
        const stats = await fs.stat(sqlFile);
        const fileSizeMB = Math.round(stats.size / 1024 / 1024);

        // Create progress bar
        const progressBar = new cliProgress.SingleBar({
            format: 'Restoring |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} MB | ETA: {eta}s',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        progressBar.start(fileSizeMB, 0);

        // Import SQL
        await importSql(dbName, sqlFile, (bytesProcessed) => {
            const mbProcessed = Math.round(bytesProcessed / 1024 / 1024);
            progressBar.update(mbProcessed);
        });

        progressBar.stop();

        // Show success message with database info
        const info = await getDatabaseInfo(dbName);
        console.log(chalk.green(`\n✓ Database '${dbName}' restored successfully!`));
        console.log(chalk.blue(`  Total tables: ${info.tableCount}`));
        console.log(chalk.blue(`  Database size: ${info.sizeMB} MB`));

    } catch (error) {
        spinner.fail('Restore failed');
        throw error;
    }
}
