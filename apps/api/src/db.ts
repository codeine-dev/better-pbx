import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Db {
  db: DatabaseSync;
  close(): void;
}

const MIGRATIONS: Array<(db: DatabaseSync) => void> = [
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        remember INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        commit_sha TEXT,
        details TEXT
      );
      CREATE TABLE IF NOT EXISTS cdr_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uniqueid TEXT,
        calldate TEXT,
        src TEXT,
        dst TEXT,
        duration REAL,
        disposition TEXT,
        raw TEXT
      );
      CREATE TABLE IF NOT EXISTS bans (
        ip TEXT PRIMARY KEY,
        reason TEXT,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    `);
  },
];

export function openDb(dbPath: string): Db {
  const dir = join(dbPath, '..');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  let current = 0;
  try {
    const version = getMeta(db, 'schema_version');
    current = version ? Number(version) : 0;
  } catch {
    current = 0;
  }
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN;');
    try {
      const migration = MIGRATIONS[i];
      if (!migration) throw new Error('missing migration');
      migration(db);
      setMeta(db, 'schema_version', String(i + 1));
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }
  }
  return { db, close: () => db.close() };
}

function getMeta(db: DatabaseSync, key: string): string | null {
  const stmt = db.prepare('SELECT value FROM meta WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}

export { getMeta, setMeta };