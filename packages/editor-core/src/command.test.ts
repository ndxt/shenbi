import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { CommandManager } from './command';
import { EditorState } from './editor-state';
import { EventBus } from './event-bus';
import { History } from './history';
import type { EditorEventMap, EditorStateSnapshot } from './types';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

function createFixture() {
  const state = new EditorState(createSchema('initial'));
  const history = new History<EditorStateSnapshot>(state.getSnapshot());
  const eventBus = new EventBus<EditorEventMap>();
  const commands = new CommandManager(state, history, eventBus);
  return { state, history, eventBus, commands };
}

describe('CommandManager', () => {
  it('registers and executes command', async () => {
    const { state, commands } = createFixture();
    commands.register({
      id: 'schema.setA',
      label: 'Set A',
      execute(currentState) {
        currentState.setSchema(createSchema('A'));
      },
    });

    await commands.execute('schema.setA');
    expect(state.getSchema().name).toBe('A');
  });

  it('throws when command does not exist', async () => {
    const { commands } = createFixture();
    await expect(commands.execute('missing')).rejects.toThrow('Command not found');
  });

  it('skips execution when canExecute returns false', async () => {
    const { state, commands, history } = createFixture();
    const run = vi.fn();
    commands.register({
      id: 'blocked',
      label: 'Blocked',
      canExecute: () => false,
      execute() {
        run();
      },
    });

    await commands.execute('blocked');
    expect(run).not.toHaveBeenCalled();
    expect(state.getSchema().name).toBe('initial');
    expect(history.canUndo()).toBe(false);
  });

  it('does not push history when command throws', async () => {
    const { commands, history } = createFixture();
    commands.register({
      id: 'boom',
      label: 'Boom',
      execute() {
        throw new Error('boom');
      },
    });

    await expect(commands.execute('boom')).rejects.toThrow('boom');
    expect(history.canUndo()).toBe(false);
  });

  it('records snapshot only once for nested command execution', async () => {
    const { state, commands, history } = createFixture();

    commands.register({
      id: 'schema.replace',
      label: 'Replace',
      execute(currentState, args) {
        const schema = args as PageSchema;
        currentState.setSchema(schema);
      },
    });

    commands.register({
      id: 'file.openSchema',
      label: 'Open',
      async execute(_currentState) {
        await commands.execute('schema.replace', createSchema('opened'));
      },
    });

    await commands.execute('file.openSchema');
    expect(state.getSchema().name).toBe('opened');
    expect(history.canUndo()).toBe(true);
    expect(history.getSize()).toBe(1);
    const previous = history.undo();
    expect(previous?.schema.name).toBe('initial');
  });

  it('emits command:executed on success', async () => {
    const { commands, eventBus } = createFixture();
    const executed = vi.fn();
    eventBus.on('command:executed', executed);
    commands.register({
      id: 'noop',
      label: 'Noop',
      execute() {
        return;
      },
    });

    await commands.execute('noop');
    expect(executed).toHaveBeenCalledWith({ commandId: 'noop' });
  });
});
