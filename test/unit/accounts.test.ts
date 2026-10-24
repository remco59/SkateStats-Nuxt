import { describe, expect, it } from 'vitest'
import { createTestDb, seedUser } from './helpers/test-db'
import {
  AccountError,
  assertSkaterNameFree,
  assertTypedUsername,
  assertUsernameFree,
  checkNewPassword,
  createUserAccount,
  listUserAccounts,
} from '../../server/utils/accounts'

const message = (fn: () => void) => {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(AccountError)
    return (err as AccountError).message
  }
  return null
}

describe('new passwords', () => {
  it('needs 8 characters, and the confirmation when given', () => {
    expect(message(() => checkNewPassword('short'))).toBe('Wachtwoorden moeten minimaal 8 tekens lang zijn.')
    expect(message(() => checkNewPassword('long-enough', 'long-enough-x'))).toBe('De ingevulde wachtwoorden komen niet overeen.')
    expect(message(() => checkNewPassword('long-enough', 'long-enough'))).toBeNull()
    expect(message(() => checkNewPassword('long-enough'))).toBeNull()
  })

  it('checks the length before the confirmation, like the old app', () => {
    expect(message(() => checkNewPassword('abc', 'different'))).toMatch(/minimaal 8/)
  })
})

describe('username and skater name', () => {
  it('rejects a username or skater name that belongs to someone else', () => {
    const db = createTestDb()
    const user = seedUser(db) // username "test", skater "Test Skater"

    expect(message(() => assertUsernameFree(db, 'test'))).toBe('Deze gebruikersnaam bestaat al.')
    expect(message(() => assertSkaterNameFree(db, 'Test Skater'))).toBe('Deze schaatsersnaam is al gekoppeld aan een ander account.')
    // ...but your own is fine when you save the form unchanged.
    expect(message(() => assertUsernameFree(db, 'test', user.id))).toBeNull()
    expect(message(() => assertSkaterNameFree(db, 'Test Skater', user.id))).toBeNull()
    expect(message(() => assertUsernameFree(db, 'someone-else'))).toBeNull()
  })

  it('creates a user after those checks and trims the names', () => {
    const db = createTestDb()
    seedUser(db)

    const created = createUserAccount(db, { username: '  anna ', skaterName: ' Anna A ', passwordHash: 'h', isAdmin: true })
    expect(created).toMatchObject({ username: 'anna', skaterName: 'Anna A', isAdmin: true })

    expect(message(() => createUserAccount(db, { username: 'anna', skaterName: 'Other', passwordHash: 'h', isAdmin: false }))).toBe('Deze gebruikersnaam bestaat al.')
    expect(message(() => createUserAccount(db, { username: 'bob', skaterName: 'Anna A', passwordHash: 'h', isAdmin: false }))).toMatch(/schaatsersnaam is al gekoppeld/)
    expect(message(() => createUserAccount(db, { username: ' ', skaterName: 'X', passwordHash: 'h', isAdmin: false }))).toMatch(/verplicht/)
    expect(listUserAccounts(db).map((u) => u.username)).toEqual(['anna', 'test'])
  })
})

describe('typed confirmation before deleting', () => {
  it('must be the username, exactly (surrounding spaces are ignored)', () => {
    expect(message(() => assertTypedUsername('Anna', 'anna', 'fout'))).toBe('fout')
    expect(message(() => assertTypedUsername(undefined, 'anna', 'fout'))).toBe('fout')
    expect(message(() => assertTypedUsername(' anna ', 'anna', 'fout'))).toBeNull()
  })
})
