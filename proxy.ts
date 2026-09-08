import { readFileSync } from 'fs';

const PORT = 443;
const VITE_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3000';

console.log(`🚀 StreamEly Enterprise SECURE Reverse Proxy running on port ${PORT}`);
console.log(`📡 Route: https://streamely.local/ -> ${VITE_URL}`);
console.log(`📡 Route: https://streamely.local/api/* -> ${BACKEND_URL}/api/*`);

// Main HTTPS Reverse Proxy
Bun.serve({
  port: PORT,
  tls: {
    cert: readFileSync('cert.crt'),
    key: readFileSync('key.pem'),
  },
  async fetch(req) {
    const url = new URL(req.url);

    const newHeaders = new Headers(req.headers);
    newHeaders.set('Host', 'localhost');

    // API Gateway Logic (Reverse Proxy for Backend)
    if (url.pathname.startsWith('/api/')) {
      const targetUrl = new URL(url.pathname + url.search, BACKEND_URL);
      return fetch(targetUrl, {
        method: req.method,
        headers: newHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined
      });
    }

    // Frontend Proxy (Reverse Proxy for Vite)
    const targetUrl = new URL(url.pathname + url.search, VITE_URL);
    try {
      return await fetch(targetUrl, {
        method: req.method,
        headers: newHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined
      });
    } catch (e) {
      return new Response('StreamEly Frontend (Vite) is not running.', { status: 502 });
    }
  },
});
