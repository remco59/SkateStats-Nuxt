import Database from 'better-sqlite3'

/**
 * Builds an in-memory SQLite database matching the OLD app's schema
 * (app/main.py::init_db/migrate_db, commit 4dc6959), seeded with rows that
 * exercise the known migration edge cases: a DNF race that also carries a
 * stale total_time_ms, an "outdoor" tag (now a track_type, not a tag), an
 * unknown tag_key, and a laps_csv value that doesn't round-trip cleanly.
 *
 * No real old-app production database is available in this environment
 * (this is a from-scratch rebuild sandbox, not the user's actual server),
 * so this synthetic fixture is what proves the migration script end-to-end.
 * Running it against real production data is Phase 8's actual deliverable
 * per REBUILD_PLAN.md section 9 -- documented as a limitation, not glossed
 * over.
 */
export function createSyntheticOldDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE skater (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      skater_id INTEGER NOT NULL UNIQUE REFERENCES skater(id),
      is_admin INTEGER DEFAULT 0,
      theme_preference TEXT DEFAULT 'dark',
      motion_preference TEXT DEFAULT 'all',
      created_at TEXT,
      updated_at TEXT,
      last_login_at TEXT,
      session_version INTEGER DEFAULT 1
    );
    CREATE TABLE competition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      venue TEXT,
      competition_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      owner_user_id INTEGER REFERENCES user(id)
    );
    CREATE TABLE race (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL REFERENCES competition(id) ON DELETE CASCADE,
      skater_id INTEGER NOT NULL REFERENCES skater(id),
      distance_m INTEGER NOT NULL,
      category TEXT,
      class_name TEXT,
      tag_key TEXT,
      lane TEXT,
      opponent TEXT,
      total_time_ms INTEGER,
      laps_csv TEXT,
      dnf INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT
    );
    CREATE TABLE goal_target (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      distance_m INTEGER NOT NULL,
      target_time_ms INTEGER,
      target_opening_ms INTEGER,
      target_avg_400_ms INTEGER,
      target_last_400_ms INTEGER,
      target_fade_400_ms INTEGER,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(user_id, distance_m)
    );
    CREATE TABLE osta_monitor_config (
      user_id INTEGER PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
      search_name TEXT NOT NULL,
      pid TEXT DEFAULT '',
      mode TEXT DEFAULT 'notify',
      season TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE osta_import_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      comp_signature TEXT NOT NULL,
      comp_name TEXT NOT NULL,
      comp_date TEXT NOT NULL,
      pid TEXT,
      race_count INTEGER DEFAULT 0,
      created_at TEXT,
      UNIQUE(user_id, comp_signature)
    );
  `)

  const now = '2024-01-01T00:00:00'

  db.prepare('INSERT INTO skater (id, name) VALUES (1, ?)').run('Remco')
  db.prepare(
    'INSERT INTO user (id, username, password_hash, skater_id, is_admin, created_at, updated_at, session_version) VALUES (1, ?, ?, 1, 1, ?, ?, 1)',
  ).run('remco', 'pbkdf2_sha256$600000$aabbccdd$eeff00112233', now, now)

  db.prepare(
    'INSERT INTO competition (id, name, venue, competition_date, notes, created_at, owner_user_id) VALUES (1, ?, ?, ?, NULL, ?, 1)',
  ).run('Wintercup 1', 'Thialf', '2024-01-15', now)
  // A second competition with no owner_user_id set (pre-migration-column
  // legacy row) -- owner must be derived from its races' skater_id instead.
  db.prepare(
    'INSERT INTO competition (id, name, venue, competition_date, notes, created_at, owner_user_id) VALUES (2, ?, ?, ?, NULL, ?, NULL)',
  ).run('Clubkampioenschap', 'Jaap Eden', '2024-02-10', now)

  // Clean finished race with clean laps.
  db.prepare(
    `INSERT INTO race (id, competition_id, skater_id, distance_m, category, class_name, tag_key, lane, opponent, total_time_ms, laps_csv, dnf, notes, created_at)
     VALUES (1, 1, 1, 500, 'Senioren', NULL, NULL, 'binnen', 'Jan', 41230, '20.10,21.13', 0, NULL, ?)`,
  ).run(now)
  // DNF race that (buggy old data) still carries a total_time_ms.
  db.prepare(
    `INSERT INTO race (id, competition_id, skater_id, distance_m, category, class_name, tag_key, lane, opponent, total_time_ms, laps_csv, dnf, notes, created_at)
     VALUES (2, 1, 1, 1500, NULL, NULL, NULL, 'buiten', NULL, 130000, NULL, 1, 'gevallen in bocht', ?)`,
  ).run(now)
  // "outdoor" tag_key -> must become track_type=outdoor, not a carried-over tag.
  db.prepare(
    `INSERT INTO race (id, competition_id, skater_id, distance_m, category, class_name, tag_key, lane, opponent, total_time_ms, laps_csv, dnf, notes, created_at)
     VALUES (3, 2, 1, 3000, NULL, NULL, 'outdoor', NULL, NULL, 260000, '43.33,43.34,43.33,43.34,43.33,43.33,43.33,43.34', 0, NULL, ?)`,
  ).run(now)
  // Unknown/legacy tag_key that no longer exists in the new schema.
  db.prepare(
    `INSERT INTO race (id, competition_id, skater_id, distance_m, category, class_name, tag_key, lane, opponent, total_time_ms, laps_csv, dnf, notes, created_at)
     VALUES (4, 2, 1, 500, NULL, NULL, 'some_removed_tag', NULL, NULL, 40500, NULL, 0, NULL, ?)`,
  ).run(now)
  // laps_csv with a value that does not round-trip to a clean millisecond figure.
  db.prepare(
    `INSERT INTO race (id, competition_id, skater_id, distance_m, category, class_name, tag_key, lane, opponent, total_time_ms, laps_csv, dnf, notes, created_at)
     VALUES (5, 2, 1, 1000, NULL, NULL, NULL, NULL, NULL, 82000, '41.005,40.995', 0, NULL, ?)`,
  ).run(now)

  db.prepare(
    'INSERT INTO goal_target (id, user_id, distance_m, target_time_ms, target_opening_ms, notes, created_at, updated_at) VALUES (1, 1, 500, 40000, 10500, NULL, ?, ?)',
  ).run(now, now)

  db.prepare(
    "INSERT INTO osta_monitor_config (user_id, search_name, pid, mode, season, updated_at) VALUES (1, 'Remco', '12345', 'notify', '2024', ?)",
  ).run(now)

  db.prepare(
    "INSERT INTO osta_import_blacklist (id, user_id, comp_signature, comp_name, comp_date, pid, race_count, created_at) VALUES (1, 1, '2023-12-01|oud toernooi', 'Oud Toernooi', '2023-12-01', NULL, 2, ?)",
  ).run(now)

  return db
}
