import React from 'react';
import ReactDOM from 'react-dom';
import type { CanvasSurfaceHandle } from './types';
import { acquireIframeFromPool, disposePooledIframe } from './iframe-pool';

interface CanvasSurfaceProps {
  mode: 'direct' | 'iframe';
  themeClassName?: string;
  children: React.ReactNode;
  pointerEventsDisabled?: boolean;
  onReady?: (surface: CanvasSurfaceHandle | null) => void;
}

function createDirectHandle(hostElement: HTMLElement): CanvasSurfaceHandle {
  return {
    mode: 'direct',
    hostElement,
    rootElement: hostElement,
    ownerWindow: hostElement.ownerDocument.defaultView,
    ownerDocument: hostElement.ownerDocument,
    getRelativeRect(target) {
      const targetRect = target.getBoundingClientRect();
      const hostRect = hostElement.getBoundingClientRect();
      return {
        top: targetRect.top - hostRect.top + hostElement.scrollTop,
        left: targetRect.left - hostRect.left + hostElement.scrollLeft,
        width: targetRect.width,
        height: targetRect.height,
      };
    },
    findNodeElement(nodeId) {
      return hostElement.querySelector(`[data-shenbi-node-id="${CSS.escape(nodeId)}"]`);
    },
    elementFromPoint(clientX, clientY) {
      return hostElement.ownerDocument.elementFromPoint(clientX, clientY);
    },
  };
}

function createIframeHandle(
  iframe: HTMLIFrameElement,
  rootElement: HTMLElement,
): CanvasSurfaceHandle {
  const contentDocument = iframe.contentDocument;
  const contentWindow = iframe.contentWindow;
  return {
    mode: 'iframe',
    hostElement: iframe,
    rootElement,
    ownerWindow: contentWindow,
    ownerDocument: contentDocument,
    getRelativeRect(target) {
      const frameRect = iframe.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      return {
        top: targetRect.top - frameRect.top,
        left: targetRect.left - frameRect.left,
        width: targetRect.width,
        height: targetRect.height,
      };
    },
    findNodeElement(nodeId) {
      return rootElement.querySelector(`[data-shenbi-node-id="${CSS.escape(nodeId)}"]`);
    },
    elementFromPoint(clientX, clientY) {
      const frameRect = iframe.getBoundingClientRect();
      if (
        clientX < frameRect.left
        || clientX > frameRect.right
        || clientY < frameRect.top
        || clientY > frameRect.bottom
      ) {
        return null;
      }
      return contentDocument?.elementFromPoint(
        clientX - frameRect.left,
        clientY - frameRect.top,
      ) ?? null;
    },
  };
}

function syncIframeStyles(targetDocument: Document, themeClassName?: string): void {
  const sourceDocument = document;
  const themeClassList = sourceDocument.documentElement.className
    .split(/\s+/)
    .filter(Boolean)
    .filter((item) => item.startsWith('theme-'));
  if (themeClassName && !themeClassList.includes(themeClassName)) {
    themeClassList.push(themeClassName);
  }
  targetDocument.documentElement.className = themeClassList.join(' ');

  const managedSelector = 'style, link[rel="stylesheet"]';
  targetDocument.head.querySelectorAll('[data-shenbi-iframe-style="true"]').forEach((node) => node.remove());
  sourceDocument.head.querySelectorAll(managedSelector).forEach((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute('data-shenbi-iframe-style', 'true');
    targetDocument.head.appendChild(clone);
  });
}

function DirectCanvasSurface({ children, onReady, pointerEventsDisabled }: CanvasSurfaceProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    onReady?.(host ? createDirectHandle(host) : null);
    return () => {
      onReady?.(null);
    };
  }, [onReady]);

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full bg-white overflow-hidden"
      style={pointerEventsDisabled ? { pointerEvents: 'none' } : undefined}
    >
      {children}
    </div>
  );
}

function IframeCanvasSurface({
  children,
  onReady,
  themeClassName,
  pointerEventsDisabled,
}: CanvasSurfaceProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [iframeElement, setIframeElement] = React.useState<HTMLIFrameElement | null>(null);
  const [portalRoot, setPortalRoot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    let disposed = false;
    let mountedIframe: HTMLIFrameElement | null = null;

    void acquireIframeFromPool().then((iframe) => {
      if (disposed || !hostRef.current) {
        disposePooledIframe(iframe);
        return;
      }
      mountedIframe = iframe;
      Object.assign(iframe.style, {
        width: '100%',
        height: '100%',
        border: '0',
        display: 'block',
        background: '#ffffff',
        pointerEvents: pointerEventsDisabled ? 'none' : 'auto',
      });
      hostRef.current.appendChild(iframe);
      const targetDocument = iframe.contentDocument;
      const rootElement = targetDocument?.getElementById('shenbi-iframe-root') as HTMLElement | null;
      if (!targetDocument || !rootElement) {
        return;
      }
      syncIframeStyles(targetDocument, themeClassName);
      setIframeElement(iframe);
      setPortalRoot(rootElement);
      onReady?.(createIframeHandle(iframe, rootElement));
    });

    return () => {
      disposed = true;
      onReady?.(null);
      setPortalRoot(null);
      setIframeElement(null);
      disposePooledIframe(mountedIframe);
    };
  }, [onReady, themeClassName]);

  React.useEffect(() => {
    if (!iframeElement?.contentDocument) {
      return;
    }
    iframeElement.style.pointerEvents = pointerEventsDisabled ? 'none' : 'auto';
    syncIframeStyles(iframeElement.contentDocument, themeClassName);
  }, [iframeElement, pointerEventsDisabled, themeClassName]);

  return (
    <div ref={hostRef} className="relative h-full w-full bg-white overflow-hidden">
      {portalRoot ? ReactDOM.createPortal(children, portalRoot) : null}
    </div>
  );
}

export function CanvasSurface(props: CanvasSurfaceProps) {
  if (props.mode === 'iframe') {
    return <IframeCanvasSurface {...props} />;
  }
  return <DirectCanvasSurface {...props} />;
}
