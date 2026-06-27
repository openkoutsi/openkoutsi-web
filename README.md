<picture>
  <source media="(prefers-color-scheme: dark)" srcset="design/exports-horizontal/openkoutsi-horizontal-white.svg">
  <source media="(prefers-color-scheme: light)" srcset="design/exports-horizontal/openkoutsi-horizontal-black.svg">
  <img src="design/exports-horizontal/openkoutsi-horizontal-black.svg" alt="openkoutsi">
</picture>

# openkoutsi-web

The web frontend for [openkoutsi](https://github.com/LassiHeikkila/openkoutsi), a
self-hosted cycling coaching platform. This is a [Next.js 15](https://nextjs.org/)
(App Router) app written in TypeScript with Tailwind CSS and Recharts.

The backend (FastAPI) lives in a separate repository:
**[LassiHeikkila/openkoutsi](https://github.com/LassiHeikkila/openkoutsi)**. This
frontend talks to it purely over HTTP (`/api/*`) — the only coupling is configuration
(`NEXT_PUBLIC_API_URL`), so the two deploy independently.

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
- A running openkoutsi backend (see the backend repo) reachable at `NEXT_PUBLIC_API_URL`

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
# URL a browser uses to reach the backend API. Baked into the JS bundle at build time.
NEXT_PUBLIC_API_URL=http://localhost:8000

# Public base URL of this frontend.
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Optional: shown to users on the password-reset screen as the admin contact.
NEXT_PUBLIC_ADMIN_CONTACT="phone up lassi"
```

> `NEXT_PUBLIC_*` variables are **baked into the build at build time**, not read at
> runtime. Rebuild after changing them.

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
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.your-domain -t openkoutsi-web .
docker run -p 3000:3000 openkoutsi-web
```

`NEXT_PUBLIC_API_URL` is a build arg because it is baked into the bundle; set it to the
URL your browser will use to reach the backend.

## Deployment

The build produces a self-contained server under `.next/standalone/`. For a VPS deploy,
`scripts/deploy-frontend.sh` builds locally and rsyncs the standalone output to the
server, and `systemd/openkoutsi-frontend@.service` runs it.

> The systemd unit's `ExecStart` uses a hardcoded nvm Node path — adjust it to match the
> Node version installed on your server.

The `.github/workflows/deploy-frontend.yml` workflow automates this on push to `main`.
It requires these repository secrets: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BASE_URL`,
`VPS_SSH_PRIVATE_KEY`, `VPS_HOST`, `VPS_USER`.

## License

Apache-2.0. See the [backend repository](https://github.com/LassiHeikkila/openkoutsi)
for the project license.
