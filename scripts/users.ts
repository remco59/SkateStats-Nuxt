/**
 * User administration from the shell, like the old app's `main.py list-users |
 * create-user | set-password`.
 *
 * Usage (inside the container):
 *   npx tsx scripts/users.ts list-users
 *   npx tsx scripts/users.ts create-user <username> "<Skater Name>" [password] [--admin]
 *   npx tsx scripts/users.ts set-password <username> [password]
 *
 * Without a password argument you are asked for one (hidden) and to repeat it.
 * `set-password` also signs the user out everywhere. The first admin is still
 * created with scripts/bootstrap-admin.ts.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { eq } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../server/db/schema'
import { AccountError, checkNewPassword, createUserAccount, listUserAccounts } from '../server/utils/accounts'

/**
 * Asks for a password and its confirmation on one readline interface (a second
 * interface would miss lines already buffered from piped input). Typing is not
 * echoed when running in a terminal.
 */
async function promptPassword(): Promise<string> {
  const interactive = Boolean(process.stdin.isTTY)
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive })
  if (interactive) {
    ;(rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {}
  }
  const lines = rl[Symbol.asyncIterator]()
  const ask = async (label: string) => {
    process.stdout.write(label)
    const line = await lines.next()
    if (interactive) process.stdout.write('\n')
    return line.done ? '' : line.value
  }
  try {
    const first = await ask('Password: ')
    const second = await ask('Confirm password: ')
    checkNewPassword(first, second)
    return first
  } finally {
    rl.close()
  }
}

async function passwordFrom(argument: string | undefined): Promise<string> {
  return argument || promptPassword()
}

// Uses the same @adonisjs/hash Scrypt driver nuxt-auth-utils uses under the
// hood, with its default options -- keep in sync with bootstrap-admin.ts.
const hasher = new Hash(new Scrypt())

function openDb() {
  const dbPath = process.env.SKATESTATS_DB || './data/skatestats.sqlite'
  const dir = dirname(dbPath)
  if (dir && dir !== '.' && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  const sqlite = new Database(dbPath)
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './server/db/migrations' })
  return { db, close: () => sqlite.close() }
}

const USAGE = `Usage:
  users.ts list-users
  users.ts create-user <username> "<Skater Name>" [password] [--admin]
  users.ts set-password <username> [password]`

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const isAdmin = args.includes('--admin')
  const [command, ...rest] = args.filter((a) => a !== '--admin')
  const { db, close } = openDb()

  try {
    if (command === 'list-users') {
      for (const u of listUserAccounts(db)) {
        console.log(`${u.username.padEnd(20)} ${u.skaterName.padEnd(28)} ${u.isAdmin ? 'admin' : 'user '}  ${u.lastLoginAt ?? 'never signed in'}`)
      }
      return 0
    }

    if (command === 'create-user') {
      const [username, skaterName, password] = rest
      if (!username || !skaterName) {
        console.error(USAGE)
        return 1
      }
      const chosen = await passwordFrom(password)
      checkNewPassword(chosen)
      createUserAccount(db, { username, skaterName, passwordHash: await hasher.make(chosen), isAdmin })
      console.log(`Created user '${username.trim()}'.`)
      return 0
    }

    if (command === 'set-password') {
      const [username, password] = rest
      if (!username) {
        console.error(USAGE)
        return 1
      }
      const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get()
      if (!user) {
        console.error(`User '${username}' not found.`)
        return 1
      }
      const chosen = await passwordFrom(password)
      checkNewPassword(chosen)
      db.update(schema.users)
        .set({ passwordHash: await hasher.make(chosen), sessionVersion: user.sessionVersion + 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.users.id, user.id))
        .run()
      console.log(`Updated password for '${username}'.`)
      return 0
    }

    console.error(USAGE)
    return 1
  } catch (err) {
    if (err instanceof AccountError) {
      console.error(err.message)
      return 1
    }
    throw err
  } finally {
    close()
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(1)
  },
)
