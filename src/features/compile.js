'use strict';
/**
 * @file compile.js
 * @author github.com/tintinweb
 * @license MIT
 *
 * Vyper compiler integration for VSCode.
 * Features:
 * - Auto-detects vyper in common venv locations
 * - Supports Vyper 0.3.x and 0.4.x
 * - Reports errors to VSCode Problems panel
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const settings = require('../settings');

const execAsync = promisify(exec);

/**
 * Escape a string for safe use in shell commands (POSIX).
 * Wraps the string in single quotes and escapes any embedded single quotes.
 * @param {string} str - The string to escape
 * @returns {string} - Shell-safe escaped string
 */
function shellEscape(str) {
    // Replace single quotes with '\'' (end quote, escaped quote, start quote)
    return "'" + str.replace(/'/g, "'\\''") + "'";
}

const compiler = {
    name: settings.LANGUAGE_ID,
    version: null
};

let VYPER_ID = null;
const VYPER_PATTERN = ' **/*.{vy,vyi}';

const diagnosticCollections = {
    compiler: null
};

// Common venv paths to check for vyper
const VENV_PATHS = [
    '.venv/bin/vyper',
    'venv/bin/vyper',
    '.virtualenv/bin/vyper',
    'virtualenv/bin/vyper',
    'env/bin/vyper',
    '.env/bin/vyper',
    '.venv/Scripts/vyper.exe',
    'venv/Scripts/vyper.exe'
];

/**
 * Get the vyper command - checks venv first, then falls back to configured/default
 */
function getVyperCommand(workspacePath) {
    const configuredCommand = settings.extensionConfig().command;

    // If user explicitly configured a command (not default), use it
    if (configuredCommand && configuredCommand !== 'vyper') {
        return configuredCommand;
    }

    // Try to find vyper in common venv locations
    if (workspacePath) {
        for (const venvPath of VENV_PATHS) {
            const fullPath = path.join(workspacePath, venvPath);
            if (fs.existsSync(fullPath)) {
                console.log(`Found vyper in venv: ${fullPath}`);
                return fullPath;
            }
        }
    }

    return configuredCommand || 'vyper';
}

function displayPaths(paths, options) {
    if (options.quiet === true) return;
    if (!Array.isArray(paths)) paths = Object.keys(paths);
    paths.sort().forEach(contract => {
        if (path.isAbsolute(contract)) {
            contract = '.' + path.sep + path.relative(options.working_directory, contract);
        }
        options.logger.log('> Compiling ' + contract);
    });
}

function workspaceForFile(fpath) {
    const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fpath));
    return workspace ? workspace.uri.fsPath : '';
}

async function checkVyper(sourceFile) {
    const workspacePath = workspaceForFile(sourceFile);
    const vyperCommand = getVyperCommand(workspacePath);

    try {
        const { stdout } = await execAsync(
            `${vyperCommand} --version`,
            { cwd: workspacePath || undefined }
        );
        compiler.version = stdout.trim();
        console.log(`Vyper version: ${compiler.version}`);
    } catch (error) {
        const errorMsg = error.stderr || error.message;
        if (errorMsg.includes('not found') || errorMsg.includes('ENOENT')) {
            throw new Error(
                'Vyper not found. Checked:\n' +
                `- Command: ${vyperCommand}\n` +
                `- Workspace: ${workspacePath}\n\n` +
                'Install vyper with: pip install vyper\n' +
                'Or activate your virtualenv before opening VSCode.'
            );
        }
        throw new Error(`Error executing vyper:\n${errorMsg}`);
    }
}

async function execVyper(sourcePath) {
    const workspacePath = workspaceForFile(sourcePath);
    const vyperCommand = getVyperCommand(workspacePath);

    const formats = compiler.version && compiler.version.startsWith('0.4')
        ? ['annotated_ast']
        : ['bytecode'];

    let escapedTarget;
    if (process.platform.startsWith('win')) {
        if (sourcePath.includes('"')) {
            throw new Error(`Compilation of ${sourcePath} failed. Invalid Filename (quotes).`);
        }
        escapedTarget = `"${sourcePath}"`;
    } else {
        escapedTarget = shellEscape(sourcePath);
    }

    const command = `${vyperCommand} -f${formats.join(',')} ${escapedTarget}`;

    try {
        const { stdout } = await execAsync(command, { cwd: workspacePath || undefined });
        const outputs = stdout.split(/\r?\n/);
        return outputs.reduce((contract, output, index) => {
            if (formats[index]) contract[formats[index]] = output;
            return contract;
        }, {});
    } catch (error) {
        throw new Error(`${error.stderr || error.message}\nCompilation of ${sourcePath} failed.`);
    }
}

