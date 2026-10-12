/**
 * Loopback callback server (OAuth native/desktop flows).
 * Listens on 127.0.0.1:{random port}/callback and receives the code + state sent back by the authorization page.
 * Constraints: start listening before opening the authorization page; validate state first when a callback arrives; the code is used exactly once.
 */
import { createServer } from 'node:http';

export class CallbackTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CallbackTimeoutError';
  }
}

/**
 * Start the loopback callback listener.
 * @returns {Promise<{port:number, url:string, waitForCallback:()=>Promise<{code:string,state:string}>, close:()=>Promise<void>}>}
 */
export async function startCallbackServer({ path = '/callback', port = 0, host = '127.0.0.1', timeoutMs = 300_000, signal } = {}) {
  if (!path.startsWith('/')) path = `/${path}`;

  let resolveCallback;
  let rejectCallback;
  const callbackPromise = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  callbackPromise.catch(() => {});

  const onAbort = () => rejectCallback(new CallbackTimeoutError('callback wait aborted'));
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const timer = setTimeout(() => {
    rejectCallback(new CallbackTimeoutError(`no callback received within ${timeoutMs}ms`));
  }, timeoutMs);

  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${host}:${port}`);
    if (requestUrl.pathname === path) {
      const code = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><html><head><meta charset="utf-8"><title>MCP Connector authorization</title></head>' +
        '<body style="font-family:system-ui;text-align:center;padding-top:80px">' +
        '<h2>✅ Authorization successful</h2><p>The external MCP is connected. You can close this page and return to DeepSeek Harness.</p>' +
        '</body></html>',
      );
      if (code !== null && state !== null) {
        resolveCallback({ code, state });
      } else {
        rejectCallback(new Error('callback missing code or state'));
      }
      return;
    }
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('mcp-connector callback server is running');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const actualPort = server.address().port;
  const url = `http://${host}:${actualPort}${path}`;

  let closed = false;
  const close = () => {
    if (closed) return Promise.resolve();
    closed = true;
    return new Promise((resolve) => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      server.close(() => resolve());
    });
  };

  const waitForCallback = async () => {
    try {
      return await callbackPromise;
    } finally {
      await close();
    }
  };

  return { port: actualPort, url, waitForCallback, close };
}
