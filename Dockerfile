# ============================================
# AlphaMind Lite - Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# Stage 1: Build & verify
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev 2>/dev/null || true

# Copy application source
COPY . .

# Verify scripts are valid
RUN node -c scripts/demo.js && \
    node -c config/config.js && \
    node -c scripts/server.js

# Stage 2: Production image
FROM node:22-alpine AS production

# Security: add non-root user
RUN addgroup -g 1001 -S alphamind && \
    adduser -S alphamind -u 1001 -G alphamind

# Install runtime dependencies
RUN apk add --no-cache curl tini

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=alphamind:alphamind /app .

# Create required directories
RUN mkdir -p logs data && \
    chown -R alphamind:alphamind logs data

# Switch to non-root user
USER alphamind

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE 3000

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default: run the web server
CMD ["node", "scripts/server.js"]
