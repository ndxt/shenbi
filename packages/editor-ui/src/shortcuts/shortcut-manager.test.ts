import { describe, expect, it } from 'vitest';
import {
  evaluateShortcutWhen,
  findMatchingShortcut,
  getShortcutEventContext,
  type ShortcutRuntimeContext,
} from './shortcut-manager';

function createContext(overrides: Partial<ShortcutRuntimeContext> = {}): ShortcutRuntimeContext {
  return {
    editorFocused: true,
    sidebarVisible: true,
    inspectorVisible: true,
    hasSelection: true,
    inputFocused: false,
    ...overrides,
  };
}

describe('evaluateShortcutWhen', () => {
  it('支持变量名与 && 组合', () => {
    expect(evaluateShortcutWhen('editorFocused && hasSelection', createContext())).toBe(true);
    expect(evaluateShortcutWhen('editorFocused && hasSelection', createContext({ hasSelection: false }))).toBe(false);
  });

  it('支持单变量取反', () => {
    expect(evaluateShortcutWhen('!inputFocused', createContext())).toBe(true);
    expect(evaluateShortcutWhen('!inputFocused', createContext({ inputFocused: true }))).toBe(false);
  });

  it('inputFocused 时默认屏蔽无 when 的快捷键', () => {
    expect(evaluateShortcutWhen(undefined, createContext({ inputFocused: true }))).toBe(false);
    expect(evaluateShortcutWhen('inputFocused', createContext({ inputFocused: true }))).toBe(true);
  });
});

describe('findMatchingShortcut', () => {
  it('按 priority 选择冲突快捷键', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const shortcut = findMatchingShortcut(
      [
        { id: 'save.low', commandId: 'file.saveSchema', keybinding: 'Mod+S', priority: 1 },
        { id: 'save.high', commandId: 'commandPalette.open', keybinding: 'Mod+S', priority: 10 },
      ],
      event,
      createContext(),
    );

    expect(shortcut?.id).toBe('save.high');
  });

  it('相同 priority 时取先注册者', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const shortcut = findMatchingShortcut(
      [
        { id: 'save.first', commandId: 'file.saveSchema', keybinding: 'Mod+S', priority: 1 },
        { id: 'save.second', commandId: 'commandPalette.open', keybinding: 'Mod+S', priority: 1 },
      ],
      event,
      createContext(),
    );

    expect(shortcut?.id).toBe('save.first');
  });
});

describe('getShortcutEventContext', () => {
  it('从焦点元素推导 inputFocused', () => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    root.appendChild(input);
    document.body.appendChild(root);
    input.focus();

    const context = getShortcutEventContext(input, root, {
      sidebarVisible: true,
      inspectorVisible: true,
      hasSelection: false,
    });

    expect(context.inputFocused).toBe(true);
    expect(context.editorFocused).toBe(true);

    document.body.removeChild(root);
  });
});
