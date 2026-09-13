// Tiny HTTP listener, no framework/deps: this image only needs to run two
// commands on request, so pulling in express etc. is more surface than the
// job needs. Reachable only from the compose-internal network (no `ports:`
// entry in docker-compose.yml), and even there every request must present
// UPDATER_SECRET -- exec'ing `git pull` + `docker compose up --build`
// against the host socket is equivalent to root on the host, so this must
// never be reachable without it.
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'

const PORT = Number(process.env.PORT) || 4001
const REPO_DIR = process.env.REPO_DIR || '/repo'
const APP_SERVICE = process.env.APP_SERVICE || 'skatestats'
const SECRET = process.env.UPDATER_SECRET || ''

function run(command, args, cwd) {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, timeout: 5 * 60 * 1000 }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code ?? 0, stdout, stderr })
    })
  })
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/update') {
    res.writeHead(404).end()
    return
  }

  // Fail closed: an empty/unset secret must never be treated as "no auth
  // required", or a misconfigured deploy would leave this wide open.
  if (!SECRET || req.headers['x-updater-secret'] !== SECRET) {
    res.writeHead(401).end()
    return
  }

  const pull = await run('git', ['pull', '--ff-only'], REPO_DIR)
  if (!pull.ok) {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, step: 'git pull', ...pull }))
    return
  }

  const build = await run(
    'docker',
    ['compose', '-f', `${REPO_DIR}/docker-compose.yml`, 'up', '-d', '--build', APP_SERVICE],
    REPO_DIR,
  )

  res.writeHead(build.ok ? 200 : 502, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ ok: build.ok, step: 'docker compose up', pull, build }))
})

server.listen(PORT, () => {
  console.log(`updater listening on :${PORT}`)
})
