FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lock ./

# Install dependencies on Linux — this ensures correct platform binaries
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY . .

# Declare build-time args for Vite env vars (Railway passes these automatically)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_FLEETRUNNR_API_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_FLEETRUNNR_API_KEY=$VITE_FLEETRUNNR_API_KEY

# Build the app
RUN bun run build

# Production stage — serve with Caddy
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv

EXPOSE 80
