import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { RACE_STATUSES, RACE_TAGS } from '../../shared/constants'

export { RACE_STATUSES, RACE_TAGS }

// Schema per REBUILD_PLAN.md section 7. Field/table names deliberately
// close to the old app's where there's no reason to diverge, so
// reference/fixtures/backup/export_sample.json (old-app shape) maps
// onto this with a thin translation layer rather than a rewrite.

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  skaterName: text('skater_name').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  themePreference: text('theme_preference').notNull().default('dark'), // dark | light | system
  motionPreference: text('motion_preference').notNull().default('all'), // all | reduced
  // Bumped on password change/reset and on account deletion so every other
  // active session for this account is invalidated (plan section 8).
  sessionVersion: integer('session_version').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
  lastLoginAt: text('last_login_at'),
})

// A user can link MULTIPLE OSTA profiles (plan section 7 -- replaces the
// old single osta_pid column).
export const ostaProfileLinks = sqliteTable(
  'osta_profile_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pid: text('pid').notNull(),
    searchName: text('search_name').notNull(),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    monitorMode: text('monitor_mode').notNull().default('notify'), // notify | auto_import | off
    season: text('season').notNull(),
    lastCheckedAt: text('last_checked_at'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('idx_osta_link_user_pid').on(t.userId, t.pid), index('idx_osta_link_user').on(t.userId)],
)

export const competitions = sqliteTable(
  'competitions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    venue: text('venue'),
    date: text('date').notNull(), // YYYY-MM-DD
    notes: text('notes'),
    source: text('source').notNull().default('manual'), // manual | osta | ssr | pdf
    sourceMeta: text('source_meta', { mode: 'json' }).$type<Record<string, unknown> | null>(),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [
    index('idx_competition_user').on(t.userId),
    index('idx_competition_user_date').on(t.userId, t.date),
  ],
)

export const races = sqliteTable(
  'races',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    competitionId: integer('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    distanceM: integer('distance_m').notNull(),
    // Replaces the old boolean `dnf` (plan section 5.6 / 7).
    status: text('status').notNull().default('finished'), // RaceStatus
    totalTimeMs: integer('total_time_ms'), // null whenever status != finished
    trackType: text('track_type').notNull().default('indoor'), // indoor | outdoor
    lane: text('lane'),
    opponent: text('opponent'),
    category: text('category'),
    className: text('class_name'),
    tag: text('tag'), // RaceTag | null
    notes: text('notes'),
    source: text('source').notNull().default('manual'), // manual | osta | ssr | pdf
    sourceRef: text('source_ref'),
    // Explicit tiebreaker for same-day races (plan section 5.4) -- replaces
    // relying on DB insertion `id` order for PR/SB attribution.
    sequenceInDay: integer('sequence_in_day').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [
    index('idx_race_competition').on(t.competitionId),
    index('idx_race_user').on(t.userId),
    index('idx_race_user_distance').on(t.userId, t.distanceM),
  ],
)

// Replaces the old `laps_csv` TEXT column with structured, typed rows
// (plan section 7).
export const raceLaps = sqliteTable(
  'race_laps',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    raceId: integer('race_id')
      .notNull()
      .references(() => races.id, { onDelete: 'cascade' }),
    lapIndex: integer('lap_index').notNull(), // 1-based
    lapMs: integer('lap_ms').notNull(),
  },
  (t) => [uniqueIndex('idx_race_lap_unique').on(t.raceId, t.lapIndex)],
)

export const targets = sqliteTable(
  'targets',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    distanceM: integer('distance_m').notNull(),
    targetTimeMs: integer('target_time_ms'),
    generatorProfileJson: text('generator_profile_json', { mode: 'json' }).$type<Record<
      string,
      unknown
    > | null>(),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('idx_target_user_distance').on(t.userId, t.distanceM)],
)

// Competition-level blacklist: "delete and blacklist this whole competition"
export const blacklist = sqliteTable(
  'blacklist',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    signature: text('signature').notNull(),
    competitionName: text('competition_name').notNull(),
    competitionDate: text('competition_date').notNull(),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [uniqueIndex('idx_blacklist_user_signature').on(t.userId, t.signature)],
)

// Race-level blacklist (plan section 6 rule 4): deleting ONE race from a
// kept competition must not blacklist the whole competition, but the next
// import of that competition must not silently re-add just that race.
export const raceBlacklist = sqliteTable(
  'race_blacklist',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    competitionSignature: text('competition_signature').notNull(),
    raceIdentitySignature: text('race_identity_signature').notNull(),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  },
  (t) => [
    uniqueIndex('idx_race_blacklist_unique').on(t.userId, t.competitionSignature, t.raceIdentitySignature),
  ],
)

export const importPreviewBatches = sqliteTable(
  'import_preview_batches',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // osta | ssr | pdf
    payloadJson: text('payload_json', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
    createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
    expiresAt: text('expires_at'),
  },
  (t) => [index('idx_import_preview_user').on(t.userId)],
)
