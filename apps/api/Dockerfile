# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /repo

# Prisma needs openssl + ca-certs at install time to download the right binary
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy monorepo manifests for dependency caching
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY shared shared
COPY database database

# Install all workspaces (dev deps needed for build)
RUN npm install --include=dev

# Generate Prisma client and build the API
COPY apps/api apps/api
RUN npx --workspace apps/api prisma generate --schema=../../database/schema/schema.prisma || true
RUN npm run build --workspace apps/api

# ---- runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime libs Prisma needs + wget for the healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*

# Copy only what the runtime needs
COPY --from=build /repo/node_modules /app/node_modules
COPY --from=build /repo/apps/api/dist /app/dist
COPY --from=build /repo/apps/api/package.json /app/package.json
COPY --from=build /repo/shared /app/shared
COPY --from=build /repo/database /app/database

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

# nest build emits to dist/apps/api/src/ because tsconfig rootDir spans the monorepo
CMD ["node", "dist/apps/api/src/main.js"]
