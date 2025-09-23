import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss, { AtRule, Rule } from 'postcss';

let utilitiesLayer: AtRule | undefined;
let srOnlyRule: Rule | undefined;

const cssFile = path.resolve(__dirname, '../../../client/src/index.css');

beforeAll(async () => {
  const css = await readFile(cssFile, 'utf8');
  const root = postcss.parse(css);

  root.walkRules((rule) => {
    if (!srOnlyRule && rule.selector === '.sr-only') {
      const parent = rule.parent;
      if (parent && parent.type === 'atrule') {
        const layer = parent as AtRule;
        if (layer.params.trim() === 'utilities') {
          utilitiesLayer = layer;
          srOnlyRule = rule;
        }
      }
    }
  });
});

describe('screen-reader utility declarations', () => {
  it('registers the sr-only helper inside the utilities layer', () => {
    expect(utilitiesLayer, 'utilities layer should exist in index.css').toBeDefined();
    expect(srOnlyRule, 'sr-only rule should be defined inside utilities layer').toBeDefined();
  });

  it('applies the full accessible hiding technique', () => {
    const declarations = new Map<string, string>();

    srOnlyRule?.walkDecls((decl) => {
      declarations.set(decl.prop, decl.value);
    });

    expect(declarations.get('position')).toBe('absolute');
    expect(declarations.get('width')).toBe('1px');
    expect(declarations.get('height')).toBe('1px');
    expect(declarations.get('padding')).toBe('0');
    expect(declarations.get('margin')).toBe('-1px');
    expect(declarations.get('overflow')).toBe('hidden');
    expect(declarations.get('clip')).toBe('rect(0, 0, 0, 0)');
    expect(declarations.get('white-space')).toBe('nowrap');
    expect(declarations.get('border')).toBe('0');
  });
});
