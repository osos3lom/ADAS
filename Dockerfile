# ── Next.js ADAS Dashboard ────────────────────────────────────────────────────
# Development image (hot reload). Build context is the repo root so this can copy
# from ./frontend; see docker-compose.yml (frontend service) and .dockerignore.
# For a production image, swap the CMD for: RUN npm run build  +  CMD npm start.
FROM node:20-alpine

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Dependencies layer (cached separately from source).
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
