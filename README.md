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

## Data freshness

Screens that show live data poll with SWR's `refreshInterval`, but a timer alone
cannot keep a mobile app current: iOS suspends JavaScript while the app is
backgrounded — most aggressively when the site is launched from a Home Screen
icon — and the ticks that were missed are never replayed. `ResumeRevalidator`
(`src/components/ResumeRevalidator.tsx`, mounted once in the root providers)
therefore refetches every mounted SWR key whenever the app returns to the
foreground, using the resume signal from `src/lib/appResume.ts`
(`visibilitychange` + `pageshow`/`pagehide`, de-duplicated so one resume means
one pass).

SWR's own `revalidateOnFocus` stays off: it fires on every window focus and does
not see the `pageshow` that an iOS standalone app resumes with. The dashboard
additionally re-runs the daily metrics catch-up on resume and shows when it last
received data, next to a manual refresh button — a Home Screen web app has no
address bar to reload from.

Because the mechanism keys on SWR, anything that fetches outside it is invisible
to `ResumeRevalidator`. The RPE prompt (`src/components/activities/RpePrompt.tsx`)
used to be exactly that, and so never asked about rides that synced while the app
was backgrounded; it now holds the pending queue as an SWR key and additionally
takes the resume signal itself, so a resume re-prompts even when the queue came
back unchanged (a deep-equal refetch leaves the cached object — and therefore the
effects watching it — untouched).

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

## Personal access tokens

**Settings → Personal access tokens** lets a user issue long-lived, scoped
credentials to their own tooling. The card follows the copy-once shape the
invitation dialog established: the secret is returned exactly once, at creation,
so the form is replaced by the value and a copy button and closing the dialog is
the point of no return.

Three details in `PersonalAccessTokensCard.tsx` are deliberate rather than
incidental:

- **The card hides itself** when `allow_personal_access_tokens` is off in
  `GET /api/public/instance-info`, and does not even request the token list — a
  self-hoster who forbade long-lived credentials should not see the feature.
- **`athlete:export` is presented apart from the ordinary read scopes**, because
  one call under it downloads the entire record. It is a box the user ticks on
  purpose, not one they scroll past.
- **Scopes and expiry are read-only on an existing token.** A token is immutable
  server-side; widening one means revoking it and issuing a new one, so there is
  no edit affordance to offer.

The admin console gains the matching instance toggle beside `allow_self_signup`,
and a per-user token dialog that lists and revokes — never issues, and never
shows a token's name.

## The MCP server switch

**Admin → Settings → Allow the MCP server** drives `allow_mcp_server` on
`PATCH /api/admin/settings`, the backend's instance switch for the Model Context
Protocol endpoint (`POST /mcp`). It sits with the other instance switches and, like
personal access tokens, is **on by default** — the copy has to earn the admin's
trust rather than the default doing it.

Two conditional lines carry the whole point of the switch:

- **Off says what off means.** The endpoint is refused outright, the handshake
  included, so a client is told the server is not there instead of connecting and
  then failing every call. The same line says what turning it off does *not* do: it
  withdraws an interface, not an exposure — a token reaches the same data through
  the ordinary API either way, and what limits a credential is its scopes. An admin
  who reads this switch as a privacy control has been misled by it.
- **On, with tokens off, is on in name only.** The endpoint accepts a session token
  too, but those last an hour; without personal access tokens no external client
  has a credential to hold. The two switches interact, and the second one is where
  the admin finds out.

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
