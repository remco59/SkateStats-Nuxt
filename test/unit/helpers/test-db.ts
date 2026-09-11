import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../../../server/db/schema'

/** An in-memory, fully-migrated DB for tests that need real SQL (not just pure functions). */
export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './server/db/migrations' })
  return db
}

export function seedUser(db: ReturnType<typeof createTestDb>) {
  const now = new Date().toISOString()
  const user = db
    .insert(schema.users)
    .values({
      username: 'test',
      passwordHash: 'x',
      skaterName: 'Test Skater',
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get()
  return user
}
