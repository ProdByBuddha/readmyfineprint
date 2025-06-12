#!/usr/bin/env node

/**
 * Simple accessibility testing script
 * Verifies that key accessibility features are implemented
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientSrcPath = path.join(__dirname, '..', 'client', 'src');

function checkFile(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let passed = true;

  checks.forEach(check => {
    if (check.test(content)) {
      console.log(`✅ ${check.description}`);
    } else {
      console.error(`❌ ${check.description}`);
      passed = false;
    }
  });

  return passed;
}

console.log('🧪 Testing Accessibility Features...\n');

// Test 1: Check if accessibility hooks exist
console.log('📋 Testing Accessibility Hooks:');
const hooksChecks = [
  {
    description: 'useAccessibility hook has announce function',
    test: content => content.includes('announce') && content.includes('useCallback')
  },
  {
    description: 'useReducedMotion hook exists',
    test: content => content.includes('useReducedMotion') && content.includes('prefers-reduced-motion')
  },
  {
    description: 'useFocusVisible hook exists',
    test: content => content.includes('useFocusVisible') && content.includes('focus-visible')
  }
];

checkFile(path.join(clientSrcPath, 'hooks', 'useAccessibility.ts'), hooksChecks);

// Test 2: Check CSS accessibility features
console.log('\n📋 Testing CSS Accessibility:');
const cssChecks = [
  {
    description: 'Screen reader only class exists',
    test: content => content.includes('.sr-only') && content.includes('position: absolute')
  },
  {
    description: 'Skip links styles exist',
    test: content => content.includes('.skip-link')
  },
  {
    description: 'Reduced motion support exists',
    test: content => content.includes('prefers-reduced-motion: reduce')
  },
  {
    description: 'Focus visible styles exist',
    test: content => content.includes('focus-visible') || content.includes('focus:')
  }
];

checkFile(path.join(clientSrcPath, 'index.css'), cssChecks);

// Test 3: Check component accessibility
console.log('\n📋 Testing Component Accessibility:');
const componentChecks = [
  {
    description: 'Skip links component exists',
    test: content => content.includes('skip-link') && content.includes('aria-label')
  }
];

checkFile(path.join(clientSrcPath, 'components', 'SkipLinks.tsx'), componentChecks);

// Test 4: Check App.tsx has accessibility features
console.log('\n📋 Testing App Component:');
const appChecks = [
  {
    description: 'App has skip links',
    test: content => content.includes('SkipLinks')
  },
  {
    description: 'App has live region for announcements',
    test: content => content.includes('aria-live') && content.includes('announcements')
  },
  {
    description: 'Main content has proper semantics',
    test: content => content.includes('role="main"') || content.includes('<main')
  }
];

checkFile(path.join(clientSrcPath, 'App.tsx'), appChecks);

// Test 5: Check Button component has accessibility features
console.log('\n📋 Testing Button Component:');
const buttonChecks = [
  {
    description: 'Button has aria-disabled support',
    test: content => content.includes('aria-disabled')
  },
  {
    description: 'Button has aria-busy support',
    test: content => content.includes('aria-busy')
  },
  {
    description: 'Button has loading state',
    test: content => content.includes('loading') && content.includes('aria-hidden')
  }
];

checkFile(path.join(clientSrcPath, 'components', 'ui', 'button.tsx'), buttonChecks);

console.log('\n🎉 Accessibility testing complete!');
console.log('\n📚 For more detailed testing, consider:');
console.log('   • Manual keyboard navigation testing');
console.log('   • Screen reader testing (NVDA, JAWS, VoiceOver)');
console.log('   • Browser accessibility dev tools');
console.log('   • Automated tools like axe-core or Lighthouse'); 