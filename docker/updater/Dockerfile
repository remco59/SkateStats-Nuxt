# Small sidecar with access to the host's Docker socket and the repo's
# working copy, so it -- not the internet-facing skatestats container --
# is the only thing that can run `git pull` / `docker compose up --build`.
# node:22-alpine matches the app image's base so no second toolchain is
# needed to run server.js; docker-cli/docker-cli-compose and git come from
# Alpine's own repos (no daemon here, just the client talking to the
# socket mounted in at runtime).
FROM node:22-alpine
RUN apk add --no-cache docker-cli docker-cli-compose git
WORKDIR /app
COPY server.js ./
EXPOSE 4001
CMD ["node", "server.js"]
