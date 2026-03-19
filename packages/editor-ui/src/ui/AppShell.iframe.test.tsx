import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  it('会把画布内容挂载到 iframe 文档内，并保留节点点击选中能力', async () => {
    const onCanvasSelectNode = vi.fn();
    const view = render(
      <AppShell renderMode="iframe" onCanvasSelectNode={onCanvasSelectNode}>
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
    fireEvent.click(node as Element);

    expect(onCanvasSelectNode).toHaveBeenCalledWith('node-1');
  });

  it('点击 iframe 画布空白区域时会触发取消选中', async () => {
    const onCanvasDeselectNode = vi.fn();
    const view = render(
      <AppShell renderMode="iframe" onCanvasDeselectNode={onCanvasDeselectNode}>
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
    fireEvent.click(iframeRoot as Element);
    expect(onCanvasDeselectNode).toHaveBeenCalledTimes(1);
  });
});
