# Web app image (Next.js standalone). Build context: repository root.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://example.org -t judhur-web .
# The build needs no API or data: every page renders on first request and is cached (ISR).

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter web...

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web ./apps/web
# Inlined into the client bundle and the /api/v1 rewrite at build time.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG JUDHUR_API_ORIGIN=http://api:8000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL JUDHUR_API_ORIGIN=$JUDHUR_API_ORIGIN NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Bind on all interfaces. Docker sets HOSTNAME to the container id; left like that, the locale proxy
# rewrites to a host the server does not recognise and every Arabic page redirect-loops (DECISIONS).
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", "server.js"]
