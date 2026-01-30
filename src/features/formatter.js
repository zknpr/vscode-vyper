'use strict';
/**
 * @file formatter.js
 * @license MIT
 *
 * Document formatter for Vyper files.
 */

const vscode = require('vscode');
const settings = require('../settings');
const { exec } = require('child_process');

function formatExternal(text, command) {
    return new Promise((resolve, reject) => {
        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Formatter error: ${error.message}`);
                if (stderr) console.error(`Formatter stderr: ${stderr}`);
                // On error, reject so we can fallback or do nothing
                reject(error);
                return;
            }
            resolve(stdout);
        });

        if (child.stdin) {
            child.stdin.write(text);
            child.stdin.end();
        }
    });
}

function formatBuiltin(text) {
    // 1. Mask strings and comments
    const placeholders = [];
    const mask = (match) => {
        placeholders.push(match);
        return `__PLACEHOLDER_${placeholders.length - 1}__`;
    };

    // Strings and comments
    const stringCommentPattern = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#[^\r\n]*)/g;
    let maskedText = text.replace(stringCommentPattern, mask);

    // 2. Mask numbers (to protect scientific notation like 1e-10 and prevent splitting)
    // Hex, Binary, Decimal/Float
    const numberPattern = /\b(?:0x[0-9a-fA-F_]+|0b[01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?[\d_]+)?)\b/g;
    maskedText = maskedText.replace(numberPattern, mask);

    // 3. Apply formatting to operators

    // Normalize tabs
    maskedText = maskedText.replace(/\t/g, '    ');

    // Group 1: Always binary/safe to pad
    // Order by length descending
    const alwaysBinaryOps = [
        '//', '->',
        '==', '!=', '<=', '>=',
        '\\+=', '-=', '\\*=', '/=', '%=',
        '=', '/', '%', '<', '>'
    ];
    const safeRegex = new RegExp(`\\s*(${alwaysBinaryOps.join('|')})\\s*`, 'g');
    maskedText = maskedText.replace(safeRegex, ' $1 ');

    // Group 2: Context-sensitive (arithmetic + - * **)
    // Only pad if preceded by an operand (identifier, number placeholder, close paren/bracket)
    // This distinguishes binary op from unary op (e.g. -1, *args)
    // Placeholders end with _, so \w matches them.
    const ambiguousOps = [
        '\\*\\*',
        '\\+', '-', '\\*'
    ];
    // Lookbehind for word char, closing paren, closing bracket, or quote (if string wasn't masked, but it is)
    // We check for \w (includes _ for placeholders), ), ]
    const ambiguousRegex = new RegExp(`(?<=[\\w)\\]])\\s*(${ambiguousOps.join('|')})\\s*`, 'g');
    maskedText = maskedText.replace(ambiguousRegex, ' $1 ');

    // Space after comma
    maskedText = maskedText.replace(/\s*,\s*/g, ', ');

    // 4. Line processing
    let lines = maskedText.split(/\r?\n/);
    lines = lines.map(line => line.trimEnd());

    const result = [];
    let blankCount = 0;

    for (const line of lines) {
        if (line.trim() === '') {
            blankCount++;
            if (blankCount <= 2) result.push('');
        } else {
            blankCount = 0;
            result.push(line);
        }
    }

    while (result.length > 0 && result[result.length - 1] === '') {
        result.pop();
    }

    maskedText = result.join('\n') + '\n';

    // 5. Restore placeholders
    return maskedText.replace(/__PLACEHOLDER_(\d+)__/g, (match, index) => {
        return placeholders[parseInt(index)];
    });
}

class VyperFormattingProvider {
    async provideDocumentFormattingEdits(document, _options, _token) {
        const text = document.getText();
        const config = settings.extensionConfig();
        const externalFormatter = config.get('formatter.command');

        let formatted;
        if (externalFormatter && externalFormatter.trim() !== '') {
            try {
                formatted = await formatExternal(text, externalFormatter);
            } catch (e) {
                vscode.window.showErrorMessage(`Vyper formatter failed: ${e.message}`);
                // Fallback to builtin or return empty edits?
                // Usually better to not mangle code if formatter fails.
                // But user selected "Improve built-in", maybe fallback?
                // Let's fallback for now but warn.
                console.log('Falling back to built-in formatter');
                formatted = formatBuiltin(text);
            }
        } else {
            formatted = formatBuiltin(text);
        }

        if (formatted === text) return [];

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
    }
}

class VyperRangeFormattingProvider {
    provideDocumentRangeFormattingEdits(document, range, _options, _token) {
        const text = document.getText(range);
        const formatted = formatBuiltin(text);
        if (formatted === text) return [];
        return [vscode.TextEdit.replace(range, formatted)];
    }
}

function init(context, languageId) {
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { language: languageId },
            new VyperFormattingProvider()
        )
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider(
            { language: languageId },
            new VyperRangeFormattingProvider()
        )
    );

    console.log('Vyper formatter initialized');
}

module.exports = {
    init,
    formatBuiltin
};
