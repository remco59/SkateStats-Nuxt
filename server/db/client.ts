import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Single shared connection for the whole process (Nitro runs one process
 * per container). better-sqlite3 is synchronous, so no pooling is needed.
 */
export function useDb() {
  if (dbInstance) return dbInstance

  const config = useRuntimeConfig()
  const dbPath = config.dbPath

  const dir = dirname(dbPath)
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  dbInstance = drizzle(sqlite, { schema })
  migrate(dbInstance, { migrationsFolder: './server/db/migrations' })

  return dbInstance
}

export type Db = ReturnType<typeof useDb>
