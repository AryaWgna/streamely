import { readFileSync } from 'fs';

const PORT = 8000;
const VITE_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3000';

console.log(`Reverse proxy running on port ${PORT}`);
console.log(`Route: http://localhost:8000/ -> ${VITE_URL}`);
console.log(`Route: http://localhost:8000/api/* -> ${BACKEND_URL}/api/*`);

async function forwardRequest(req, targetBaseUrl, isApi) {
  const url = new URL(req.url);
  const targetUrl = new URL(url.pathname + url.search, targetBaseUrl);
  
  const newHeaders = new Headers(req.headers);
  newHeaders.set('Host', 'localhost');
  newHeaders.delete('accept-encoding');

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: newHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined
    });

    // Strip content-encoding because Bun automatically decompresses the body 
    // but leaves the header, causing ERR_CONTENT_DECODING_FAILED in browsers
    const proxyHeaders = new Headers(response.headers);
    proxyHeaders.delete('content-encoding');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: proxyHeaders
    });
  } catch (e) {
    if (isApi) {
      return new Response('API is not running.', { status: 502 });
    }
    return new Response('StreamEly Frontend (Vite) is not running.', { status: 502 });
  }
}

// Main HTTP Reverse Proxy
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      return forwardRequest(req, BACKEND_URL, true);
    }
    return forwardRequest(req, VITE_URL, false);
  },
});
