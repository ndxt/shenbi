import React from 'react';
import ReactDOM from 'react-dom';
import type { CanvasSurfaceHandle } from './types';
import { acquireIframeFromPool, disposePooledIframe, IFRAME_SRC_DOC } from './iframe-pool';

interface CanvasSurfaceProps {
  mode: 'direct' | 'iframe';
  themeClassName?: string;
  children: React.ReactNode;
  pointerEventsDisabled?: boolean;
  onReady?: (surface: CanvasSurfaceHandle | null) => void;
}

const DEFAULT_IFRAME_MIN_HEIGHT = 800;

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
      const targetRect = target.getBoundingClientRect();
      return {
        // Elements inside the iframe already report rects in the iframe viewport's
        // coordinate space, which matches the overlay mounted over the iframe host.
        top: targetRect.top,
        left: targetRect.left,
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

  targetDocument.head.querySelectorAll('[data-shenbi-iframe-adopted-style="true"]').forEach((node) => node.remove());
  const adoptedSheets = Array.from(sourceDocument.adoptedStyleSheets ?? []);
  adoptedSheets.forEach((sheet) => {
    try {
      const cssText = Array.from(sheet.cssRules ?? []).map((rule) => rule.cssText).join('\n');
      if (!cssText.trim()) {
        return;
      }
      const styleElement = targetDocument.createElement('style');
      styleElement.setAttribute('data-shenbi-iframe-adopted-style', 'true');
      styleElement.textContent = cssText;
      targetDocument.head.appendChild(styleElement);
    } catch {
      // Ignore cross-origin or unreadable stylesheet rules.
    }
  });
}

function getIframeMarkup(iframe: HTMLIFrameElement): string {
  const liveMarkup = iframe.contentDocument?.documentElement?.outerHTML;
  return liveMarkup ? `<!doctype html>${liveMarkup}` : IFRAME_SRC_DOC;
}

function writeIframeDocument(iframe: HTMLIFrameElement, markup: string): Document | null {
  const targetDocument = iframe.contentDocument;
  if (!targetDocument) {
    return null;
  }
  targetDocument.open();
  targetDocument.write(markup);
  targetDocument.close();
  return targetDocument;
}

