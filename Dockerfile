# ── Next.js ADAS Dashboard ────────────────────────────────────────────────────
# Development image — hot-reload enabled.
# For production, swap "npm run dev" for "npm run build && npm start".

FROM node:20-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies layer ────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

# ── Runtime image ─────────────────────────────────────────────────────────────
F…(truncated)