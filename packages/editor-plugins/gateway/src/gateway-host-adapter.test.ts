import { describe, expect, it, vi } from 'vitest';
import { createGatewayHostAdapter } from './gateway-host-adapter';

describe('createGatewayHostAdapter', () => {
  it('bridges the active file to plugin filesystem services', async () => {
    const readFile = vi.fn(async () => ({ type: 'api-gateway', nodes: [], edges: [] }));
    const writeFile = vi.fn(async () => undefined);
    const notifyError = vi.fn();
    const adapter = createGatewayHostAdapter({
      file: {
        id: 'api-1',
        name: 'billing.api.json',
      },
      surface: {},
      environment: {
        pluginContext: {
          filesystem: {
            createFile: vi.fn(async () => 'api-1'),
            readFile,
            writeFile,
          },
          notifications: {
            error: notifyError,
          },
        },
      },
      canvasHost: {
        selection: {},
        editing: {},
        overlay: {},
        interaction: {},
      },
    });

    expect(adapter).toBeDefined();
    expect(adapter?.fileName).toBe('billing');
    await adapter?.loadDocument();
    expect(readFile).toHaveBeenCalledWith('api-1');
    await adapter?.saveDocument({
      id: 'api-1',
      name: 'billing',
      type: 'api-gateway',
      nodes: [],
      edges: [],
    });
    expect(writeFile).toHaveBeenCalledWith('api-1', {
      id: 'api-1',
      name: 'billing',
      type: 'api-gateway',
      nodes: [],
      edges: [],
    });
    adapter?.notifyError('boom');
    expect(notifyError).toHaveBeenCalledWith('boom');
  });
});
