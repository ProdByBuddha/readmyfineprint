import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['client/src/**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      // Basic accessibility rules that can be enforced without plugins
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'warn'
    }
  }
]; 