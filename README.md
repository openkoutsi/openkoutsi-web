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

## Importing a training history

Two upload paths, chosen by `src/lib/imports.ts` from what was dropped rather
than by a mode the athlete has to pick first:

- **A couple of plain `.fit` files** go straight to `POST /api/activities/upload`,
  which returns the created activity, shows it immediately, and is the only path
  that attaches a device file to an already-synced ride so it gains its laps.
- **Anything else** — a `.gpx`, a `.tcx`, a gzipped file, a `.zip`, or more than
  `DIRECT_UPLOAD_MAX_FILES` files at once — becomes a background job via
  `POST /api/activities/import`. `ImportProgress` polls
  `GET /api/activities/imports/{id}` until it settles, then shows the per-file
  outcome list: which files were skipped as duplicates, which failed, and the
  reason the backend gave for each. Successes are collapsed behind a toggle,
  because nine hundred lines saying "imported" bury the fifty that need a look.

The split exists because the upload endpoint is rate limited to 30/hour, which
is what made importing a history one file at a time impossible in the first
place; a drop big enough to be a backlog should not be spending that budget.

An athlete whose activity list is empty gets the dropzone in its `firstRun`
form, which says what a Strava bulk export is and that the whole zip can be
dropped in unopened. Getting a history across is the hardest part of adopting
openkoutsi, so that is the moment to answer it rather than leave a dashed box to
imply it.

Activities carry `original_format` (`fit` / `gpx` / `tcx`), which the detail page
uses to name the download and to explain that a GPX-sourced ride has no power
data because the file never had any — rather than letting three empty tiles read
as a failed import.

## Data freshness

Screens that show live data poll with SWR's `refreshInterval`, but a timer alone
cannot keep a mobile app current: iOS suspends JavaScript while the app is
backgrounded — most aggressively when the site is launched from a Home Screen
icon — and the ticks that were missed are never replayed. `ResumeRefresher`
(`src/components/ResumeRefresher.tsx`, mounted once in the root providers)
therefore acts whenever the app returns to the foreground, on the resume signal
from `src/lib/appResume.ts` (`visibilitychange` + `pageshow`/`pagehide`,
de-duplicated so one resume means one pass, and re-armed on every `pagehide` so
that leaving and coming straight back still counts).

**What it does depends on how long the app was away**, which the resume signal
reports as `awayMs`. Under a minute it refetches every mounted SWR key in place.
A minute or more — or an absence it cannot measure, which is the
restored-from-bfcache case — and it reloads the page instead.

Reloading looks like the heavier option and is the lighter one. The access token
lives in memory and expires after an hour, so a phone picked up the next morning
resumes with a dead token and *every* mounted key answers 401 at the same moment;
refetching in place means the athlete waits out a fan-out of refresh-and-retry
round-trips on a radio that has only just woken up. A reload asks once — the
fresh document's `AuthProvider` restores one token and fetches once — and picks
up any new deploy on the way. Both halves of that matter: `apiFetch` also
single-flights the token refresh, so a burst of simultaneous 401s mints one
`POST /api/auth/refresh` rather than ten racing for the same cookie, and it now
distinguishes a refusal (401/403 — the session really has ended) from a refresh
it could not make at all (network error, 429, 5xx), which leaves the session
alone instead of logging the athlete out over one dropped packet.

A reload throws away everything held in component state, so it is skipped — and
the in-place refetch used instead — when the app is offline, when any modal is
open (one `[role="dialog"]` query covers every Radix dialog in the app), within
`MIN_UPTIME_MS` of the page loading (a loop guard), or when something has taken a
claim via `holdPageReload` (`src/lib/resumeGuard.ts`). The claim is what protects
the athlete's own typing: an unsent chat message, an upload in flight, the middle
of the onboarding wizard.

SWR's own `revalidateOnFocus` stays off: it fires on every window focus and does
not see the `pageshow` that an iOS standalone app resumes with. The dashboard
additionally re-runs the daily metrics catch-up on resume and shows when it last
received data, next to a manual refresh button — a Home Screen web app has no
address bar to reload from.

