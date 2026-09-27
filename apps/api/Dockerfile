FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Chromium + deps for the auto-apply worker
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  ca-certificates curl && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build -w @careerpilot/api 2>&1 || npx tsc -p apps/api/tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/api/generated ./apps/api/generated
EXPOSE 4000
ENV PORT=4000
ENV APP_PORT=4000
# Do not gate startup on migrations — the app DATABASE_URL is the pgbouncer
# transaction pooler, which Prisma migrations cannot use (session mode required).
CMD ["node", "apps/api/dist/server.js"]
