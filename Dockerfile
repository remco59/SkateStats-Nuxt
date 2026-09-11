# Node 22 pinned (plan section 8) -- matches the LTS available when Phase 0
# was built; bump deliberately, not by floating the tag.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S skatestats && adduser -S skatestats -G skatestats
# .output is fully self-contained (Nitro bundles all JS deps and copies the
# better-sqlite3 native prebuild into .output/server/node_modules itself).
# node_modules is only needed here for the standalone bootstrap-admin.ts
# script (drizzle-kit/tsx/@adonisjs/hash aren't part of the bundled app).
# Image-size optimization is a Phase 10 concern, not a Phase 0 one.
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /data && chown -R skatestats:skatestats /data /app

USER skatestats
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