Because the in-place path keys on SWR, anything that fetches outside it is
invisible to it. The RPE prompt (`src/components/activities/RpePrompt.tsx`) used
to be exactly that, and so never asked about rides that synced while the app was
backgrounded; it now holds the pending queue as an SWR key and additionally takes
the resume signal itself, so a resume re-prompts even when the queue came back
unchanged (a deep-equal refetch leaves the cached object — and therefore the
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

## Koutsi's progress line

When the athlete turns on **Settings → Analysis → Let Koutsi look things up**,
the daily feedback card and the activity analysis stop being generated from a
fixed summary and become an agent loop over the backend's coaching tools. The
frontend consequence is small but not optional: the first rounds of that loop are
tool calls that produce **no prose at all**, so a card that used to fill in token
by token would instead spin for a long time and then jump to a finished answer.

The backend therefore reports a `progress` field alongside the pending status
(`progress` on the training status, `analysis_progress` on an activity), and the
cards render it via `progressText` in `src/components/koutsi-chat.tsx`.

Three things about that field are worth knowing before touching this code:

- **It is a code, not a sentence.** `thinking`, or `tool.<backend tool name>`.
  The coaching prompts run in fourteen languages while every tool name and
  description is English, so a model-written progress line would be untranslated
  the moment the athlete is not reading English — and could put tool internals in
  front of them. The strings live in `common.llm.progress.*`.
- **An unknown code must not be shown.** `progressText` falls back to the generic
  "Koutsi is thinking…" for a `tool.*` suffix this build has never heard of. That
  is what lets the backend publish a new tool without a lockstep frontend
  release; rendering `tool.get_sleep_quality` at an athlete is the alternative.
- **It is a separate field, not part of the prose.** `parseMoodAndParagraphs`
  reads the analysis text as raw prose and the dashboard card, the activity page
  and the goal-guidance card all share it. A structured envelope inside that text
  would have broken all three. The `MOOD:` contract is unchanged, including its
  tolerance of a missing line — which the agentic path makes *more* likely, since
  models obey a leading-format rule less reliably on a turn that follows tool
  results.

The field is null for the whole non-agentic path and null once the answer starts,
so a finished card looks exactly as it always did.

## Ask Koutsi

`/chat` (issue #44) is where the athlete puts their own questions to Koutsi
instead of reading a card it wrote unprompted. The nav entry appears only when
**Settings → Analysis → Let Koutsi look things up** is on: chat is worth nothing
without tools, so it rides the same switch rather than offering a surface that
would have to explain itself on arrival.

The client sends **one string**. It never builds a message array — the system
prompt, the scope policy and the replayed history are all assembled server-side,
which is what keeps the guardrails out of reach of anyone holding an access
token. Rendering reuses `KoutsiAvatar`, `KoutsiBubble`, `parseMoodAndParagraphs`
and `progressText` unchanged, so an answer here looks like the daily card and one
parser serves both.

Three things about this surface differ from every other AI view in the app, and
all three come from the same fact — chat has no single-shot prompt to fall back
on, because the question is arbitrary:

- **Failures are visible and typed.** Everywhere else an unusable model quietly
  degrades to the blob prompt. Here the turn carries an `error_code`, and each
  gets its own sentence: `busy`, `tools_unsupported`, `no_answer`, `upstream`,
  `unreachable`, `stalled`. Unknown codes fall back to generic copy, the same
  contract the progress codes have. Only `tools_unsupported` withholds the retry
  button — it is a settled property of the athlete's model, so a retry would fail
  identically.
- **There is a `queued` state**, which exists nowhere else. A chat turn competes
  for the same agent slots as the background daily-status runs; rather than being
  refused it waits, and the wait is shown as waiting rather than as thinking,
  because nothing is being written yet.
- **The page can be unusable up front.** A model that cannot call tools, a
  missing opt-in, or a gated instance are all answered before the athlete types —
  discovering any of them *after* composing a question is a bad way to learn a
  permanent fact about your own setup.

Polling is 600 ms while a turn is pending and 1500 ms while it is queued, rather
than the card's flat 1500 ms: someone is watching this one. It stays polling
rather than streaming for the reason the card does — the answer is persisted, so
a reload mid-answer resumes instead of losing the turn, which matters more for a
conversation than it ever did for a card. Availability is refetched whenever a
turn *settles*, not when one is sent: the backend does not charge for failures
that never reached a provider, so the remaining count is only knowable once the
turn is over — and without the refetch the budget warning would show the number
it had at page load right up to the 429 it exists to pre-empt.

**Try again** re-runs the failed answer in place (`POST …/messages/{id}/retry`)
rather than re-posting the question. Re-asking would show the athlete their own
question twice at the exact moment something has visibly gone wrong, spend a
second turn of the budget, and send a history ending with the same question
adjacent to itself. Only the newest turn offers the button, since that is the
only one the page acts on.

### The lookups are part of the thread

A turn's tool calls are drawn as steps **above** the answer, in the order they
were made, rather than as a "Koutsi looked at…" footer under it. That is where
they happened: the loop gathers first and writes afterwards — the backend
discards prose that turns out to precede a tool call, so an answer never
interleaves with its own lookups — and a footer put the record of the slow part
after the thing it produced, reading as an afterthought about a turn that had
apparently answered instantly.

The steps appear **as they are made**, not when the turn settles: the backend
writes `tool_names` through on every progress marker, so a live turn shows the
lookups already behind it with the current one still running as the usual
progress line beneath them. The running lookup is deliberately not also drawn as
a finished step — it is in `tool_names` from the moment it is dispatched, and the
progress code is already describing it. Once prose starts, everything in
`tool_names` is behind us, which matters because the backend does *not* clear the
progress code when the answer begins.

A finished step is a short label ("Your power curve"), not the present-tense
sentence the progress line uses; both vocabularies live in `common.llm.progress.*`
and both fall back to generic copy for a tool this build has never heard of, so
`get_sleep_quality` is never shown to an athlete. A failed turn keeps the steps it
got through — "it read your plan and then fell over" is a different event from "it
never got going", and the athlete deciding whether to retry is the one who wants
to know which.

The medical boundary is a **standing notice** by the composer, not a per-message
marker. A `BAND:` line beside `MOOD:` was the obvious design and was rejected: it
would be one more leading-format rule, degrading on exactly the small local models
BYOK users run and on exactly the post-tool-result turns, so the disclosure would
go missing from the answers most likely to need it.

The **AI-generated label** stands there too, for a different reason. Issue #41 puts
it directly beneath Koutsi's prose everywhere else, which works because those
surfaces show one block per screen. A thread is many blocks, and the same sentence
repeated under every turn stops being read by the third one — so chat states it once,
where it cannot scroll away from the answers it applies to. It appears with the first
question rather than on an empty thread, since its copy is about text that exists.

## Scripts

```bash
npm run dev            # start the dev server
npm run build          # production build (standalone output)
npm run start          # run the production build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit, app and tests (CI runs this too)
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
