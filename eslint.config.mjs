// Errors = correctness only (blocking in CI). Style is Prettier's job, smells and metrics are warnings.
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// SonarJS flags smells and suspicious code; as warnings, errors stay reserved for correctness.
const sonarjsWarnings = Object.fromEntries(
  Object.entries(sonarjs.configs.recommended.rules)
    .filter(([, level]) => level !== 'off')
    .map(([rule]) => [rule, 'warn']),
);

export default defineConfig(
  { ignores: ['dist/**', 'dev-dist/**', 'android/**', 'release/**', 'node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: { allowDefaultProject: ['capacitor.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { sonarjs, 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      // React ignores what an event handler returns, so async onClick handlers are fine there
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // warn/error report real failures in the browser console; plain logging stays out of shipped code
      'no-console': ['error', { allow: ['warn', 'error'] }],
      ...sonarjsWarnings,
      'sonarjs/cognitive-complexity': ['warn', 15],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  prettier,
);
