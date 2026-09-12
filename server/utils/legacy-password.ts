import { pbkdf2Sync, timingSafeEqual } from 'node:crypto'

/**
 * The old app (app/main.py::hash_password) hashed passwords itself rather
 * than using a library, as `pbkdf2_sha256$<iterations>$<salt_hex>$<digest_hex>`
 * (PBKDF2-HMAC-SHA256). The new app uses nuxt-auth-utils' scrypt-based
 * hashPassword/verifyPassword, which can't verify this format, so migrated
 * accounts need this compat layer instead of a forced password reset.
 */
export function isLegacyPasswordHash(hash: string): boolean {
  return hash.startsWith('pbkdf2_sha256$')
}

export function verifyLegacyPassword(hash: string, password: string): boolean {
  const parts = hash.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false
  const iterations = Number(parts[1])
  const salt = Buffer.from(parts[2]!, 'hex')
  const expected = Buffer.from(parts[3]!, 'hex')
  if (!Number.isInteger(iterations) || iterations <= 0 || salt.length === 0 || expected.length === 0) {
    return false
  }
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, 'sha256')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
