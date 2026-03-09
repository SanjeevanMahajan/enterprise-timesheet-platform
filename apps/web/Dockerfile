# ── Build stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time environment variables for API routing through Nginx
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_REPORTING_URL=

ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_REPORTING_URL=

RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output (includes only used dependencies)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
