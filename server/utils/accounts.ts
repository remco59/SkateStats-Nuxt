import { and, asc, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client'
import { users } from '../db/schema'

/**
 * Rules for creating and editing accounts, shared by the account page, the admin
 * page and the command line (scripts/users.ts), with the messages of the old
 * app. Hashing is left to the caller: the server uses nuxt-auth-utils, the CLI
 * its own scrypt instance with the same settings.
 */

export const PASSWORD_MIN_LENGTH = 8

export class AccountError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message)
  }
}

/** The new password is long enough and, when a confirmation is given, typed twice the same. */
export function checkNewPassword(password: string, confirmation?: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AccountError(`Wachtwoorden moeten minimaal ${PASSWORD_MIN_LENGTH} tekens lang zijn.`)
  }
  if (confirmation !== undefined && password !== confirmation) {
    throw new AccountError('De ingevulde wachtwoorden komen niet overeen.')
  }
}

export function assertUsernameFree(db: Db, username: string, exceptUserId?: number): void {
  const taken = db
    .select({ id: users.id })
    .from(users)
    .where(exceptUserId ? and(eq(users.username, username), ne(users.id, exceptUserId)) : eq(users.username, username))
    .get()
  if (taken) throw new AccountError('Deze gebruikersnaam bestaat al.', 409)
}

/** One skater name belongs to one account, as in the old app. */
export function assertSkaterNameFree(db: Db, skaterName: string, exceptUserId?: number): void {
  const taken = db
    .select({ id: users.id })
    .from(users)
    .where(exceptUserId ? and(eq(users.skaterName, skaterName), ne(users.id, exceptUserId)) : eq(users.skaterName, skaterName))
    .get()
  if (taken) throw new AccountError('Deze schaatsersnaam is al gekoppeld aan een ander account.', 409)
}

/** The typed confirmation for deleting an account must be the username, exactly. */
export function assertTypedUsername(typed: string | undefined, username: string, message: string): void {
  if ((typed ?? '').trim() !== username) throw new AccountError(message)
}

export interface NewUser {
  username: string
  skaterName: string
  passwordHash: string
  isAdmin: boolean
}

/** Creates a user after the same checks the admin page applies. */
export function createUserAccount(db: Db, input: NewUser) {
  const username = input.username.trim()
  const skaterName = input.skaterName.trim()
  if (!username || !skaterName) {
    throw new AccountError('Gebruikersnaam, schaatsersnaam en wachtwoord zijn verplicht.')
  }
  assertUsernameFree(db, username)
  assertSkaterNameFree(db, skaterName)

  const now = new Date().toISOString()
  return db
    .insert(users)
    .values({ username, skaterName, passwordHash: input.passwordHash, isAdmin: input.isAdmin, createdAt: now, updatedAt: now })
    .returning()
    .get()
}

export function listUserAccounts(db: Db) {
  return db
    .select({ id: users.id, username: users.username, skaterName: users.skaterName, isAdmin: users.isAdmin, lastLoginAt: users.lastLoginAt })
    .from(users)
    .orderBy(asc(users.username))
    .all()
}

/** Turns an AccountError into the HTTP error the pages show; anything else is rethrown. */
export function accountErrorToHttp(err: unknown): never {
  if (err instanceof AccountError) throw createError({ statusCode: err.statusCode, statusMessage: err.message })
  throw err
}
