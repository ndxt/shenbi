const IFRAME_SRC_DOC = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #shenbi-iframe-root {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100%;
        background: #ffffff;
      }
      body {
        overflow: auto;
      }
      * {
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div id="shenbi-iframe-root"></div>
  </body>
</html>
`.trim();

let warmIframePromise: Promise<HTMLIFrameElement> | null = null;
let poolHost: HTMLDivElement | null = null;

function ensurePoolHost(): HTMLDivElement {
  if (poolHost) {
    return poolHost;
  }
  poolHost = document.createElement('div');
  poolHost.setAttribute('data-shenbi-iframe-pool', 'true');
  Object.assign(poolHost.style, {
    position: 'fixed',
    left: '-99999px',
    top: '-99999px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '0',
  });
  document.body.appendChild(poolHost);
  return poolHost;
}

function createWarmIframe(): Promise<HTMLIFrameElement> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.srcdoc = IFRAME_SRC_DOC;
    Object.assign(iframe.style, {
      width: '1px',
      height: '1px',
      border: '0',
      background: '#ffffff',
    });

    const finalize = () => resolve(iframe);
    iframe.addEventListener('load', finalize, { once: true });
    ensurePoolHost().appendChild(iframe);
  });
}

function ensureWarmIframe(): Promise<HTMLIFrameElement> {
  if (!warmIframePromise) {
    warmIframePromise = createWarmIframe();
  }
  return warmIframePromise;
}

export async function acquireIframeFromPool(): Promise<HTMLIFrameElement> {
  const iframe = await ensureWarmIframe();
  warmIframePromise = createWarmIframe();
  return iframe;
}

export function disposePooledIframe(iframe: HTMLIFrameElement | null | undefined): void {
  iframe?.remove();
}
