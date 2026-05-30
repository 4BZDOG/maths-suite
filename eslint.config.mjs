// ESLint flat config (eslint >= 9).
// Goal: catch real bugs (unused vars, undef refs, broken control flow) without
// fighting style. We keep the rule set deliberately small.
import globals from 'globals';

export default [
    {
        files: ['**/*.js', '**/*.mjs'],
        ignores: ['bundle.js', 'node_modules/**', 'stripe-worker/node_modules/**'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType:  'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                // jsPDF globals injected via the CDN script:
                jsPDF: 'readonly',
                jspdf: 'readonly',
                // KaTeX globals from the CDN:
                katex:        'readonly',
                renderMathInElement: 'readonly',
            },
        },
        rules: {
            // Real-bug rules — high signal, low style noise.
            'no-undef':                   'error',
            'no-unused-vars': ['warn', {
                args: 'none', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
            }],
            'no-redeclare':               'error',
            'no-unreachable':             'error',
            'no-const-assign':            'error',
            'no-dupe-keys':               'error',
            'no-dupe-args':                'error',
            'no-dupe-else-if':             'error',
            'no-self-assign':              'error',
            'no-empty':         ['error', { allowEmptyCatch: true }],
            'no-cond-assign':              'error',
            'no-constant-condition': ['error', { checkLoops: false }],
            'use-isnan':                   'error',
            'valid-typeof':                'error',
            'no-invalid-regexp':           'error',
            // Allow U+202F (narrow no-break space) — deliberately used in
            // diagram labels for typographic spacing between number and unit.
            'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
            'no-misleading-character-class': 'error',
            'no-control-regex':            'off',     // we use \x01/\x02 sentinels in pdfExport
            'no-prototype-builtins':       'off',
        },
    },
    // Stripe Worker runs in the Cloudflare Workers runtime, not the browser.
    {
        files: ['stripe-worker/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.worker,
                ...globals.node,
                crypto: 'readonly', fetch: 'readonly',
                Response: 'readonly', Request: 'readonly', URL: 'readonly',
                URLSearchParams: 'readonly', btoa: 'readonly', atob: 'readonly',
                TextEncoder: 'readonly', TextDecoder: 'readonly',
            },
        },
    },
    // Test files use node:test, no DOM.
    {
        files: ['test/**/*.mjs'],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
];
