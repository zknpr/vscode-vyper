'use strict';
/**
 * @file extension.js
 * @author github.com/tintinweb
 * @license MIT
 *
 * VSCode extension for Vyper smart contract development.
 */

const vscode = require('vscode');
const mod_deco = require('./features/deco.js');
const mod_hover = require('./features/hover/hover.js');
const mod_compile = require('./features/compile.js');
const mod_formatter = require('./features/formatter.js');
const settings = require('./settings');

let activeEditor;

const DECORATION_PATTERNS = {
    warning: [
        { regex: '^@\\b(public|modifying|nonpayable|payable|external|deploy)\\b', captureGroup: 0 },
        { regex: '\\b(send|raw_call|selfdestruct|create_forwarder_to|create_minimal_proxy_to|create_copy_of|create_from_blueprint)\\b', captureGroup: 0, hoverMessage: '**potentially unsafe** lowlevel call' },
        { regex: '\\b(extcall|staticcall)\\b', captureGroup: 0 }
    ],
    info: [{ regex: '\\b(\\.balance|msg\\.[\\w]+|block\\.[\\w]+)\\b', captureGroup: 0 }],
    safe: [{ regex: '^@\\b(private|nonreentrant|constant|internal|view|pure|event)\\b', captureGroup: 0 }],
    events: [{ regex: '\\b(log)\\.', captureGroup: 1 }, { regex: '\\b(clear)\\b\\(', captureGroup: 1 }],
    special: [{ regex: '\\b(__init__|__default__)\\b', captureGroup: 0 }]
};

async function onDidSave(document) {
    if (!settings.extensionConfig().compile.onSave) return;
    if (document.languageId !== settings.LANGUAGE_ID) return;
    if (document.fileName.split('.').pop() !== 'vy') return;
    mod_compile.compileContractCommand(document);
}

function applyDecorations() {
    if (!activeEditor) return;
    mod_deco.decorateWords(activeEditor, DECORATION_PATTERNS.warning, mod_deco.styles.foreGroundWarning);
    mod_deco.decorateWords(activeEditor, DECORATION_PATTERNS.info, mod_deco.styles.foreGroundInfoUnderline);
    mod_deco.decorateWords(activeEditor, DECORATION_PATTERNS.safe, mod_deco.styles.foreGroundOk);
    mod_deco.decorateWords(activeEditor, DECORATION_PATTERNS.events, mod_deco.styles.foreGroundNewEmit);
    mod_deco.decorateWords(activeEditor, DECORATION_PATTERNS.special, mod_deco.styles.boldUnderline);
}

async function onDidChange(_event) {
    if (!vscode.window.activeTextEditor) return;
    if (vscode.window.activeTextEditor.document.languageId !== settings.LANGUAGE_ID) return;
    if (settings.extensionConfig().decoration.enable) applyDecorations();
}

function onInitModules(context, type) {
    mod_hover.init(context, type);
    mod_compile.init(context, type);
    mod_formatter.init(context, type);
}

function registerDocType(context, type) {
    vscode.languages.setLanguageConfiguration(type, {
        onEnterRules: [{
            beforeText: /^\s*(?:struct|enum|flag|event|interface|def|class|for|if|elif|else).*?:\s*$/,
            action: { indentAction: vscode.IndentAction.Indent }
        }]
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('vyper.compileContract', mod_compile.compileContractCommand)
    );

    if (!settings.extensionConfig().mode.active) {
        console.log('Extension entering passive mode.');
        return;
    }

    onInitModules(context, type);
    onDidChange();
    if (activeEditor && activeEditor.document) onDidSave(activeEditor.document);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            activeEditor = editor;
            if (editor) onDidChange();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (activeEditor && event.document === activeEditor.document) onDidChange(event);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => onDidSave(document))
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => onDidSave(document))
    );
}

function onActivate(context) {
    activeEditor = vscode.window.activeTextEditor;
    registerDocType(context, settings.LANGUAGE_ID);
}

function onDeactivate() {}

module.exports = {
    activate: onActivate,
    deactivate: onDeactivate
};
