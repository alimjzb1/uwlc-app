FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json bun.lock ./

# Install dependencies on Linux — this ensures correct platform binaries
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY . .

# Build the app
RUN bun run build

# Production stage — serve with Caddy
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv

EXPOSE 80
