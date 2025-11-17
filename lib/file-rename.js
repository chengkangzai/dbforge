import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import {
    discoverSqlFiles,
    getFileInfo
} from './files.js';

/**
 * Main file rename flow
 * @returns {Promise<void>}
 */
export async function fileRenameFlow() {
    console.log(chalk.blue.bold('\n✏️  Rename SQL File\n'));

    // Step 1: Select directory filter
    const directory = await selectDirectory();
    if (!directory) return;

    // Step 2: Select SQL file
    const sqlFile = await selectSqlFile(directory);
    if (!sqlFile) return;

    // Step 3: Enter new name
    const newName = await promptNewName(sqlFile);
    if (!newName) return;

    // Step 4: Confirm and rename
    await confirmAndRename(sqlFile, newName);
}

/**
 * Select directory to filter files
 * @returns {Promise<string|null>} Directory choice ('all', 'full', 'slim', 'snapshots')
 */
async function selectDirectory() {
    const fullFiles = await discoverSqlFiles('./full');
    const slimFiles = await discoverSqlFiles('./slim');
    const snapshotFiles = await discoverSqlFiles('./snapshots');

    const totalFiles = fullFiles.length + slimFiles.length + snapshotFiles.length;

    if (totalFiles === 0) {
        console.log(chalk.yellow('No SQL files found'));
        return null;
    }

    const { directory } = await inquirer.prompt([{
        type: 'list',
        name: 'directory',
        message: 'Which directory?',
        choices: [
            {
                name: `All files ${chalk.gray(`(${totalFiles} files)`)}`,
                value: 'all',
                short: 'All files'
            },
            {
                name: `Full dumps only ${chalk.gray(`(${fullFiles.length} files)`)}`,
                value: 'full',
                short: 'Full dumps'
            },
            {
                name: `Slim dumps only ${chalk.gray(`(${slimFiles.length} files)`)}`,
                value: 'slim',
                short: 'Slim dumps'
            },
            {
                name: `Snapshots only ${chalk.gray(`(${snapshotFiles.length} files)`)}`,
                value: 'snapshots',
                short: 'Snapshots'
            },
            new inquirer.Separator(),
            {
                name: chalk.gray('← Cancel'),
                value: null,
                short: 'Cancel'
            }
        ]
    }]);

    return directory;
}

/**
 * Select SQL file from filtered dumps
 * @param {string} directory - Directory filter ('all', 'full', 'slim', 'snapshots')
 * @returns {Promise<string|null>} Selected file path
 */
async function selectSqlFile(directory) {
    let fullFiles = [];
    let slimFiles = [];
    let snapshotFiles = [];

    // Load files based on filter
    if (directory === 'all' || directory === 'full') {
        fullFiles = await discoverSqlFiles('./full');
    }
    if (directory === 'all' || directory === 'slim') {
        slimFiles = await discoverSqlFiles('./slim');
    }
    if (directory === 'all' || directory === 'snapshots') {
        snapshotFiles = await discoverSqlFiles('./snapshots');
    }

    const allFiles = [...fullFiles, ...slimFiles, ...snapshotFiles];

    if (allFiles.length === 0) {
        console.log(chalk.yellow('No SQL files found'));
        return null;
    }

    // Create choices with file info
    const choices = [];

    if (fullFiles.length > 0) {
        if (directory === 'all') {
            choices.push(new inquirer.Separator(chalk.gray('─── Full Dumps ───')));
        }
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
        if (directory === 'all') {
            choices.push(new inquirer.Separator(chalk.gray('─── Slim Dumps ───')));
        }
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
        if (directory === 'all') {
            choices.push(new inquirer.Separator(chalk.gray('─── Snapshots ───')));
        }
        // Show all snapshots when filtered, limit when showing all
        const filesToShow = directory === 'snapshots' ? snapshotFiles : snapshotFiles.slice(0, 10);
        for (const file of filesToShow) {
            const info = await getFileInfo(file.path);
            choices.push({
                name: `${file.name} ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                short: file.name
            });
        }
        if (directory === 'all' && snapshotFiles.length > 10) {
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
        message: 'Select SQL file to rename:',
        choices,
        pageSize: 15
    }]);

    return file;
}

/**
 * Prompt for new file name
 * @param {string} oldPath - Old file path
 * @returns {Promise<string|null>} New file name
 */
async function promptNewName(oldPath) {
    const oldName = path.basename(oldPath, '.sql');
    const directory = path.dirname(oldPath);

    const { newName } = await inquirer.prompt([{
        type: 'input',
        name: 'newName',
        message: `Enter new name for '${oldName}.sql':`,
        default: oldName,
        validate: async (input) => {
            if (!input || input.trim().length === 0) {
                return 'File name is required';
            }

            // Remove .sql extension if user added it
            const cleanName = input.replace(/\.sql$/, '');

            if (cleanName === oldName) {
                return 'New name must be different from old name';
            }

            // Check if file already exists
            const newPath = path.join(directory, `${cleanName}.sql`);
            try {
                await fs.access(newPath);
                return `File '${cleanName}.sql' already exists`;
            } catch {
                // File doesn't exist, which is what we want
                return true;
            }
        }
    }]);

    return newName ? newName.replace(/\.sql$/, '') : null;
}

/**
 * Confirm and perform rename
 * @param {string} oldPath - Old file path
 * @param {string} newName - New file name (without .sql extension)
 * @returns {Promise<void>}
 */
async function confirmAndRename(oldPath, newName) {
    const oldFileName = path.basename(oldPath);
    const directory = path.dirname(oldPath);
    const newPath = path.join(directory, `${newName}.sql`);

    const info = await getFileInfo(oldPath);

    console.log(chalk.yellow(`\n  Old: ${oldFileName}`));
    console.log(chalk.green(`  New: ${newName}.sql`));
    console.log(chalk.gray(`  Size: ${info.size}\n`));

    const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Confirm rename?',
        default: true
    }]);

    if (!confirmed) {
        console.log(chalk.yellow('Rename cancelled'));
        return;
    }

    const spinner = ora('Renaming file...').start();

    try {
        await fs.rename(oldPath, newPath);

        spinner.succeed('File renamed successfully');
        console.log(chalk.green(`\n✓ Renamed to '${newName}.sql'`));
        console.log(chalk.blue(`  Location: ${newPath}`));

    } catch (error) {
        spinner.fail('Rename failed');
        throw error;
    }
}
