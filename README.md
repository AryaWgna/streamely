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
- **Proxy Gateway**: Custom HTTPS local domain routing (`streamely.local`) bypassing Vite HMR limitations. Binds on `0.0.0.0` for external network access.
- **Cloudflare Tunnel Ready**: Robust proxy logic stripping double-compression headers (prevents `ERR_CONTENT_DECODING_FAILED`).
- **State Persistence**: Syncs watch history and bookmarks via `localStorage`.
- **Multi-Server Player**: Switch between multiple embed servers (VidSrc, MultiEmbed, 2Embed) on the watch page.

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

PM2 runs each service as a separate managed process for better isolation and independent restarts.

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

This spawns three processes:
| Process | What it runs |
|---|---|
| `StreamEly-Backend` | `bun run src/index.ts` in `./backend` |
| `StreamEly-Frontend` | `vite preview --port 5173 --host` in `./frontend` |
| `StreamEly-Proxy` | `bun run proxy.ts` in project root |

To monitor or manage the daemon:
```bash
# View real-time application logs
pm2 logs

# Restart all services
pm2 restart all

# Stop all services
pm2 stop all

# Remove all services from PM2
pm2 delete all
```

### Standalone Service Runner (No PM2)

If you prefer not to install PM2, use the built-in service runner. It manages all three processes with automatic restart on crash:

```bash
node service.js
```

## License

This project is for personal/educational use only.
