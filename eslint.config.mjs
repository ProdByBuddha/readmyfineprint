
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
      'coverage/**'
    ]
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'no-case-declarations': 'off',
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn'
    }
  }
];
