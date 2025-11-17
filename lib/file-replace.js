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
 * Main file replace flow
 * @returns {Promise<void>}
 */
export async function fileReplaceFlow() {
    console.log(chalk.blue.bold('\n🔄 Replace SQL File\n'));
    console.log(chalk.gray('Replace an existing SQL file with a new version\n'));

    // Step 1: Get source file (new version) first
    const sourceFile = await getSourceFile();
    if (!sourceFile) return;

    // Step 2: Find and select matching target file
    const targetFile = await selectTargetFile(sourceFile);
    if (!targetFile) return;

    // Step 3: Confirm and replace
    await confirmAndReplace(sourceFile, targetFile);
}

/**
 * Get source file (new version) from user
 * @returns {Promise<string|null>} Source file path
 */
async function getSourceFile() {
    console.log(chalk.gray('Enter the path to the NEW SQL file (you can drag & drop the file here)\n'));

    const { sourcePath } = await inquirer.prompt([{
        type: 'input',
        name: 'sourcePath',
        message: 'New file path:',
        validate: async (input) => {
            if (!input || input.trim().length === 0) {
                return 'File path is required';
            }

            // Clean up path (remove quotes if drag-dropped)
            const cleanPath = input.trim().replace(/^['"]|['"]$/g, '');

            // Check if file exists
            try {
                await fs.access(cleanPath);
                const stats = await fs.stat(cleanPath);

                if (!stats.isFile()) {
                    return 'Path must be a file, not a directory';
                }

                if (!cleanPath.endsWith('.sql')) {
                    return 'File must be a .sql file';
                }

                return true;
            } catch {
                return 'File not found or not accessible';
            }
        }
    }]);

    // Clean up path
    return sourcePath ? sourcePath.trim().replace(/^['"]|['"]$/g, '') : null;
}

/**
 * Select target file to replace based on source filename
 * @param {string} sourceFile - Source file path
 * @returns {Promise<string|null>} Selected target file path
 */
async function selectTargetFile(sourceFile) {
    const sourceFileName = path.basename(sourceFile, '.sql');
    const sourceInfo = await getFileInfo(sourceFile);

    console.log(chalk.green(`\n✓ Found: ${path.basename(sourceFile)} ${chalk.gray(`(${sourceInfo.size})`)}`));

    const fullFiles = await discoverSqlFiles('./full');
    const slimFiles = await discoverSqlFiles('./slim');

    const allFiles = [...fullFiles, ...slimFiles];

    if (allFiles.length === 0) {
        console.log(chalk.yellow('\nNo SQL files found in full/ or slim/ directories'));
        return null;
    }

    // Find matching files (same base name)
    const matchingFiles = allFiles.filter(f => {
        const targetName = path.basename(f.path, '.sql');
        return targetName === sourceFileName || targetName.replace(/_slim$/, '') === sourceFileName;
    });

    // Create choices with file info
    const choices = [];

    if (matchingFiles.length > 0) {
        choices.push(new inquirer.Separator(chalk.gray('─── Matching Files ───')));
        for (const file of matchingFiles) {
            const info = await getFileInfo(file.path);
            const dir = path.dirname(file.path).split('/').pop();
            choices.push({
                name: `${file.name} in ${dir}/ ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                short: file.name
            });
        }
    }

    // Add all other files
    const otherFullFiles = fullFiles.filter(f => !matchingFiles.includes(f));
    const otherSlimFiles = slimFiles.filter(f => !matchingFiles.includes(f));

    if (otherFullFiles.length > 0 || otherSlimFiles.length > 0) {
        choices.push(new inquirer.Separator(chalk.gray('─── Other Files ───')));

        for (const file of [...otherFullFiles, ...otherSlimFiles]) {
            const info = await getFileInfo(file.path);
            const dir = path.dirname(file.path).split('/').pop();
            choices.push({
                name: `${file.name} in ${dir}/ ${chalk.gray(`(${info.size}, ${info.age})`)}`,
                value: file.path,
                short: file.name
            });
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
        message: 'Which file do you want to replace?',
        choices,
        pageSize: 15
    }]);

    return file;
}

/**
 * Confirm and perform replace
 * @param {string} sourceFile - Source file path
 * @param {string} targetFile - Target file path
 * @returns {Promise<void>}
 */
async function confirmAndReplace(sourceFile, targetFile) {
    const sourceFileName = path.basename(sourceFile);
    const targetFileName = path.basename(targetFile);

    // Check if source and target are the same
    const resolvedSource = path.resolve(sourceFile);
    const resolvedTarget = path.resolve(targetFile);
    if (resolvedSource === resolvedTarget) {
        console.log(chalk.yellow('\n⚠️  Source and target are the same file. Nothing to replace.'));
        return;
    }

    const sourceInfo = await getFileInfo(sourceFile);
    const targetInfo = await getFileInfo(targetFile);

    console.log(chalk.yellow(`\n⚠️  This will REPLACE the existing file!`));
    console.log(chalk.gray(`\n  Old: ${targetFileName} ${chalk.red(`(${targetInfo.size})`)}`));
    console.log(chalk.gray(`  New: ${sourceFileName} ${chalk.green(`(${sourceInfo.size})`)}`));
    console.log(chalk.red(`\n  The old file will be DELETED!\n`));

    const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: `Replace '${targetFileName}' with new version?`,
        default: true
    }]);

    if (!confirmed) {
        console.log(chalk.yellow('Replace cancelled'));
        return;
    }

    const spinner = ora('Replacing file...').start();

    try {
        // Copy new file to target location
        await fs.copyFile(sourceFile, targetFile);

        spinner.succeed('File replaced successfully');
        console.log(chalk.green(`\n✓ Successfully replaced '${targetFileName}'`));
        console.log(chalk.blue(`  New size: ${sourceInfo.size}`));
        console.log(chalk.blue(`  Location: ${targetFile}`));
        console.log(chalk.gray(`\n  Original source file preserved at:`));
        console.log(chalk.gray(`  ${sourceFile}`));

    } catch (error) {
        spinner.fail('Replace failed');
        throw error;
    }
}
