# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build**: `npm run compile` or `npm run compile-web` (uses webpack)
- **Watch**: `npm run watch` (rebuilds on change)
- **Test**: `npm test` (runs web extension tests in headless Chromium)
- **Lint**: `npm run lint` (ESLint)
- **Format**: `npm run format` (Prettier)
- **Package**: `npm run package` (production build)
- **Update Grammar**: `npm run fetchGrammar` (runs `scripts/fetch_vyper_language_spec.py` to regenerate `syntaxes/vyper.tmLanguage.json`)
- **Install Dependencies**: `npm install` (requires Node.js)
- **Vyper Requirement**: `pip3 install vyper` (required for compilation features)

## Architecture

This is a VS Code extension for the Vyper smart contract language, designed to run in both desktop and web environments.

- **Entry Point**: `src/extension.js` (common logic) and `src/extension.web.js`.
- **Core Logic**: `src/features/` contains the implementation of extension capabilities:
  - `compile.js`: Handles interactions with the Vyper compiler (CLI execution).
  - `formatter.js`: Provides document formatting (built-in JS-based or external command).
  - `deco.js`: Handles security-augmented syntax decorations (active mode).
  - `hover/`: logic for hover tooltips.
- **Syntax Highlighting**: Defined in `syntaxes/vyper.tmLanguage.json`. This file is generated via python script in `scripts/`.
- **Settings**: Configuration logic is centralized in `src/settings.js`.

### Key Concepts
- **Active vs Passive Mode**: The extension has an "active" mode (enabled by default) that provides features like compilation and security decorations. "Passive" mode is limited to syntax highlighting.
- **Compiler Integration**: attempts to auto-detect `vyper` in common virtualenv paths or uses the configured command.
- **Decorations**: Uses regex patterns in `extension.js` -> `deco.js` to highlight security-relevant keywords (e.g., `external`, `payable`, `selfdestruct`).

## Development Guidelines

- **Module System**: Uses CommonJS (`require`/`module.exports`).
- **Formatting**: Code should be formatted with Prettier (`npm run format`).
- **Linting**: Ensure code passes ESLint (`npm run lint`).
- **Security**: When reading files or executing external commands (like the compiler), ensure paths are sanitized and commands are executed safely.
- **Grammar**: Do not edit `syntaxes/vyper.tmLanguage.json` directly if possible; modify the generation script or the source it pulls from if applicable.