async function compileAll(options) {
    options.logger = options.logger || console;
    displayPaths(options.paths, options);

    const contracts = await Promise.all(
        options.paths.map(async (sourcePath) => {
            await execVyper(sourcePath);
            const extension = path.extname(sourcePath);
            const basename = path.basename(sourcePath, extension);
            return { contract_name: basename, sourcePath, compiler };
        })
    );

    const result = contracts.reduce((acc, contract) => {
        acc[contract.contract_name] = contract;
        return acc;
    }, {});

    return { result, paths: options.paths, compilerInfo: { name: 'vyper', version: compiler.version } };
}

async function compileVyper(options) {
    if (options.paths.length === 0) {
        return { result: {}, paths: [], compilerInfo: null };
    }
    await checkVyper(options.paths[0]);
    return compileAll(options);
}

function extractLineNumber(errormsg) {
    let lineNr = 1;
    const lineMatches = /(?:line\s+(\d+))/gm.exec(errormsg);
    if (lineMatches && lineMatches.length === 2) {
        lineNr = parseInt(lineMatches[1], 10);
    }
    return lineNr;
}

function parseErrorMessage(errormsg) {
    const lines = errormsg.split(/\r?\n/);
    let shortmsg = lines[0];
    let lineNr = extractLineNumber(errormsg);

    if (lines.indexOf('SyntaxError: invalid syntax') > -1) {
        const matches = /line (\d+)/gm.exec(errormsg);
        if (matches && matches.length >= 2) lineNr = parseInt(matches[1], 10);
        shortmsg = 'SyntaxError: invalid syntax';
    } else {
        const vyperMatch = /vyper\.exceptions\.\w+Exception:\s+(?:line\s+(\d+)).*$/gm.exec(errormsg);
        if (vyperMatch && vyperMatch.length > 0) {
            shortmsg = vyperMatch[0];
            if (vyperMatch.length >= 2) lineNr = parseInt(vyperMatch[1], 10);
        }
    }

    return { shortmsg, lineNr };
}

/**
 * Command handler - handles both TextDocument and Uri inputs
 */
async function compileActiveFileCommand(input) {
    let contractFile;

    if (!input) {
        contractFile = vscode.window.activeTextEditor?.document;
    } else if (input.uri) {
        contractFile = input;
    } else if (input.fsPath) {
        try {
            contractFile = await vscode.workspace.openTextDocument(input);
        } catch (error) {
            vscode.window.showErrorMessage(`[Compiler Error] Cannot open file: ${error.message}`);
            return;
        }
    } else {
        contractFile = vscode.window.activeTextEditor?.document;
    }

    if (!contractFile || !contractFile.uri) {
        vscode.window.showErrorMessage('[Compiler Error] No active file to compile');
        return;
    }

    try {
        const success = await compileActiveFile(contractFile);

        if (diagnosticCollections.compiler) {
            diagnosticCollections.compiler.delete(contractFile.uri);
        }

        if (settings.extensionConfig().compile.verbose) {
            vscode.window.showInformationMessage('[Compiler success] ' + Object.keys(success).join(','));
        } else {
            vscode.window.setStatusBarMessage('Vyper: Compiled successfully', 3000);
        }
    } catch (errormsg) {
        const errorString = String(errormsg);

        if (settings.extensionConfig().compile.verbose) {
            vscode.window.showErrorMessage('[Compiler Error] ' + errorString);
        }

        if (diagnosticCollections.compiler && contractFile.uri) {
            diagnosticCollections.compiler.delete(contractFile.uri);
            const { shortmsg, lineNr } = parseErrorMessage(errorString);

            diagnosticCollections.compiler.set(contractFile.uri, [{
                code: '',
                message: shortmsg,
                range: new vscode.Range(
                    new vscode.Position(lineNr - 1, 0),
                    new vscode.Position(lineNr - 1, 255)
                ),
                severity: vscode.DiagnosticSeverity.Error,
                source: errorString,
                relatedInformation: []
            }]);
        }
    }
}

async function compileActiveFile(contractFile) {
    if (!contractFile || contractFile.languageId !== VYPER_ID) {
        throw new Error('Not a vyper source file');
    }

    const fileExtension = contractFile.fileName.split('.').pop();
    if (fileExtension !== 'vy') {
        throw new Error('Skipping compilation for interface file');
    }

    const options = {
        contractsDirectory: './contracts',
        working_directory: '',
        all: true,
        paths: [contractFile.uri.fsPath]
    };

    const { result } = await compileVyper(options);
    return result;
}

function init(context, type) {
    VYPER_ID = type;
    diagnosticCollections.compiler = vscode.languages.createDiagnosticCollection('Vyper Compiler');
    context.subscriptions.push(diagnosticCollections.compiler);
}

module.exports = {
    init,
    compileContractCommand: compileActiveFileCommand,
    compileContract: compileActiveFile
};
