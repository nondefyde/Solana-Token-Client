const fs = require('fs');
const path = require('path');

const config = {
    // Root folder to start scanning (can be multiple)
    includeFolders: ['target', 'src'],
    // Files/folders to exclude
    exclude: [
        'node_modules',
        'dist',
        '.git',
        'target',
        '.idea',
        '_env',
        '.vscode',
        'test-ledger',
        'tests',
        'migrations',
        'temp'
    ],
    // File extensions to include
    extensions: ['.md', '.toml', 'yaml', '.rs', '.json', '.ts'],
};

/**
 * Recursively find all files matching the criteria
 * @param {string} dir - Directory to search
 * @param {string[]} relativePathParts - Accumulator for relative path parts
 * @returns {Promise<string[]>} - Array of file paths
 */
async function findFiles(dir, relativePathParts = []) {
    const files = [];

    try {
        const entries = await fs.promises.readdir(dir, {withFileTypes: true});

        for (const entry of entries) {
            const entryName = entry.name;
            const fullPath = path.join(dir, entryName);
            const currentRelativePath = [...relativePathParts, entryName];

            // Skip excluded directories and files
            if (config.exclude.includes(entryName)) {
                continue;
            }

            if (entry.isDirectory()) {
                // Recursively search directories
                const subFiles = await findFiles(fullPath, currentRelativePath);
                files.push(...subFiles);
            } else {
                // Include file if it has the right extension
                const ext = path.extname(fullPath);
                if (config.extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    } catch (err) {
        console.error(`Error reading ${dir}:`, err);
    }

    return files;
}

/**
 * Merge files content into a single file
 * @param {string[]} files - Array of file paths
 * @param {string} outputPath - Output file path
 * @returns {Promise<void>}
 */
async function mergeFiles(files, outputPath) {
    let content = '';
    const rootDir = process.cwd();

    // Add header with metadata
    content += `// Merged Files\n`;
    content += `// Generated: ${new Date().toISOString()}\n`;
    content += `// Total Files: ${files.length}\n\n`;

    // Sort files by directory structure
    files.sort((a, b) => {
        const relativeA = path.relative(rootDir, a);
        const relativeB = path.relative(rootDir, b);
        return relativeA.localeCompare(relativeB);
    });

    for (const file of files) {
        try {
            const fileContent = await fs.promises.readFile(file, 'utf-8');
            const relativePath = path.relative(rootDir, file);
            content += `\n// =====================================\n`;
            content += `// FILE: ${relativePath}\n`;
            content += `// =====================================\n\n`;
            content += fileContent + '\n\n';
        } catch (err) {
            console.error(`Error reading ${file}:`, err);
        }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.promises.mkdir(outputDir, {recursive: true});

    await fs.promises.writeFile(outputPath, content);
}

/**
 * Generate a directory tree structure for documentation
 * @param {string[]} files - Array of file paths
 * @returns {string} - Tree structure in string format
 */
function generateDirTree(files) {
    const rootDir = process.cwd();
    const tree = {};

    // Build tree structure
    files.forEach(file => {
        const relPath = path.relative(rootDir, file);
        const parts = relPath.split(path.sep);

        let current = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                // Leaf node (file)
                current[part] = null;
            } else {
                // Directory
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
        }
    });

    // Convert tree to string representation
    function treeToString(node, prefix = '', isLast = true) {
        const entries = Object.entries(node || {});
        if (entries.length === 0) return '';

        let result = '';

        entries.forEach(([key, value], index) => {
            const isLastItem = index === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            result += `${prefix}${connector}${key}\n`;

            if (value !== null) {
                result += treeToString(value, prefix + childPrefix, isLastItem);
            }
        });

        return result;
    }

    return treeToString(tree);
}

/**
 * Main function
 */
async function main() {
    const startTime = Date.now();
    console.log('Starting file search in folders:', config.includeFolders);

    const allFiles = [];

    // Search each included folder
    for (const folder of config.includeFolders) {
        const folderPath = path.join(process.cwd(), folder);
        if (fs.existsSync(folderPath)) {
            const files = await findFiles(folderPath);
            allFiles.push(...files);
            console.log(`Found ${files.length} files in ${folder}/`);
        }
    }

    if (allFiles.length === 0) {
        console.log('No files found');
        return;
    }

    // Create output directory
    const outputDir = path.join(process.cwd(), 'llm');
    await fs.promises.mkdir(outputDir, {recursive: true});

    // Generate output filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `client-files-${timestamp}.txt`);

    // Merge and save files
    await mergeFiles(allFiles, outputFile);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nMerge complete:`);
    console.log(`- Processed ${allFiles.length} files`);
    console.log(`- Output saved to: ${outputFile}`);
    console.log(`- Time taken: ${duration}s`);

    // Print directory summary
    const dirCounts = {};
    allFiles.forEach((file) => {
        const relativePath = path.relative(process.cwd(), file);
        const parts = relativePath.split(path.sep);
        let current = dirCounts;

        // Count files in each directory level
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = {_count: 0, _fileCount: 0};
            }
            current[part]._count++;
            if (i === parts.length - 2) {
                current[part]._fileCount++;
            }
            current = current[part];
        }
    });

    console.log('\nFiles by directory:');
    Object.entries(dirCounts).forEach(([dir, data]) => {
        console.log(`- ${dir}: ${data._fileCount} files (${data._count} total including subdirectories)`);
    });

    // Generate and display directory tree
    console.log('\nDirectory Structure:');
    console.log(generateDirTree(allFiles));
}

main().catch(console.error);