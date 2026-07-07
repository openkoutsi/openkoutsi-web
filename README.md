<picture>
  <source media="(prefers-color-scheme: dark)" srcset="design/exports-horizontal/openkoutsi-horizontal-white.svg">
  <source media="(prefers-color-scheme: light)" srcset="design/exports-horizontal/openkoutsi-horizontal-black.svg">
  <img src="design/exports-horizontal/openkoutsi-horizontal-black.svg" alt="openkoutsi">
</picture>

# openkoutsi-web

The web frontend for [openkoutsi](https://github.com/openkoutsi/openkoutsi), a
self-hosted cycling coaching platform. This is a [Next.js 15](https://nextjs.org/)
(App Router) app written in TypeScript with Tailwind CSS and Recharts.

The backend (FastAPI) lives in a separate repository:
**[openkoutsi/openkoutsi-backend](https://github.com/openkoutsi/openkoutsi-backend)**. This
frontend talks to it purely over HTTP (`/api/*`) — the only coupling is configuration
(`API_URL`), so the two deploy independently.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) · React 18 · TypeScript |
| Styling | Tailwind CSS · Radix UI |
| Charts | Recharts |
| i18n | next-intl (English + Finnish) |
| Tests | Vitest · Testing Library |

## Prerequisites

- Node.js 22+
- npm
- A running openkoutsi backend (see the backend repo) reachable at `API_URL`

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local (see "Environment variables" below)

# 3. Start the dev server
npm run dev
# open http://localhost:3000
```

## Environment variables

Create a `.env.local` in the repo root:

```env
# URL a browser uses to reach the backend API. Read at runtime, so the same build
# works against any backend.
API_URL=http://localhost:8000

# Public base URL of this frontend (used for SEO metadata, sitemap, robots). Read
# at runtime.
BASE_URL=http://localhost:3000
```

> `API_URL` and `BASE_URL` are read at **runtime** — the same image can target any
> environment without rebuilding. The app injects `API_URL` into the page as
> `window.__ENV__` so the browser reads it at runtime (see `src/lib/api.ts`), and the
> runtime Content-Security-Policy is set in `src/middleware.ts`.
>
> The admin contact shown on the password-reset screen is no longer a build-time env
> var — it is an admin-managed instance setting served by the backend
> (`GET /api/public/instance-info`) and editable in the admin settings UI.

## Scripts

```bash
npm run dev            # start the dev server
npm run build          # production build (standalone output)
npm run start          # run the production build
npm run lint           # eslint
npx vitest run         # run tests once
npm run test:coverage  # run tests with coverage
```

## Docker

```bash
docker build -t openkoutsi-web .
docker run -p 3000:3000 \
  -e API_URL=https://api.your-domain \
  -e BASE_URL=https://app.your-domain \
  openkoutsi-web
```

`API_URL` and `BASE_URL` are supplied at **runtime**, so the image is environment-agnostic
— build once, then point each deployment at its backend and public URL via these env vars.

## Deployment

Deployment is container-based and **poll-driven**. On push to `main`,
`.github/workflows/build-images.yml` builds the image and publishes it to GHCR as
`ghcr.io/openkoutsi/openkoutsi-web`, tagged `latest` (the channel the VM tracks) and
`sha-<sha>` (immutable, for rollback). The VM only *pulls* the finished image on a
schedule and runs it — there is no inbound CI→VM SSH key and no source build on the
box. Because `API_URL`/`BASE_URL` are supplied at runtime, the same image serves any
environment.

> The bare-metal `systemd/openkoutsi-frontend@.service` unit is **legacy**, kept for
> reference only and superseded by the container model above.

## License

Apache-2.0. See the [backend repository](https://github.com/openkoutsi/openkoutsi)
for the project license.
