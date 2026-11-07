import type { DatabaseSync } from 'node:sqlite';

export interface AuditEntry {
  id: number;
  createdAt: string;
  actor: string;
  action: string;
  target?: string | null;
  commitSha?: string | null;
  details?: unknown;
}

export function recordAudit(
  db: DatabaseSync,
  entry: Omit<AuditEntry, 'id' | 'createdAt'> & { createdAt?: string },
): AuditEntry {
  const createdAt = entry.createdAt ?? new Date().toISOString();
  const details = entry.details === undefined ? null : JSON.stringify(entry.details);
  const stmt = db.prepare(
    'INSERT INTO audit_log (created_at, actor, action, target, commit_sha, details) VALUES (?,?,?,?,?,?)',
  );
  const res = stmt.run(createdAt, entry.actor, entry.action, entry.target ?? null, entry.commitSha ?? null, details);
  return {
    id: Number(res.lastInsertRowid),
    createdAt,
    actor: entry.actor,
    action: entry.action,
    target: entry.target ?? null,
    commitSha: entry.commitSha ?? null,
    details: entry.details,
  };
}

export function listAudit(db: DatabaseSync, limit = 100): AuditEntry[] {
  const rows = db
    .prepare('SELECT id, created_at, actor, action, target, commit_sha, details FROM audit_log ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<{
    id: number;
    created_at: string;
    actor: string;
    action: string;
    target: string | null;
    commit_sha: string | null;
    details: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actor: r.actor,
    action: r.action,
    target: r.target,
    commitSha: r.commit_sha,
    details: r.details ? safeJson(r.details) : null,
  }));
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}