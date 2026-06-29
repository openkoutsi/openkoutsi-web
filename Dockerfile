# ── Build stage ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# The backend API URL is read at runtime (not baked into the bundle), so the
# image is environment-agnostic — no build args are needed here. See API_URL /
# BASE_URL in the runtime stage below.
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Runtime configuration (supply via `docker run -e` or compose `environment:`):
#   API_URL  — URL the browser uses to reach the backend, e.g. https://api.example.com
#   BASE_URL — public base URL of this frontend, e.g. https://app.example.com
# Both default to localhost when unset (see getApiUrl() and the SEO routes).

# standalone output contains the server; static assets must be copied in.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
