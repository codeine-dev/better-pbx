import type { DatabaseSync } from 'node:sqlite';

export interface Ban {
  ip: string;
  reason: string | null;
  source: string;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
}

export function addBan(db: DatabaseSync, ban: { ip: string; reason?: string; source: string; expiresAt?: string | null }): Ban {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO bans (ip, reason, source, created_at, expires_at, active)
     VALUES (?,?,?,?,?,1)
     ON CONFLICT(ip) DO UPDATE SET reason=excluded.reason, source=excluded.source,
       created_at=excluded.created_at, expires_at=excluded.expires_at, active=1`,
  ).run(ban.ip, ban.reason ?? null, ban.source, createdAt, ban.expiresAt ?? null);
  return getBan(db, ban.ip)!;
}

export function getBan(db: DatabaseSync, ip: string): Ban | null {
  const row = db
    .prepare('SELECT ip, reason, source, created_at, expires_at, active FROM bans WHERE ip = ?')
    .get(ip) as
    | { ip: string; reason: string | null; source: string; created_at: string; expires_at: string | null; active: number }
    | undefined;
  if (!row) return null;
  return {
    ip: row.ip,
    reason: row.reason,
    source: row.source,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    active: row.active === 1,
  };
}

export function listBans(db: DatabaseSync, activeOnly = true): Ban[] {
  const sql = activeOnly
    ? 'SELECT ip, reason, source, created_at, expires_at, active FROM bans WHERE active = 1 ORDER BY created_at DESC'
    : 'SELECT ip, reason, source, created_at, expires_at, active FROM bans ORDER BY created_at DESC';
  const rows = db.prepare(sql).all() as Array<{
    ip: string;
    reason: string | null;
    source: string;
    created_at: string;
    expires_at: string | null;
    active: number;
  }>;
  return rows.map((r) => ({
    ip: r.ip,
    reason: r.reason,
    source: r.source,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    active: r.active === 1,
  }));
}

export function removeBan(db: DatabaseSync, ip: string): boolean {
  const res = db.prepare('UPDATE bans SET active = 0 WHERE ip = ?').run(ip);
  return Number(res.changes) > 0;
}

export function sweepExpired(db: DatabaseSync, now = new Date()): number {
  const iso = now.toISOString();
  const res = db
    .prepare('UPDATE bans SET active = 0 WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?')
    .run(iso);
  return Number(res.changes);
}