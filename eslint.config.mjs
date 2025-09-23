import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '.pythonlibs/**',
      'node_modules/**',
      'dist/**',
      '.next/**',
      'ZAP_2.16.1/**',
      '**/*.py',
      '**/*.jar',
      '**/*.so',
      '**/*.dll',
      '**/*.dylib',
      'public/**',
      'scripts/local-llm-server.py',
      'scripts/*.cjs',
      'scripts/fix-linter-warnings.mjs',
      'scripts/migrate-to-argon2.js',
      'server/start.js',
      'tailwind.config.ts',
      'vite.config.ts',
      'postcss.config.js',
      'coverage/**',
      'build-script.js',
      'send-test-error.js',
      'send-test-error-api.cjs',
      'send-test-error.cjs',
      'test-*.js',
      '*.test.js'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        btoa: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: react,
      'react-hooks': reactHooks
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],
      'no-undef': 'off',
      'no-case-declarations': 'off',
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['server/**/*.{ts,tsx,js}', 'scripts/**/*.{ts,js}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['client/src/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unescaped-entities': 'off',
      'jsx-a11y/label-has-associated-control': 'off'
    }
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['build-script.js', 'scripts/*.cjs', '*.cjs', 'send-test-*.js', '*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off'
    }
  }
];