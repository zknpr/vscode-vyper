'use strict';
/**
 * @file formatter.js
 * @license MIT
 *
 * Document formatter for Vyper files.
 */

const vscode = require('vscode');
const settings = require('../settings');

function formatBuiltin(text) {
    let lines = text.split(/\r?\n/);

    lines = lines.map(line => {
        line = line.replace(/\t/g, '    ');
        line = line.trimEnd();
        return line;
    });

    const result = [];
    let blankCount = 0;

    for (const line of lines) {
        if (line === '') {
            blankCount++;
            if (blankCount <= 2) result.push(line);
        } else {
            blankCount = 0;
            result.push(line);
        }
    }

    while (result.length > 0 && result[result.length - 1] === '') {
        result.pop();
    }

    return result.join('\n') + '\n';
}

class VyperFormattingProvider {
    async provideDocumentFormattingEdits(document, _options, _token) {
        const text = document.getText();
        const config = settings.extensionConfig();
        const externalFormatter = config.get('formatter.command');

        let formatted;
        if (externalFormatter && externalFormatter.trim() !== '') {
            formatted = formatBuiltin(text); // Fallback for now
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
