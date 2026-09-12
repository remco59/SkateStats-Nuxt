# Node 22 pinned (plan section 8) -- matches the LTS available when Phase 0
# was built; bump deliberately, not by floating the tag.
FROM node:22-alpine AS build
WORKDIR /app
# @playwright/test (e2e-only, plan Phase 10) would otherwise try to
# download a browser during npm ci -- not needed for the app build itself.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# node_modules as installed above carries every devDependency (drizzle-kit,
# vue-tsc, eslint, playwright, vitest, ...) the running app never needs --
# .output is fully self-contained (Nitro bundles its own runtime deps into
# .output/server/node_modules). The runtime image only needs the root
# node_modules for the standalone bootstrap-admin.ts script, so prune
# devDependencies IN PLACE (not a fresh `npm ci --omit=dev`, which would
# both rebuild better-sqlite3's native binary from scratch needlessly and,
# with --ignore-scripts, fail to build it at all) and keep tsx (itself a
# devDependency) around to execute that one .ts file.
RUN mkdir -p /tmp/keep \
 && cp -r node_modules/tsx node_modules/esbuild node_modules/@esbuild /tmp/keep/ \
 && npm prune --omit=dev \
 && cp -r /tmp/keep/tsx /tmp/keep/esbuild /tmp/keep/@esbuild node_modules/ \
 && ln -sf ../tsx/dist/cli.mjs node_modules/.bin/tsx

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S skatestats && adduser -S skatestats -G skatestats
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /data && chown -R skatestats:skatestats /data /app

USER skatestats
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
