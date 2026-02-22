FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ src/
COPY bin/ bin/

# Claude Code CLI is required — install globally
RUN bun add -g @anthropic-ai/claude-code

EXPOSE 3456

# Health check against the root endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:3456/ || exit 1

ENTRYPOINT ["bun", "run", "./bin/claude-sdk-proxy.ts"]
CMD ["--host", "0.0.0.0"]