function syncIframeHeight(
  iframe: HTMLIFrameElement,
  rootElement: HTMLElement,
): void {
  const targetDocument = iframe.contentDocument;
  const pageRoot = targetDocument?.querySelector('[data-shenbi-page-root]') as HTMLElement | null;
  const candidateElements = [
    pageRoot,
    rootElement.firstElementChild instanceof HTMLElement ? rootElement.firstElementChild : null,
    ...[...rootElement.children].filter((element): element is HTMLElement => element instanceof HTMLElement),
  ].filter((element, index, array): element is HTMLElement => Boolean(element) && array.indexOf(element) === index);

  const measuredContentHeight = candidateElements.reduce((maxHeight, element) => (
    Math.max(
      maxHeight,
      element.scrollHeight,
      element.getBoundingClientRect().height,
    )
  ), 0);

  const nextHeight = Math.max(
    DEFAULT_IFRAME_MIN_HEIGHT,
    measuredContentHeight,
  );
  iframe.style.height = `${Math.ceil(nextHeight)}px`;
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
      style={{
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        ...(pointerEventsDisabled ? { pointerEvents: 'none' } : {}),
      }}
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
  const syncHeightRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    let disposed = false;
    let mountedIframe: HTMLIFrameElement | null = null;
    let warmIframe: HTMLIFrameElement | null = null;

    void acquireIframeFromPool().then((iframe) => {
      warmIframe = iframe;
      if (disposed || !hostRef.current) {
        disposePooledIframe(iframe);
        return;
      }

      const visibleIframe = document.createElement('iframe');
      mountedIframe = visibleIframe;
      Object.assign(visibleIframe.style, {
        width: '100%',
        border: '0',
        display: 'block',
        background: '#ffffff',
        pointerEvents: pointerEventsDisabled ? 'none' : 'auto',
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      });
      hostRef.current.appendChild(visibleIframe);

      const targetDocument = writeIframeDocument(visibleIframe, getIframeMarkup(iframe));
      const rootElement = targetDocument?.getElementById('shenbi-iframe-root') as HTMLElement | null;
      if (!targetDocument || !rootElement) {
        disposePooledIframe(iframe);
        return;
      }
      syncIframeStyles(targetDocument, themeClassName);
      syncIframeHeight(visibleIframe, rootElement);
      setIframeElement(visibleIframe);
      setPortalRoot(rootElement);
      onReady?.(createIframeHandle(visibleIframe, rootElement));
      disposePooledIframe(iframe);
    });

    return () => {
      disposed = true;
      onReady?.(null);
      setPortalRoot(null);
      setIframeElement(null);
      disposePooledIframe(mountedIframe);
      if (warmIframe !== mountedIframe) {
        disposePooledIframe(warmIframe);
      }
    };
  }, [onReady, themeClassName]);

  React.useEffect(() => {
    if (!iframeElement?.contentDocument) {
      return;
    }
    iframeElement.style.pointerEvents = pointerEventsDisabled ? 'none' : 'auto';
    syncIframeStyles(iframeElement.contentDocument, themeClassName);
  }, [iframeElement, pointerEventsDisabled, themeClassName]);

  React.useEffect(() => {
    if (!iframeElement?.contentDocument) {
      return;
    }

    const sync = () => {
      if (!iframeElement.contentDocument) {
        return;
      }
      syncIframeStyles(iframeElement.contentDocument, themeClassName);
    };

    sync();

    let styleSyncRaf = 0;
    const scheduleStyleSync = () => {
      if (styleSyncRaf) { return; }
      styleSyncRaf = requestAnimationFrame(() => {
        styleSyncRaf = 0;
        sync();
      });
    };

    const sourceHeadObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleStyleSync)
      : null;
    sourceHeadObserver?.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    const sourceRootObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleStyleSync)
      : null;
    sourceRootObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      if (styleSyncRaf) { cancelAnimationFrame(styleSyncRaf); }
      sourceHeadObserver?.disconnect();
      sourceRootObserver?.disconnect();
    };
  }, [iframeElement, themeClassName]);

  React.useEffect(() => {
    if (!iframeElement || !portalRoot) {
      syncHeightRef.current = null;
      return;
    }

    const sync = () => {
      syncIframeHeight(iframeElement, portalRoot);
    };
    syncHeightRef.current = sync;
    sync();

    let heightSyncRaf = 0;
    const scheduleHeightSync = () => {
      if (heightSyncRaf) { return; }
      heightSyncRaf = requestAnimationFrame(() => {
        heightSyncRaf = 0;
        sync();
      });
    };

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(scheduleHeightSync)
      : null;
    resizeObserver?.observe(portalRoot);
    const pageRoot = iframeElement.contentDocument?.querySelector('[data-shenbi-page-root]');
    if (pageRoot instanceof HTMLElement) {
      resizeObserver?.observe(pageRoot);
    }

    const mutationObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(scheduleHeightSync)
      : null;
    mutationObserver?.observe(portalRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    const handleWindowResize = () => {
      sync();
    };
    window.addEventListener('resize', handleWindowResize);
    iframeElement.contentWindow?.addEventListener('resize', handleWindowResize);

    return () => {
      syncHeightRef.current = null;
      if (heightSyncRaf) { cancelAnimationFrame(heightSyncRaf); }
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      iframeElement.contentWindow?.removeEventListener('resize', handleWindowResize);
    };
  }, [iframeElement, portalRoot]);

  React.useEffect(() => {
    syncHeightRef.current?.();
  }, [children, iframeElement]);

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full bg-white overflow-hidden"
      style={{
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
    >
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
