# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# git is needed at build time (drizzle generate may need it; also good for consistency)
RUN apk add --no-cache bash curl git python3 make g++

# Install bun
RUN curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    rm -rf /root/.bun/install

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Must match runtime NUXT_APP_BASE_URL so SPA asset URLs are baked correctly.
ARG NUXT_APP_BASE_URL=/docs
ENV NUXT_APP_BASE_URL=${NUXT_APP_BASE_URL}
ENV NITRO_PRESET=node-server
RUN bun run build

# Production stage
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# git + bash are required at runtime:
# - git: repository clone/diff/push for doc generation
# - bash: opencode agent tool execution
RUN apk add --no-cache bash curl git openssh-client

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install bun + opencode-ai CLI to a shared path so the nodejs user can run them.
# @opencode-ai/sdk spawns `opencode serve` as a subprocess — it must be on PATH.
ENV BUN_INSTALL=/usr/local/bun
RUN mkdir -p /usr/local/bun && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -sf /usr/local/bun/bin/bun /usr/local/bin/bun && \
    /usr/local/bun/bin/bun install -g opencode-ai && \
    ln -sf /usr/local/bun/bin/opencode /usr/local/bin/opencode && \
    opencode --version

COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/templates /app/templates

# Writable dirs: git clones, opencode provider cache, agent config
RUN mkdir -p /tmp/orbit-docs-repositories /home/nodejs/.config/opencode && \
    chown -R nodejs:nodejs /app/.output /app/templates /tmp/orbit-docs-repositories /usr/local/bun /home/nodejs

USER nodejs

EXPOSE 3000

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
ENV HOME=/home/nodejs
# OPENCODE_CONFIG_B64 is injected at runtime via docker-compose / .env

CMD ["node", ".output/server/index.mjs"]
