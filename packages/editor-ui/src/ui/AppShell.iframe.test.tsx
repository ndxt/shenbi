import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';

vi.mock('../canvas/iframe-pool', () => {
  function createMockIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    const iframeDocument = document.implementation.createHTMLDocument('shenbi-iframe');
    const rootElement = iframeDocument.createElement('div');
    rootElement.id = 'shenbi-iframe-root';
    iframeDocument.body.appendChild(rootElement);
    Object.defineProperty(iframeDocument, 'defaultView', {
      configurable: true,
      value: window,
    });

    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: iframeDocument,
    });
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    });
    Object.defineProperty(iframe, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 0,
        left: 0,
        right: 1200,
        bottom: 800,
        width: 1200,
        height: 800,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });

    return iframe;
  }

  return {
    acquireIframeFromPool: vi.fn(async () => createMockIframe()),
    disposePooledIframe: vi.fn((iframe: HTMLIFrameElement | null | undefined) => iframe?.remove()),
  };
});

import { AppShell as RawAppShell } from './AppShell';

type AppShellProps = Omit<React.ComponentProps<typeof RawAppShell>, 'workspaceId'> & {
  workspaceId?: string;
};

function AppShell(props: AppShellProps) {
  return <RawAppShell {...props} workspaceId={props.workspaceId ?? 'test-workspace'} />;
}

describe('AppShell iframe canvas mode', () => {
  it('会把画布内容挂载到 iframe 文档内，并同步为像素高度', async () => {
    const view = render(
      <AppShell renderMode="iframe">
        <div data-shenbi-node-id="node-1">Iframe Node</div>
      </AppShell>,
    );

    await waitFor(() => {
      const iframe = view.container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.contentDocument?.getElementById('shenbi-iframe-root')?.textContent).toContain('Iframe Node');
    });

    const iframe = view.container.querySelector('iframe');
    const iframeRoot = iframe?.contentDocument?.getElementById('shenbi-iframe-root');
    const node = iframeRoot?.querySelector('[data-shenbi-node-id="node-1"]');
    expect(node).not.toBeNull();
    expect(iframe?.style.height).toMatch(/px$/);
  });

  it('iframe 模式下宿主层仍会保留 selection overlay', async () => {
    const view = render(
      <AppShell renderMode="iframe" selectedNodeSchemaId="node-1">
        <div data-shenbi-node-id="node-1" data-shenbi-component-type="Card">Iframe Node</div>
      </AppShell>,
    );

    await waitFor(() => {
      const iframe = view.container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.contentDocument?.getElementById('shenbi-iframe-root')?.textContent).toContain('Iframe Node');
    });

    const iframe = view.container.querySelector('iframe');
    const iframeNode = iframe?.contentDocument?.querySelector('[data-shenbi-node-id="node-1"]');
    Object.defineProperty(iframeNode ?? {}, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 96,
        left: 128,
        right: 288,
        bottom: 180,
        width: 160,
        height: 84,
        x: 128,
        y: 96,
        toJSON: () => undefined,
      }),
    });
    fireEvent(window, new Event('resize'));
    expect(iframe?.contentDocument?.getElementById('shenbi-iframe-root')?.textContent).toContain('Iframe Node');
    expect(view.container.querySelector('.selection-overlay')).not.toBeNull();
  });

  it('iframe 模式下点击节点选中，点击空白取消选中', async () => {
    const onCanvasSelectNode = vi.fn();
    const onCanvasDeselectNode = vi.fn();
    const view = render(
      <AppShell
        renderMode="iframe"
        onCanvasSelectNode={onCanvasSelectNode}
        onCanvasDeselectNode={onCanvasDeselectNode}
      >
        <div data-shenbi-node-id="node-1">Iframe Node</div>
      </AppShell>,
    );

    await waitFor(() => {
      const iframe = view.container.querySelector('iframe');
      expect(iframe?.contentDocument?.getElementById('shenbi-iframe-root')?.textContent).toContain('Iframe Node');
    });

    const iframe = view.container.querySelector('iframe');
    const iframeNode = iframe?.contentDocument?.querySelector('[data-shenbi-node-id="node-1"]');
    expect(iframeNode).not.toBeNull();

    fireEvent.click(iframeNode as Element);
    expect(onCanvasSelectNode).toHaveBeenCalledWith('node-1');

    fireEvent.click(iframe?.contentDocument?.body as HTMLBodyElement);
    expect(onCanvasDeselectNode).toHaveBeenCalled();
  });

  it('iframe 模式下宿主 action 条点击不会误触发取消选中', async () => {
    const duplicateExecute = vi.fn();
    const onCanvasDeselectNode = vi.fn();
    const view = render(
      <AppShell
        renderMode="iframe"
        selectedNodeSchemaId="node-1"
        selectedNodeTreeId="body.0"
        canDuplicateSelectedNode
        canDeleteSelectedNode
        onCanvasDeselectNode={onCanvasDeselectNode}
        pluginContext={{
          selection: {
            getSelectedNodeId: () => 'body.0',
          },
        }}
        plugins={[
          defineEditorPlugin({
            id: 'plugin.canvas-actions',
            name: 'Canvas Actions',
            contributes: {
              commands: [
                { id: 'canvas.duplicateSelectedNode', title: 'Duplicate', execute: duplicateExecute },
                { id: 'canvas.moveSelectedNodeUp', title: 'Move Up', enabledWhen: 'canCanvasMoveSelectionUp', execute: () => undefined },
                { id: 'canvas.moveSelectedNodeDown', title: 'Move Down', enabledWhen: 'canCanvasMoveSelectionDown', execute: () => undefined },
                { id: 'canvas.deleteSelectedNode', title: 'Delete', enabledWhen: 'canCanvasDeleteSelection', execute: () => undefined },
              ],
            },
          }),
        ]}
      >
        <div data-shenbi-node-id="node-1" data-shenbi-component-type="Card">Iframe Node</div>
      </AppShell>,
    );

    await waitFor(() => {
      const iframe = view.container.querySelector('iframe');
      expect(iframe?.contentDocument?.getElementById('shenbi-iframe-root')?.textContent).toContain('Iframe Node');
    });

    const iframe = view.container.querySelector('iframe');
    const iframeNode = iframe?.contentDocument?.querySelector('[data-shenbi-node-id="node-1"]');
    Object.defineProperty(iframeNode ?? {}, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 72,
        left: 96,
        right: 256,
        bottom: 144,
        width: 160,
        height: 72,
        x: 96,
        y: 72,
        toJSON: () => undefined,
      }),
    });
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: 'Selected Node Actions' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Duplicate'));
    expect(duplicateExecute).toHaveBeenCalled();
    expect(onCanvasDeselectNode).not.toHaveBeenCalled();
  });

  it('iframe 模式下支持通过 Ctrl 滚轮缩放画布', async () => {
    const view = render(
      <AppShell renderMode="iframe">
        <div data-shenbi-node-id="node-1">Iframe Node</div>
      </AppShell>,
    );

    await waitFor(() => {
      const iframe = view.container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.contentDocument?.getElementById('shenbi-iframe-root')?.textContent).toContain('Iframe Node');
    });

    const zoomButton = view.container.querySelector('.canvas-zoom-hud__scale') as HTMLButtonElement | null;
    expect(zoomButton?.textContent).toBe('100%');

    const iframe = view.container.querySelector('iframe');
    fireEvent.wheel(iframe?.contentDocument as Document, {
      ctrlKey: true,
      deltaY: -120,
      clientX: 320,
      clientY: 240,
    });

    await waitFor(() => {
      expect(zoomButton?.textContent).not.toBe('100%');
    });
  });

});
