import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectSourceViolations,
  isValidWhenExpression,
} from './check-plugin-context-boundaries.mjs';

test('accepts supported when expressions', () => {
  assert.equal(isValidWhenExpression('editorFocused'), true);
  assert.equal(isValidWhenExpression('!inputFocused'), true);
  assert.equal(isValidWhenExpression('editorFocused && !inputFocused'), true);
});

test('rejects unsupported when expressions', () => {
  assert.equal(isValidWhenExpression('editorFocused || inputFocused'), false);
  assert.equal(isValidWhenExpression('(editorFocused)'), false);
  assert.equal(isValidWhenExpression('editorFocused && '), false);
});

test('flags direct bridge service reads from pluginContext', () => {
  const violations = collectSourceViolations(`
    const filesystem = context.environment.pluginContext?.filesystem;
    const persistence = pluginContext?.persistence;
  `, 'sample.ts');

  assert.deepEqual(
    violations.map((violation) => violation.symbol),
    ['pluginContext.filesystem', 'pluginContext.persistence'],
  );
});

test('flags unsupported when string literals in contributions', () => {
  const violations = collectSourceViolations(`
    const item = { when: 'editorFocused || inputFocused' };
    const action = { enabledWhen: '(editorFocused)' };
  `, 'sample.ts');

  assert.deepEqual(
    violations.map((violation) => violation.symbol),
    [
      'when expression "editorFocused || inputFocused"',
      'enabledWhen expression "(editorFocused)"',
    ],
  );
});

test('does not flag grouped accessor usage or supported when literals', () => {
  const violations = collectSourceViolations(`
    import { getPluginStorageAccess } from '@shenbi/editor-plugin-api';
    const filesystem = pluginContext ? getPluginStorageAccess(pluginContext).filesystem : undefined;
    const item = { when: 'editorFocused && !inputFocused' };
  `, 'sample.ts');

  assert.deepEqual(violations, []);
});
