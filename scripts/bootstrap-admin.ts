/**
 * CLI admin bootstrap/reset -- kept CLI-driven (plan section 11, open
 * question 3), mirroring the old app's `set-password` command.
 *
 * Usage (inside the container):
 *   npx tsx scripts/bootstrap-admin.ts <username> "<Skater Name>" <password>
 *
 * Creates the user if it doesn't exist (as admin), or resets its password
 * and bumps session_version (invalidating any existing sessions) if it
 * does.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { eq } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../server/db/schema'

async function main() {
  const [username, skaterName, password] = process.argv.slice(2)
  if (!username || !skaterName || !password) {
    console.error('Usage: bootstrap-admin.ts <username> "<Skater Name>" <password>')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const dbPath = process.env.SKATESTATS_DB || './data/skatestats.sqlite'
  const dir = dirname(dbPath)
  if (dir && dir !== '.' && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  const sqlite = new Database(dbPath)
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './server/db/migrations' })

  // Uses the same @adonisjs/hash Scrypt driver nuxt-auth-utils uses under
  // the hood, with its default options -- this MUST stay in sync with any
  // `hash.scrypt` runtimeConfig override added to nuxt.config.ts later.
  const hash = new Hash(new Scrypt())
  const passwordHash = await hash.make(password)
  const now = new Date().toISOString()
  const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get()

  if (existing) {
    db.update(schema.users)
      .set({ passwordHash, sessionVersion: existing.sessionVersion + 1, updatedAt: now })
      .where(eq(schema.users.id, existing.id))
      .run()
    console.log(`Updated password for existing user "${username}".`)
  } else {
    db.insert(schema.users)
      .values({
        username,
        skaterName,
        passwordHash,
        isAdmin: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    console.log(`Created admin user "${username}".`)
  }

  sqlite.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
