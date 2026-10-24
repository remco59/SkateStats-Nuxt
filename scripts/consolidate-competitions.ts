/**
 * Merges competitions that were split by differing titles (e.g. "Herfstcup
 * uitslag 05-10-2025" and "Herfstcup"), like the old app did on every start.
 * It is a separate, explicit step here: merging deletes rows, so it shows what
 * it would do first.
 *
 * Usage:
 *   npx tsx scripts/consolidate-competitions.ts            # show what would be merged
 *   npx tsx scripts/consolidate-competitions.ts --apply    # merge
 *
 * Database: SKATESTATS_DB (default ./data/skatestats.sqlite). Back it up first.
 */
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../server/db/schema'
import { consolidateDuplicateCompetitions } from '../server/utils/competition-merge'

const dbPath = process.env.SKATESTATS_DB || './data/skatestats.sqlite'
if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`)
  process.exit(1)
}

const apply = process.argv.includes('--apply')
const sqlite = new Database(dbPath)
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })

const result = consolidateDuplicateCompetitions(db, { dryRun: !apply })

if (!result.groups.length) {
  console.log('No duplicate competitions found.')
} else {
  for (const group of result.groups) {
    console.log(`#${group.survivorId} "${group.survivorName}" <- ${group.mergedIds.map((id) => `#${id}`).join(', ')}`)
  }
  console.log(
    `\n${apply ? 'Merged' : 'Would merge'} ${result.mergedCompetitions} competitions: ` +
      `${result.movedRaces} races moved, ${result.removedDuplicateRaces} duplicate races removed.`,
  )
  if (!apply) console.log('Run again with --apply to do it.')
}
sqlite.close()
