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
# Use Debian-based image because cursor-agent is dynamically linked against glibc
# and does not run on Alpine Linux (musl).
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

# git + bash + curl + openssh-client are required at runtime:
# - git: repository clone/diff/push for doc generation
# - bash: opencode agent tool execution
# - curl: used to install cursor-agent below
RUN apt-get update && \
    apt-get install -y --no-install-recommends bash curl git openssh-client ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r nodejs --gid=1001 && \
    useradd -r -g nodejs --uid=1001 nodejs

# Install bun + opencode-ai CLI to a shared path so the nodejs user can run them.
# @opencode-ai/sdk spawns `opencode serve` as a subprocess — it must be on PATH.
ENV BUN_INSTALL=/usr/local/bun
RUN mkdir -p /usr/local/bun && \
    curl -fsSL https://bun.sh/install | bash && \
    ln -sf /usr/local/bun/bin/bun /usr/local/bin/bun && \
    /usr/local/bun/bin/bun install -g opencode-ai && \
    ln -sf /usr/local/bun/bin/opencode /usr/local/bin/opencode && \
    opencode --version

# Install Cursor CLI via the official installer.
# cursor-agent is used when DOC_AGENT=cursor. For Docker, CURSOR_API_KEY is
# recommended because cursor-agent login stores auth under $HOME and does not
# persist across container restarts.
# The installer puts binaries under $HOME/.local/bin and data under
# $HOME/.local/share/cursor-agent. We relocate them system-wide for the nodejs user.
RUN curl -fsSL https://cursor.com/install | bash && \
    mkdir -p /usr/local/share && \
    mv /root/.local/share/cursor-agent /usr/local/share/cursor-agent && \
    CURSOR_BIN=$(ls /usr/local/share/cursor-agent/versions/*/cursor-agent | head -n 1) && \
    ln -sf "$CURSOR_BIN" /usr/local/bin/cursor-agent && \
    ln -sf "$CURSOR_BIN" /usr/local/bin/agent && \
    cursor-agent --version

COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/templates /app/templates

# Writable dirs: git clones, opencode provider cache, agent config, cursor data
RUN mkdir -p /tmp/orbit-docs-repositories /home/nodejs/.config/opencode /home/nodejs/.cursor /home/nodejs/.local/share && \
    chown -R nodejs:nodejs /app/.output /app/templates /tmp/orbit-docs-repositories /usr/local/bun /home/nodejs && \
    chmod -R u+rwx /home/nodejs/.local

USER nodejs

EXPOSE 3000

ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
ENV HOME=/home/nodejs
ENV PATH="/home/nodejs/.local/bin:/usr/local/bin:${PATH}"
# OPENCODE_CONFIG_B64 is injected at runtime via docker-compose / .env
# CURSOR_API_KEY is injected at runtime via docker-compose / .env when DOC_AGENT=cursor

CMD ["node", ".output/server/index.mjs"]
