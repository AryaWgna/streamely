# StreamEly

*[Baca dalam Bahasa Indonesia](README.id.md)*

StreamEly is a self-hosted, lightweight video-on-demand (VOD) platform. It aggregates metadata from TVmaze and OMDB to serve a comprehensive library of movies, TV series, and anime, paired with an embedded iframe player for content delivery.

## Architecture

```text
                             ┌──▶ [ Vite Dev Server ] (Port 5173)
                             │
[ Client ] ──▶ [ Bun Proxy ] ─┴─▶ [ Elysia.js API ] (Port 3000)
 (HTTPS)                     
```

## Stack
- **Gateway**: Bun (Reverse Proxy & HTTPS offloading)
- **API**: Bun + Elysia.js
- **Client**: Svelte (Vite)
- **Data Sources**: TVmaze API, OMDB API, Vidsrc

## Features
- **Concurrent Ingestion**: Bootstraps 15,000+ entries into an in-memory cache during startup.
- **Fallback Heuristics**: Proxies missing TVmaze cast/crew metadata to OMDB dynamically.
- **Client-Side Processing**: Implements local pagination, genre filtering, and Jaccard-index based recommendations.
- **Proxy Gateway**: Custom HTTPS local domain routing (`streamely.local`) bypassing Vite HMR limitations.
- **Cloudflare Tunnel Ready**: Robust proxy logic stripping double-compression headers (prevents `ERR_CONTENT_DECODING_FAILED`).
- **State Persistence**: Syncs watch history and bookmarks via `localStorage`.

## Local Development

### Prerequisites
- Node.js (v18+)
- Bun (v1.x)
- Windows OS (for daemon configuration)

### Setup

1. **Install Dependencies**
   ```bash
   npm run install:all
   ```

2. **Start Services**
   Runs the API, Vite server, and reverse proxy concurrently.
   ```bash
   npm start
   ```

3. **Access Application**
   Navigate to `https://streamely.local` (accept the self-signed certificate warning).
   *(Alternatively, you can access the proxy directly at `http://localhost:8000`)*

## Public Access (Cloudflare Tunnel)

StreamEly's proxy is pre-configured to safely handle Cloudflare Tunnel encoding without causing `ERR_CONTENT_DECODING_FAILED` errors. To expose your local instance to the internet:

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Run a quick tunnel pointing to the local proxy port (8000):
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
3. Share and access your application using the generated `trycloudflare.com` URL provided in the terminal.


## Background Daemon (PM2)

For persistent background execution:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

To monitor or manage the daemon:
```bash
# View real-time application logs
pm2 logs StreamEly

# Restart the application
pm2 restart StreamEly

# Stop the application
pm2 stop StreamEly

# Remove the application from PM2
pm2 delete StreamEly
```
