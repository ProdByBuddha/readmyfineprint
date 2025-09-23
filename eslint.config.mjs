import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  // Global ignores
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
      'coverage/**'
    ]
  },
  js.configs.recommended,
  // Client-side React/TypeScript configuration
  {
    files: ['client/src/**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        TouchEvent: 'readonly',
        boolean: 'readonly',
        string: 'readonly',
        number: 'readonly',
        React: 'readonly',
        JSX: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        crypto: 'readonly',
        navigator: 'readonly',
        Image: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        AbortController: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        NodeJS: 'readonly',
        btoa: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react': react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...(tseslint?.configs?.recommended?.rules || {}),
      ...(react?.configs?.recommended?.rules || {}),
      ...(reactHooks?.configs?.recommended?.rules || {}),
      ...(jsxA11y?.configs?.recommended?.rules || {}),

      // Override some TypeScript rules to be warnings instead of errors
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',

      // Basic rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Turned off in favor of @typescript-eslint/no-unused-vars
      'no-undef': 'error',

      // React rules adjustments
      'react/prop-types': 'off', // TypeScript handles prop validation
      'react/no-unescaped-entities': 'warn',
      'react/no-unknown-property': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // Accessibility rules (relaxed for deployment)
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      'jsx-a11y/heading-has-content': 'warn',
      'jsx-a11y/html-has-lang': 'warn',
      'jsx-a11y/iframe-has-title': 'warn',
      'jsx-a11y/img-redundant-alt': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-redundant-roles': 'warn',
      'jsx-a11y/tabindex-no-positive': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'warn'
    }
  },
  // Server-side TypeScript configuration
  {
    files: ['server/**/*.ts', 'scripts/**/*.ts', 'shared/**/*.ts', 'types/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.eslint.json'
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        crypto: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        AbortController: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...(tseslint?.configs?.recommended?.rules || {}),
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off', // Allow console in server code
      'no-debugger': 'error',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-case-declarations': 'off',
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn'
    }
  },
  {
    files: [
      'server/**/*.js',
      'scripts/**/*.{js,cjs,mjs}',
      'send-test-error*.{js,cjs}',
      'build-script.js',
      'minimal-build.js',
      'production-build.js',
      'dev-server.js'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        allowHashBang: true
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        AbortController: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-debugger': 'error',
      'no-unused-vars': 'warn',
      'no-undef': 'warn'
    }
  },
  {
    files: [
      'tests/**/*.{ts,tsx}',
      'test/**/*.ts'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.eslint.json'
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'warn'
    }
  },
  {
    files: [
      'tests/**/*.js',
      'test/**/*.js',
      'test-*.js'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'warn'
    }
  },
  // Configuration files
  {
    files: ['*.ts', '*.js', '*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'error'
    }
  }
];