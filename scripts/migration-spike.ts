#!/usr/bin/env tsx
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../server/db/schema'
import { migrateOldDatabase } from '../server/utils/migration'
import { createSyntheticOldDb } from './lib/synthetic-old-db'

/**
 * v1 -> v2 migration script (REBUILD_PLAN.md section 9 / Phase 8).
 *
 * Usage:
 *   npm run migration-spike -- <path-to-old-sqlite-file> [path-to-new-sqlite-file]
 *   npm run migration-spike                                  # runs against a synthetic fixture instead
 *
 * Rollback story: this script only ever READS the old SQLite file (opened
 * `readonly`) and only ever WRITES into a brand-new database file (or an
 * in-memory one for the synthetic run) -- so "rollback" is just "point the
 * new app back at nothing / re-run this script", never "undo a write
 * against the old production file."
 */
async function main() {
  const oldDbPathArg = process.argv[2]
  const newDbPathArg = process.argv[3]

  let oldDb: Database.Database
  let usingSynthetic = false

  if (oldDbPathArg && existsSync(oldDbPathArg)) {
    oldDb = new Database(oldDbPathArg, { readonly: true, fileMustExist: true })
  } else {
    if (oldDbPathArg) {
      console.warn(`Old DB path "${oldDbPathArg}" does not exist -- falling back to a synthetic fixture.`)
    } else {
      console.warn(
        'No old DB path given -- running against a synthetic fixture. ' +
          'Pass a real old-app SQLite file path to run an actual migration: ' +
          'npm run migration-spike -- /path/to/skatestats.db',
      )
    }
    usingSynthetic = true
    oldDb = createSyntheticOldDb()
  }

  const newDbPath = newDbPathArg ?? join(mkdtempSync(join(tmpdir(), 'skatestats-migration-')), 'new.db')
  const newSqlite = new Database(newDbPath)
  newSqlite.pragma('foreign_keys = ON')
  const newDb = drizzle(newSqlite, { schema })
  migrate(newDb, { migrationsFolder: './server/db/migrations' })

  const report = migrateOldDatabase(oldDb, newDb)

  console.log(`\n${usingSynthetic ? '[SYNTHETIC FIXTURE]' : '[REAL OLD DB]'} Migration report`)
  console.log(`New database written to: ${newDbPath}\n`)
  console.log('Row counts (before -> after):')
  for (const key of Object.keys(report.before) as (keyof typeof report.before)[]) {
    const match = report.before[key] === report.after[key] ? 'OK' : 'MISMATCH'
    console.log(`  ${key.padEnd(18)} ${report.before[key]} -> ${report.after[key]}  [${match}]`)
  }

  if (report.issues.length) {
    console.log(`\n${report.issues.length} issue(s) found (rows that did not map cleanly):`)
    for (const issue of report.issues) {
      console.log(`  [${issue.table}#${issue.rowId}] ${issue.message}`)
    }
  } else {
    console.log('\nNo mapping issues found.')
  }

  oldDb.close()
  newSqlite.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
