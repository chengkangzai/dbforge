import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import {
    discoverSqlFiles,
    getFileInfo,
    loadExcludeTables,
    ensureDirectory
} from './files.js';
import {
    createDatabase,
    dropDatabase,
    databaseExists,
    importSql,
    exportSlimSql
} from './mysql.js';
import { formatFileSize } from './utils.js';

/**
 * Main slim dump flow
 * @returns {Promise<void>}
 */
export async function slimFlow() {
    console.log(chalk.blue.bold('\n✂️  Create Slim Dumps\n'));

    // Load excluded tables first
    const excludeTables = await loadExcludeTables();
    if (excludeTables.length === 0) {
        console.log(chalk.yellow('Warning: No tables configured for exclusion in config/exclude-tables.txt'));
        const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Continue anyway (will create full dumps)?',
            default: false
        }]);

        if (!proceed) return;
    } else {
        console.log(chalk.gray(`Excluding ${excludeTables.length} tables: ${excludeTables.join(', ')}\n`));
    }

    // Discover full dumps
    const fullFiles = await discoverSqlFiles('./full');

    if (fullFiles.length === 0) {
        console.log(chalk.yellow('No SQL files found in full/ directory'));
        return;
    }

    // Create choices
    const choices = [];
    for (const file of fullFiles) {
        const info = await getFileInfo(file.path);
        choices.push({
            name: `${file.name} ${chalk.gray(`(${info.size}, ${info.age})`)}`,
            value: file.path,
            checked: false
        });
    }

    choices.push(new inquirer.Separator());
    choices.push({
        name: chalk.cyan('Process all files'),
        value: 'ALL',
        checked: false
    });
    choices.push(new inquirer.Separator());
    choices.push({
        name: chalk.gray('← Cancel'),
        value: 'CANCEL',
        checked: false
    });

    // Select files to process
    const { selectedFiles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedFiles',
        message: 'Select files to create slim dumps:',
        choices,
        validate: (answer) => {
            // Allow if Cancel is selected
            if (answer.includes('CANCEL')) {
                return true;
            }
            // Otherwise require at least one selection
            if (answer.length === 0) {
                return 'You must select at least one file or cancel';
            }
            return true;
        }
    }]);

    // Check if cancelled
    if (selectedFiles.includes('CANCEL')) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
    }

    // Should not happen due to validation, but just in case
    if (selectedFiles.length === 0) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
    }

    // Determine files to process
    const filesToProcess = selectedFiles.includes('ALL')
        ? fullFiles.map(f => f.path)
        : selectedFiles.filter(f => f !== 'ALL' && f !== 'CANCEL');

    // Ensure slim directory exists
    await ensureDirectory('./slim');

    // Process each file
    console.log('');
    for (const file of filesToProcess) {
        await createSlimDump(file, excludeTables);
        console.log('');
    }

    console.log(chalk.green('✓ All slim dumps created successfully!'));
}

/**
 * Create slim dump from full dump
 * @param {string} fullSqlPath - Path to full SQL dump
 * @param {Array<string>} excludeTables - Tables to exclude
 * @returns {Promise<void>}
 */
async function createSlimDump(fullSqlPath, excludeTables) {
    const baseName = path.basename(fullSqlPath, '.sql');
    const tempDbName = `${baseName}_temp`;
    const slimPath = `./slim/${baseName}_slim.sql`;

    const spinner = ora(`Processing ${baseName}`).start();

    try {
        // Step 1: Import to temp database
        spinner.text = `${baseName}: Creating temp database...`;

        if (await databaseExists(tempDbName)) {
            await dropDatabase(tempDbName);
        }
        await createDatabase(tempDbName);

        // Step 2: Import full dump
        spinner.text = `${baseName}: Importing full dump...`;
        await importSql(tempDbName, fullSqlPath, () => {
            // No progress callback to keep spinner clean
        });

        // Step 3: Export slim dump
        spinner.text = `${baseName}: Exporting slim dump...`;
        await exportSlimSql(tempDbName, slimPath, excludeTables, () => {
            // No progress callback
        });

        // Step 4: Cleanup
        spinner.text = `${baseName}: Cleaning up...`;
        await dropDatabase(tempDbName);

        // Step 5: Show results
        const fullStats = await fs.stat(fullSqlPath);
        const slimStats = await fs.stat(slimPath);
        const fullSize = formatFileSize(fullStats.size);
        const slimSize = formatFileSize(slimStats.size);
        const savings = Math.round((1 - slimStats.size / fullStats.size) * 100);

        spinner.succeed(`${baseName}: Slim dump created`);
        console.log(chalk.gray(`  Full: ${fullSize} → Slim: ${slimSize} (${savings}% smaller)`));
        console.log(chalk.gray(`  Saved to: ${slimPath}`));

    } catch (error) {
        spinner.fail(`${baseName}: Failed to create slim dump`);
        console.log(chalk.red(`  Error: ${error.message}`));

        // Cleanup on error
        try {
            if (await databaseExists(tempDbName)) {
                await dropDatabase(tempDbName);
            }
        } catch {
            // Ignore cleanup errors
        }

        throw error;
    }
}
