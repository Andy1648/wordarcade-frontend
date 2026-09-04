// eslint.config.js — flat config (ESLint 8.57 auto-detects this file).
//
// Deliberately MINIMAL and correctness-only. The point is a clean, readable
// signal for NEW code, not a repo-wide cleanup: this does NOT pull in the full
// react/recommended or stylistic rule sets, and the noisy broad rules that the
// existing codebase already trips are set to `warn` (not `error`) so a real
// new-code error is never buried under pre-existing warnings.
//
// Scope: `src/` only (the lint script runs `eslint src`); build output is also
// explicitly ignored here as belt-and-suspenders in case someone runs `eslint .`.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'dist/**',
      'dist-ssr/**',
      'dist-portal/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      // Teach ESLint that JSX *uses* identifiers, so components referenced only
      // in markup aren't falsely reported as unused. (These two rules are the
      // only reason eslint-plugin-react is loaded — we don't want its noisy
      // recommended set.)
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',

      // rules-of-hooks is BUILD-FAILING everywhere. The hooks-after-early-return
      // class (React #310) that white-screened Word Bomb on turn_update is fixed
      // and the baseline is 0 violations (verified), so this rule can never be
      // reintroduced without failing the build. Do NOT downgrade this to `warn`.
      'react-hooks/rules-of-hooks': 'error',

      // Rules the EXISTING code still trips: kept ON as a signal but at `warn`
      // so the baseline stays green (0 errors) and a genuine new-code error is
      // never buried. Not a license to write new violations — the src/satRush
      // override below restores them to `error` for the new mode's code.
      'react-hooks/exhaustive-deps': 'warn',
      'no-irregular-whitespace': 'warn', // 2 pre-existing (Homepage, SplashScreen)
      'no-unused-vars': 'warn', // ~11 pre-existing across src
    },
  },
  {
    // New code (SAT RUSH) is held to the strict bar: the same correctness
    // rules that are `warn` globally (for legacy's sake) are `error` here, so
    // Steps 2-7 get the clean, failing signal the rest of the repo can't yet.
    files: ['src/satRush/**/*.{js,jsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'no-irregular-whitespace': 'error',
      'no-unused-vars': 'error',
    },
  },
];
