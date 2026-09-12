import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'

const DB_PATH = './test/e2e/.tmp-e2e.db'

export default function globalSetup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const p = `${DB_PATH}${suffix}`
    if (existsSync(p)) rmSync(p)
  }

  execFileSync('npx', ['tsx', 'scripts/bootstrap-admin.ts', 'e2e-admin', 'E2E Skater', 'e2e-password-123'], {
    env: { ...process.env, SKATESTATS_DB: DB_PATH },
    stdio: 'inherit',
  })
}
