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
 * Main file delete flow
 * @returns {Promise<void>}
 */
export async function fileDeleteFlow() {
    console.log(chalk.blue.bold('\n🗑️  Delete SQL File\n'));

    // Step 1: Select SQL files to delete
    const sqlFiles = await selectSqlFiles();
    if (!sqlFiles || sqlFiles.length === 0) return;

    // Step 2: Confirm and delete
    await confirmAndDelete(sqlFiles);
}

/**
 * Select SQL files to delete (multiple selection)
 * @returns {Promise<Array<string>|null>} Selected file paths
 */
async function selectSqlFiles() {
    const fullFiles = await discoverSqlFiles('./full');
    const slimFiles = await discoverSqlFiles('./slim');
    const snapshotFiles = await discoverSqlFiles('./snapshots');

    const allFiles = [...fullFiles, ...slimFiles, ...snapshotFiles];

    if (allFiles.length === 0) {
        console.log(chalk.yellow('No SQL files found'));
        return null;
    }

    // Calculate total sizes for each category
    let fullSize = 0;
    let slimSize = 0;
    let snapshotSize = 0;

    for (const file of fullFiles) {
        const info = await getFileInfo(file.path);
        fullSize += parseSize(info.size);
    }
    for (const file of slimFiles) {
        const info = await getFileInfo(file.path);
        slimSize += parseSize(info.size);
    }
    for (const file of snapshotFiles) {
        const info = await getFileInfo(file.path);
        snapshotSize += parseSize(info.size);
    }

    // Create choices with file info
    const choices = [];

    // Add bulk selection options at the top
    if (fullFiles.length > 0) {
        choices.push({
            name: chalk.cyan(`[Select all Full dumps] ${chalk.gray(`(${fullFiles.length} files, ${formatSize(fullSize)})`)}` ),
            value: 'BULK_FULL',
            checked: false
        });
    }
    if (slimFiles.length > 0) {
        choices.push({
            name: chalk.cyan(`[Select all Slim dumps] ${chalk.gray(`(${slimFiles.length} files, ${formatSize(slimSize)})`)}` ),
            value: 'BULK_SLIM',
            checked: false
        });
    }
    if (snapshotFiles.length > 0) {
        choices.push({
            name: chalk.cyan(`[Select all Snapshots] ${chalk.gray(`(${snapshotFiles.length} files, ${formatSize(snapshotSize)})`)}` ),
            value: 'BULK_SNAPSHOTS',
            checked: false
        });
    }

    choices.push(new inquirer.Separator(chalk.gray('─'.repeat(50))));

    // Add individual files
    if (fullFiles.length > 0) {
        choices.push(new inquirer.Separator(chalk.gray('─── Full Dumps ───')));
        for (const file of fullFiles) {
            const info = await getFileInfo(file.path);
            choices.push({
                name: `${file.name} ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                checked: false
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
                checked: false
            });
        }
    }

    if (snapshotFiles.length > 0) {
        choices.push(new inquirer.Separator(chalk.gray('─── Snapshots ───')));
        for (const file of snapshotFiles) {
            const info = await getFileInfo(file.path);
            choices.push({
                name: `${file.name} ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                checked: false
            });
        }
    }

    // Add cancel option
    choices.push(new inquirer.Separator());
    choices.push({
        name: chalk.gray('← Cancel'),
        value: 'CANCEL',
        checked: false
    });

    const { selectedFiles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedFiles',
        message: 'Select files to delete (Space to select, Enter to confirm):',
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
        },
        pageSize: 15
    }]);

    // Check if cancelled
    if (selectedFiles.includes('CANCEL')) {
        console.log(chalk.yellow('Delete cancelled'));
        return null;
    }

    if (selectedFiles.length === 0) {
        console.log(chalk.yellow('Delete cancelled'));
        return null;
    }

    // Expand bulk selections
    let finalFiles = [];
    for (const item of selectedFiles) {
        if (item === 'BULK_FULL') {
            finalFiles.push(...fullFiles.map(f => f.path));
        } else if (item === 'BULK_SLIM') {
            finalFiles.push(...slimFiles.map(f => f.path));
        } else if (item === 'BULK_SNAPSHOTS') {
            finalFiles.push(...snapshotFiles.map(f => f.path));
        } else if (item !== 'CANCEL') {
            finalFiles.push(item);
        }
    }

    // Remove duplicates
    return [...new Set(finalFiles)];
}

/**
 * Parse size string to MB
 * @param {string} sizeStr - Size string like "4.30 GB"
 * @returns {number} Size in MB
 */
function parseSize(sizeStr) {
    const match = sizeStr.match(/([\d.]+)\s*(\w+)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    if (unit === 'GB') return value * 1024;
    if (unit === 'MB') return value;
    if (unit === 'KB') return value / 1024;
    return 0;
}

/**
 * Format size from MB to readable string
 * @param {number} sizeMB - Size in MB
 * @returns {string} Formatted size string
 */
function formatSize(sizeMB) {
    if (sizeMB > 1024) {
        return `${(sizeMB / 1024).toFixed(2)} GB`;
    }
    return `${sizeMB.toFixed(2)} MB`;
}

/**
 * Confirm and perform delete
 * @param {Array<string>} filePaths - File paths to delete
 * @returns {Promise<void>}
 */
async function confirmAndDelete(filePaths) {
    console.log(chalk.red.bold(`\n⚠️  WARNING: This will PERMANENTLY DELETE ${filePaths.length} file(s)!`));
    console.log(chalk.gray('\nFiles to delete:'));

    let totalSize = 0;
    for (const filePath of filePaths) {
        const fileName = path.basename(filePath);
        const info = await getFileInfo(filePath);
        console.log(chalk.gray(`  • ${fileName} ${chalk.yellow(`(${info.size})`)}`));

        // Parse size for total
        const sizeMatch = info.size.match(/([\d.]+)\s*(\w+)/);
        if (sizeMatch) {
            const value = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2];
            if (unit === 'GB') {
                totalSize += value * 1024;
            } else if (unit === 'MB') {
                totalSize += value;
            } else if (unit === 'KB') {
                totalSize += value / 1024;
            }
        }
    }

    const totalSizeStr = totalSize > 1024
        ? `${(totalSize / 1024).toFixed(2)} GB`
        : `${totalSize.toFixed(2)} MB`;

    console.log(chalk.red(`\n  Total size to free: ${totalSizeStr}`));
    console.log(chalk.red(`  This action CANNOT be undone!\n`));

    const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: chalk.red(`Permanently delete ${filePaths.length} file(s)?`),
        default: false
    }]);

    if (!confirmed) {
        console.log(chalk.yellow('Delete cancelled'));
        return;
    }

    const spinner = ora('Deleting files...').start();

    try {
        let deleted = 0;
        for (const filePath of filePaths) {
            await fs.unlink(filePath);
            deleted++;
            spinner.text = `Deleting files... (${deleted}/${filePaths.length})`;
        }

        spinner.succeed(`Successfully deleted ${filePaths.length} file(s)`);
        console.log(chalk.green(`\n✓ Freed approximately ${totalSizeStr} of disk space`));

    } catch (error) {
        spinner.fail('Delete failed');
        throw error;
    }
}
