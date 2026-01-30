'use strict';
/**
 * ESLint 9.x Flat Configuration
 *
 * This configuration uses the new ESLint flat config format introduced in v9.
 * It applies JavaScript recommended rules with customizations for VSCode extension development.
 */

const js = require('@eslint/js');

module.exports = [
    // Base JavaScript recommended rules
    js.configs.recommended,

    // Project-specific configuration
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                // Node.js globals
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                Promise: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly'
            }
        },
        rules: {
            // Enforce consistent code style
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'indent': ['error', 4, { SwitchCase: 1 }],
            'comma-dangle': ['error', 'never'],

            // Best practices
            'eqeqeq': ['error', 'always'],
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-var': 'error',
            'prefer-const': 'error',

            // Spacing and formatting
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
            'space-before-function-paren': ['error', {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'always'
            }],

            // VSCode extension specific
            'no-console': 'off' // Console logging is useful for extension debugging
        }
    },

    // Ignore patterns
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            '.venv/**',
            'venv/**',
            '**/*.min.js'
        ]
    }
];
