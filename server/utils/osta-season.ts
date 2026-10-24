import { z } from 'zod'

/**
 * OSTA seasons are the starting year ("2025") or ALL for every season; the
 * value goes straight into OSTA's `Seizoen` parameter. Same rule as the old
 * app's normalize_osta_season, which upper-cased the input.
 */
export const ostaSeasonSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^(\d{4}|ALL)$/, 'OSTA seizoen moet een startjaar zijn, bijvoorbeeld 2025, of ALL.')
