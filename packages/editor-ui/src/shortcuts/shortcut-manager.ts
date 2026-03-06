import type { PluginShortcutContribution } from '@shenbi/editor-plugin-api';

export interface ShortcutRuntimeContext {
  editorFocused: boolean;
  sidebarVisible: boolean;
  inspectorVisible: boolean;
  hasSelection: boolean;
  inputFocused: boolean;
}

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Mod'] as const;

interface ParsedKeybinding {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  mod: boolean;
  key?: string;
}

function normalizeKeyToken(token: string): string {
  if (token.length === 1) {
    return token.toUpperCase();
  }
  return token;
}

function normalizeKeybinding(keybinding: string): string {
  const tokens = keybinding
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean);
  const modifiers = MODIFIER_ORDER.filter((modifier) => tokens.includes(modifier));
  const key = tokens.find((token) => !MODIFIER_ORDER.includes(token as typeof MODIFIER_ORDER[number]));

  return [...modifiers, ...(key ? [normalizeKeyToken(key)] : [])].join('+');
}

function parseKeybinding(keybinding: string): ParsedKeybinding {
  const normalized = normalizeKeybinding(keybinding);
  const tokens = normalized.split('+').filter(Boolean);
  const key = tokens.find((token) => !MODIFIER_ORDER.includes(token as typeof MODIFIER_ORDER[number]));

  return {
    ctrl: tokens.includes('Ctrl'),
    alt: tokens.includes('Alt'),
    shift: tokens.includes('Shift'),
    mod: tokens.includes('Mod'),
    ...(key ? { key } : {}),
  };
}

function matchesKeybinding(binding: string, event: KeyboardEvent): boolean {
  const parsed = parseKeybinding(binding);
  const eventKey = normalizeKeyToken(event.key);
  const modPressed = event.metaKey || event.ctrlKey;

  if (parsed.key !== eventKey) {
    return false;
  }
  if (parsed.alt !== event.altKey) {
    return false;
  }
  if (parsed.shift !== event.shiftKey) {
    return false;
  }
  if (parsed.ctrl && !event.ctrlKey) {
    return false;
  }
  if (parsed.mod && !modPressed) {
    return false;
  }
  if (!parsed.ctrl && !parsed.mod && event.ctrlKey) {
    return false;
  }
  if (!parsed.mod && event.metaKey) {
    return false;
  }

  return true;
}

function evaluateWhenToken(token: string, context: ShortcutRuntimeContext): boolean {
  const isNegated = token.startsWith('!');
  const variableName = isNegated ? token.slice(1).trim() : token.trim();
  if (!variableName) {
    return false;
  }
  const value = context[variableName as keyof ShortcutRuntimeContext];
  if (typeof value !== 'boolean') {
    return false;
  }
  return isNegated ? !value : value;
}

export function evaluateShortcutWhen(
  when: string | undefined,
  context: ShortcutRuntimeContext,
): boolean {
  if (!when) {
    return !context.inputFocused;
  }

  const tokens = when
    .split('&&')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return !context.inputFocused;
  }

  const matched = tokens.every((token) => evaluateWhenToken(token, context));
  if (!matched) {
    return false;
  }

  if (!context.inputFocused) {
    return true;
  }

  return tokens.some((token) => token === 'inputFocused' || token === '!inputFocused');
}

export function getShortcutEventContext(
  eventTarget: EventTarget | null,
  rootElement: HTMLElement | null,
  context: Omit<ShortcutRuntimeContext, 'editorFocused' | 'inputFocused'>,
): ShortcutRuntimeContext {
  const activeElement = document.activeElement;
  const inputFocused = Boolean(
    activeElement
    && (
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLTextAreaElement
      || (activeElement instanceof HTMLElement && activeElement.isContentEditable)
    ),
  );
  const editorFocused = Boolean(
    rootElement
    && eventTarget instanceof Node
    && rootElement.contains(eventTarget),
  );

  return {
    ...context,
    editorFocused,
    inputFocused,
  };
}

export function findMatchingShortcut(
  shortcuts: readonly PluginShortcutContribution[],
  event: KeyboardEvent,
  context: ShortcutRuntimeContext,
): PluginShortcutContribution | undefined {
  return shortcuts
    .map((shortcut, index) => ({ shortcut, index }))
    .filter(({ shortcut }) => matchesKeybinding(shortcut.keybinding, event))
    .filter(({ shortcut }) => evaluateShortcutWhen(shortcut.when, context))
    .sort((left, right) => {
      const priorityGap = (right.shortcut.priority ?? 0) - (left.shortcut.priority ?? 0);
      if (priorityGap !== 0) {
        return priorityGap;
      }
      return left.index - right.index;
    })[0]?.shortcut;
}
