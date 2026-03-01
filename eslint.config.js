import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-template': 'warn',
      'no-throw-literal': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.astro/**', '**/.turbo/**'],
  },
);
