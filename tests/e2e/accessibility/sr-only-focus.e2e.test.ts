import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss, { AtRule, Rule } from 'postcss';

const cssFile = path.resolve(__dirname, '../../../client/src/index.css');
const focusSelectors = [
  '.focus\\:not-sr-only:focus',
  '.focus-visible\\:not-sr-only:focus-visible',
  '.focus-within\\:not-sr-only:focus-within'
];

let utilitiesLayer: AtRule | undefined;
let srOnlyIndex = -1;
let focusRuleIndex = -1;
let focusRule: Rule | undefined;

beforeAll(async () => {
  const css = await readFile(cssFile, 'utf8');
  const root = postcss.parse(css);
  let order = 0;

  root.walkRules((rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule') {
      const layer = parent as AtRule;
      if (layer.params.trim() === 'utilities') {
        if (!utilitiesLayer) {
          utilitiesLayer = layer;
        }

        if (rule.selector === '.sr-only') {
          srOnlyIndex = order;
        }

        const selectors = (rule as Rule).selectors || [];
        if (focusSelectors.every((selector) => selectors.includes(selector))) {
          focusRule = rule;
          focusRuleIndex = order;
        }

        order += 1;
      }
    }
  });
});

describe('sr-only focus restoration', () => {
  it('declares focus override after the sr-only rule', () => {
    expect(utilitiesLayer, 'utilities layer should exist in index.css').toBeDefined();
    expect(srOnlyIndex, 'sr-only utility should be detected').toBeGreaterThanOrEqual(0);
    expect(focusRuleIndex, 'focus override rule should be detected').toBeGreaterThanOrEqual(0);
    expect(focusRuleIndex, 'focus override must come after sr-only rule').toBeGreaterThan(srOnlyIndex);
  });

  it('restores visibility-related properties when focus is applied', () => {
    expect(focusRule, 'focus override rule should exist').toBeDefined();

    const declarations = new Map<string, string>();
    focusRule?.walkDecls((decl) => {
      declarations.set(decl.prop, decl.value);
    });

    expect(declarations.get('position')).toBe('static');
    expect(declarations.get('width')).toBe('auto');
    expect(declarations.get('height')).toBe('auto');
    expect(declarations.get('padding')).toBe('inherit');
    expect(declarations.get('margin')).toBe('inherit');
    expect(declarations.get('overflow')).toBe('visible');
    expect(declarations.get('clip')).toBe('auto');
    expect(declarations.get('white-space')).toBe('normal');
  });

  it('uses all focus selector variants to support keyboard visibility', () => {
    const selectors = focusRule?.selectors || [];
    expect(new Set(selectors)).toEqual(new Set(focusSelectors));
  });
});
