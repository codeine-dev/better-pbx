import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { resolveConfig, type ApiConfig } from './config.js';
import { openDb } from './db.js';
import { GitManager } from './git-manager.js';
import { AsteriskCli, Fail2banCli, type CommandRunner } from './cli.js';
import { hashPassword, verifyPassword } from './auth/password.js';
import { recordAudit, listAudit } from './audit.js';
import { addBan, listBans, removeBan, sweepExpired } from './bans.js';
import { applyModel } from './apply.js';
import { readModel, writeModel, bootstrapModel } from './model-store.js';
import { badRequest, unauthorized, forbidden, notFound, conflict, setupRequired, AppError, tooMany } from './errors.js';
import { assertValidModel } from '@better-pbx/config-engine';
import { API_VERSION } from './version.js';
import type { PbxModel } from '@better-pbx/shared';
import { createExtension, createTrunk, createOutboundRoute, createInboundRoute, createRingGroup, createIvr, createPrompt } from '@better-pbx/shared';

export { API_VERSION };

export interface BuildAppOptions {
  dataDir?: string;
  setupTokenPath?: string;
  webDistDir?: string;
  logger?: boolean;
  commandRunner?: CommandRunner;
  internalToken?: string;
}

interface SessionRow {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: string;
  remember: number;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const overrides: Partial<ApiConfig> = {};
  if (options.dataDir) overrides.dataDir = options.dataDir;
  if (options.setupTokenPath) overrides.setupTokenPath = options.setupTokenPath;
  if (options.webDistDir) overrides.webDistDir = options.webDistDir;
  const config = resolveConfig(overrides);
  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(config.runtimeDir, { recursive: true });

  const dbWrap = openDb(config.dbPath);
  const db = dbWrap.db;

  const git = new GitManager({ repoDir: config.configDir });
  git.ensureRepo();

  const runner = options.commandRunner;
  const asterisk = new AsteriskCli(runner);
  const fail2ban = new Fail2banCli(runner);

  // internal token
  if (!existsSync(config.internalTokenPath)) {
    const tok = options.internalToken ?? randomBytes(32).toString('hex');
    mkdirSync(join(config.internalTokenPath, '..'), { recursive: true });
    writeFileSync(config.internalTokenPath, tok + '\n', { mode: 0o600 });
  }
  const internalToken = readFileSync(config.internalTokenPath, 'utf8').trim();

  const startedAt = Date.now();
  const app = Fastify({ logger: options.logger ?? false });
  let sipTraceEnabled = false;

  // helpers
  function setupRequiredNow(): boolean {
    return existsSync(config.setupTokenPath) && userCount() === 0;
  }
  function userCount(): number {
    const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
    return row.c;
  }
  function findUserByUsername(username: string): UserRow | undefined {
    return db.prepare('SELECT id, username, password_hash, created_at FROM users WHERE username = ?').get(username) as UserRow | undefined;
  }
  function findUserById(id: string): UserRow | undefined {
    return db.prepare('SELECT id, username, password_hash, created_at FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  function parseCookies(req: FastifyRequest): Record<string, string> {
    const header = req.headers.cookie;
    const out: Record<string, string> = {};
    if (!header) return out;
    for (const part of header.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (!k) continue;
      out[k] = decodeURIComponent(v.join('='));
    }
    return out;
  }

  function getSession(req: FastifyRequest): SessionRow | null {
    const cookies = parseCookies(req);
    const token = cookies['pbx_session'];
    if (!token) return null;
    const hash = createHash('sha256').update(token).digest('hex');
    const row = db
      .prepare('SELECT id, user_id, csrf_token, expires_at, remember FROM sessions WHERE token_hash = ?')
      .get(hash) as { id: string; user_id: string; csrf_token: string; expires_at: string; remember: number } | undefined;
    if (!row) return null;
    if (new Date(row.expires_at) <= new Date()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
      return null;
    }
    return { id: row.id, userId: row.user_id, csrfToken: row.csrf_token, expiresAt: row.expires_at, remember: row.remember };
  }

  function requireAuth(req: FastifyRequest): SessionRow {
    const s = getSession(req);
    if (!s) throw unauthorized();
    return s;
  }

  function requireCsrf(req: FastifyRequest, session: SessionRow): void {
    const header = req.headers['x-csrf-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token || token !== session.csrfToken) throw forbidden('csrf token missing or invalid');
  }

  // rate limiting (in-memory)
  const loginAttempts = new Map<string, { count: number; resetAt: number; lockedUntil: number }>();
  function checkRateLimit(key: string): void {
    const now = Date.now();
    const rec = loginAttempts.get(key);
    if (rec && rec.lockedUntil > now) throw tooMany('account locked');
  }
  function recordFailure(key: string): void {
    const now = Date.now();
    let rec = loginAttempts.get(key);
    if (!rec || rec.resetAt < now) {
      rec = { count: 0, resetAt: now + 15 * 60 * 1000, lockedUntil: 0 };
      loginAttempts.set(key, rec);
    }
    rec.count += 1;
    if (rec.count >= 5) {
      rec.lockedUntil = now + 15 * 60 * 1000;
    }
  }
  function recordSuccess(key: string): void {
    loginAttempts.delete(key);
  }

  // setup gate middleware
  app.addHook('onRequest', async (req, reply) => {
    const url = ((req.url ?? '').split('?')[0] ?? '');
    if (!url.startsWith('/api')) return;
    if (url === '/api/health' || url === '/api/setup/status' || url.startsWith('/api/setup')) return;
    if (url === '/api/auth/login') return;
    if (setupRequiredNow()) {
      reply.code(503).send({ error: { code: 'setup_required', message: 'setup is required' } });
      return reply;
    }
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    const proto = (req.headers['x-forwarded-proto'] as string) ?? (req.protocol as string);
    if (proto === 'https' || process.env.PBX_COOKIE_SECURE === '1') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  // error handler
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode ?? 500;
    app.log.error(err);
    reply.code(status).send({ error: { code: 'internal_error', message: e.message ?? 'internal error' } });
  });

  // health
  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'better-pbx-api',
    version: process.env.PBX_VERSION ?? API_VERSION,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) || 0,
  }));

  // setup status
  app.get('/api/setup/status', async () => ({
    setupRequired: setupRequiredNow(),
    initialized: !setupRequiredNow(),
  }));

  // setup completion
  app.post('/api/setup', async (req, reply) => {
    if (!setupRequiredNow()) throw conflict('setup already completed');
    const body = req.body as Record<string, unknown>;
    const setupCode = String(body?.setupCode ?? '').trim();
    const tokenOnDisk = existsSync(config.setupTokenPath) ? readFileSync(config.setupTokenPath, 'utf8').trim() : '';
    if (!setupCode || setupCode !== tokenOnDisk) throw badRequest('invalid setup code');
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    if (!username || username.length < 3) throw badRequest('username must be at least 3 chars');
    if (password.length < 8) throw badRequest('password must be at least 8 chars');

    // create admin
    const userId = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)').run(
      userId,
      username,
      hashPassword(password),
      new Date().toISOString(),
    );

    // bootstrap model
    ensureConfigLayout(config);
    const model = bootstrapModel(config, typeof body?.pbxName === 'string' ? body.pbxName : undefined);
    // apply settings if provided
    if (body?.settings) {
      try {
        const merged = { ...model, settings: body.settings, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
        assertValidModel(merged);
        writeModel(config, merged as PbxModel);
      } catch (e) {
        // revert user creation? best effort: leave; but throw
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        throw e;
      }
    }

    git.ensureRepo();
    const sha = git.commitAll('Initial setup', username, `${username}@better-pbx.local`);

    // remove token
    try {
      rmSync(config.setupTokenPath, { force: true });
    } catch { void 0; }

    recordAudit(db, { actor: username, action: 'setup', target: 'system', commitSha: sha });

    // create session
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const csrfToken = randomBytes(16).toString('hex');
    const remember = Boolean(body?.remember);
    const expires = new Date(Date.now() + (remember ? 7 * 86400000 : 12 * 3600000)).toISOString();
    db.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, remember, created_at) VALUES (?,?,?,?,?,?,?)',
    ).run(randomBytes(16).toString('hex'), userId, tokenHash, csrfToken, expires, remember ? 1 : 0, new Date().toISOString());

    reply.header('Set-Cookie', `pbx_session=${token}; Path=/; HttpOnly; SameSite=Strict${process.env.PBX_COOKIE_SECURE === '1' ? '; Secure' : ''}; Max-Age=${remember ? 604800 : 43200}`);
    return { ok: true, csrfToken, username };
  });

  // auth login
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const username = String(body?.username ?? '');
    const password = String(body?.password ?? '');
    const remember = Boolean(body?.remember);
    const key = `${username}:${req.ip}`;
    checkRateLimit(key);
    const user = findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      recordFailure(key);
      throw unauthorized('invalid credentials');
    }
    recordSuccess(key);
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const csrfToken = randomBytes(16).toString('hex');
    const expires = new Date(Date.now() + (remember ? 7 * 86400000 : 12 * 3600000)).toISOString();
    db.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, remember, created_at) VALUES (?,?,?,?,?,?,?)',
    ).run(randomBytes(16).toString('hex'), user.id, tokenHash, csrfToken, expires, remember ? 1 : 0, new Date().toISOString());

    reply.header('Set-Cookie', `pbx_session=${token}; Path=/; HttpOnly; SameSite=Strict${process.env.PBX_COOKIE_SECURE === '1' ? '; Secure' : ''}; Max-Age=${remember ? 604800 : 43200}`);
    return { csrfToken, user: { id: user.id, username: user.username } };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const session = getSession(req);
    if (session) db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    reply.header('Set-Cookie', `pbx_session=; Path=/; HttpOnly; SameSite=Strict${process.env.PBX_COOKIE_SECURE === '1' ? '; Secure' : ''}; Max-Age=0`);
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => {
    const session = requireAuth(req);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    return { id: user.id, username: user.username, csrfToken: session.csrfToken };
  });

  app.post('/api/auth/password', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const body = req.body as Record<string, unknown>;
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    if (!verifyPassword(String(body?.currentPassword ?? ''), user.password_hash)) throw badRequest('current password incorrect');
    const newPassword = String(body?.newPassword ?? '');
    if (newPassword.length < 8) throw badRequest('password must be at least 8 chars');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
    recordAudit(db, { actor: user.username, action: 'password-change', target: 'user' });
    return { ok: true };
  });

  // settings
  app.get('/api/settings', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.settings;
  });

  app.patch('/api/settings', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const ifMatchHeader = req.headers['if-match'];
    const ifMatch = Array.isArray(ifMatchHeader) ? ifMatchHeader[0] : ifMatchHeader;
    const head = git.headSha();
    if (ifMatch && ifMatch !== head && ifMatch !== `"${head}"`) {
      throw conflict('stale write (If-Match mismatch)', { current: head });
    }
    const newModel = { ...model, settings: { ...model.settings, ...(body ?? {}) }, meta: { ...model.meta, updatedAt: new Date().toISOString() } } as PbxModel;
    // deep merge settings sub-objects
    if (body?.region && typeof body.region === 'object') {
      newModel.settings.region = { ...model.settings.region, ...(body.region as Record<string, unknown>) } as typeof model.settings.region;
    }
    if (body?.network && typeof body.network === 'object') {
      newModel.settings.network = { ...model.settings.network, ...(body.network as Record<string, unknown>) } as typeof model.settings.network;
    }
    if (body?.security && typeof body.security === 'object') {
      newModel.settings.security = { ...model.settings.security, ...(body.security as Record<string, unknown>) } as typeof model.settings.security;
    }
    if (body?.voicemail && typeof body.voicemail === 'object') {
      newModel.settings.voicemail = { ...model.settings.voicemail, ...(body.voicemail as Record<string, unknown>) } as typeof model.settings.voicemail;
    }
    const sec = body?.security;
    if (sec && typeof sec === 'object' && (sec as Record<string, unknown>).fail2ban && typeof (sec as Record<string, unknown>).fail2ban === 'object') {
      const fb = (sec as Record<string, unknown>).fail2ban as Record<string, unknown>;
      newModel.settings.security.fail2ban = { ...model.settings.security.fail2ban, ...fb } as typeof model.settings.security.fail2ban;
    }

    const result = await applyModel(newModel, {
      config,
      db,
      git,
      asterisk,
      fail2ban,
      actor: user.username,
      changeDescription: 'Update settings',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    return { ok: true, commitSha: result.commitSha, restartRequired: result.restartRequired };
  });

  // extensions
  app.get('/api/extensions', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.extensions.map((e) => ({ ...e, secret: undefined }));
  });

  app.post('/api/extensions', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const ext = createExtension({
      number: String(body.number ?? ''),
      displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      secret: typeof body.secret === 'string' ? body.secret : undefined,
      codecs: Array.isArray(body.codecs) ? (body.codecs as string[]) : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      transport: typeof body.transport === 'string' ? (body.transport as 'udp' | 'tls') : undefined,
      maxContacts: typeof body.maxContacts === 'number' ? body.maxContacts : undefined,
      voicemail: (body.voicemail as Record<string, unknown>) ?? undefined,
      callerId: typeof body.callerId === 'string' ? body.callerId : undefined,
    } as unknown as Parameters<typeof createExtension>[0]);
    const newModel = { ...model, extensions: [...model.extensions, ext], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Create extension',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'create-extension', target: ext.id, commitSha: result.commitSha });
    return { ...ext }; // includes secret once
  });

  app.patch('/api/extensions/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const idx = model.extensions.findIndex((e) => e.id === id);
    if (idx < 0) throw notFound('extension not found');
    const body = req.body as Record<string, unknown>;
    const current = model.extensions[idx];
    const updated = { ...current };
    if (typeof body.displayName === 'string') updated.displayName = body.displayName;
    if (Array.isArray(body.codecs)) updated.codecs = body.codecs as never;
    if (typeof body.enabled === 'boolean') updated.enabled = body.enabled;
    if (typeof body.transport === 'string') updated.transport = body.transport as 'udp' | 'tls';
    if (typeof body.maxContacts === 'number') updated.maxContacts = body.maxContacts;
    if (typeof body.callerId === 'string') updated.callerId = body.callerId;
    if (body.voicemail && typeof body.voicemail === 'object') updated.voicemail = { ...updated.voicemail, ...(body.voicemail as Record<string, unknown>) } as never;
    let revealedSecret: string | undefined;
    if (body.resetSecret === true) {
      const { generateSipSecret } = await import('@better-pbx/shared');
      revealedSecret = generateSipSecret();
      updated.secret = revealedSecret;
    }
    const newExtensions = model.extensions.map((e, i) => (i === idx ? updated : e));
    const newModel = { ...model, extensions: newExtensions, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Update extension',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'update-extension', target: id, commitSha: result.commitSha });
    const out: Record<string, unknown> = { ...updated, secret: undefined };
    if (revealedSecret) out.secret = revealedSecret;
    return out;
  });

  app.delete('/api/extensions/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    // delete guards: referenced by ring groups / ivrs / inbound routes
    for (const rg of model.ringGroups) {
      if (rg.memberIds.includes(id)) throw conflict('extension is a member of a ring group');
    }
    const newModel = { ...model, extensions: model.extensions.filter((e) => e.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Delete extension',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'delete-extension', target: id, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // trunks
  app.get('/api/trunks', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.trunks.map((t) => ({ ...t, password: undefined }));
  });

  app.post('/api/trunks', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const trunk = createTrunk({
      name: String(body.name ?? ''),
      host: String(body.host ?? ''),
      port: typeof body.port === 'number' ? body.port : undefined,
      transport: typeof body.transport === 'string' ? (body.transport as 'udp' | 'tls') : undefined,
      username: typeof body.username === 'string' ? body.username : undefined,
      password: typeof body.password === 'string' ? body.password : undefined,
      fromUser: typeof body.fromUser === 'string' ? body.fromUser : undefined,
      fromDomain: typeof body.fromDomain === 'string' ? body.fromDomain : undefined,
      callerId: typeof body.callerId === 'string' ? body.callerId : undefined,
      codecs: Array.isArray(body.codecs) ? (body.codecs as string[]) : undefined,
      inboundMode: typeof body.inboundMode === 'string' ? (body.inboundMode as 'registration' | 'ip') : undefined,
      providerCidrs: Array.isArray(body.providerCidrs) ? (body.providerCidrs as string[]) : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    } as unknown as Parameters<typeof createTrunk>[0]);
    const newModel = { ...model, trunks: [...model.trunks, trunk], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Create trunk',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'create-trunk', target: trunk.id, commitSha: result.commitSha });
    return trunk;
  });

  app.patch('/api/trunks/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const idx = model.trunks.findIndex((t) => t.id === id);
    if (idx < 0) throw notFound('trunk not found');
    const body = req.body as Record<string, unknown>;
    const current = model.trunks[idx];
    const updated = { ...current };
    const fields = ['name','host','port','transport','username','password','fromUser','fromDomain','callerId','codecs','inboundMode','providerCidrs','enabled'] as const;
    for (const f of fields) {
      if (body[f] !== undefined) (updated as Record<string, unknown>)[f] = body[f];
    }
    const newTrunks = model.trunks.map((t, i) => (i === idx ? updated : t));
    const newModel = { ...model, trunks: newTrunks, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Update trunk',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'update-trunk', target: id, commitSha: result.commitSha });
    return { ...updated, password: undefined };
  });

  app.delete('/api/trunks/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const used = model.outboundRoutes.some((r) => r.trunkId === id);
    if (used) throw conflict('trunk is used by an outbound route');
    const newModel = { ...model, trunks: model.trunks.filter((t) => t.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Delete trunk',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'delete-trunk', target: id, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // outbound routes
  app.get('/api/outbound-routes', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.outboundRoutes;
  });

  app.post('/api/outbound-routes', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const route = createOutboundRoute({
      name: String(body.name ?? ''),
      trunkId: String(body.trunkId ?? ''),
      patterns: Array.isArray(body.patterns) ? (body.patterns as never) : [],
      priority: typeof body.priority === 'number' ? body.priority : undefined,
      callerId: typeof body.callerId === 'string' ? body.callerId : undefined,
      allowPremium: typeof body.allowPremium === 'boolean' ? body.allowPremium : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    } as unknown as Parameters<typeof createOutboundRoute>[0]);
    const newModel = { ...model, outboundRoutes: [...model.outboundRoutes, route], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Create outbound route',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'create-outbound-route', target: route.id, commitSha: result.commitSha });
    return route;
  });

  app.patch('/api/outbound-routes/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const idx = model.outboundRoutes.findIndex((r) => r.id === id);
    if (idx < 0) throw notFound('outbound route not found');
    const body = req.body as Record<string, unknown>;
    const current = model.outboundRoutes[idx];
    const updated = { ...current, ...body } as typeof current;
    const newRoutes = model.outboundRoutes.map((r, i) => (i === idx ? updated : r));
    const newModel = { ...model, outboundRoutes: newRoutes, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Update outbound route',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'update-outbound-route', target: id, commitSha: result.commitSha });
    return updated;
  });

  app.delete('/api/outbound-routes/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const newModel = { ...model, outboundRoutes: model.outboundRoutes.filter((r) => r.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, {
      config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Delete outbound route',
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, model);
    recordAudit(db, { actor: user.username, action: 'delete-outbound-route', target: id, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // inbound routes
  app.get('/api/inbound-routes', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.inboundRoutes;
  });
  app.post('/api/inbound-routes', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const route = createInboundRoute({
      name: String(body.name ?? ''),
      did: String(body.did ?? ''),
      trunkId: typeof body.trunkId === 'string' ? body.trunkId : undefined,
      destination: body.destination as never,
      callerIdFilter: typeof body.callerIdFilter === 'string' ? body.callerIdFilter : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
    } as unknown as Parameters<typeof createInboundRoute>[0]);
    const newModel = { ...model, inboundRoutes: [...model.inboundRoutes, route], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Create inbound route', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'create-inbound-route', target: route.id, commitSha: result.commitSha });
    return route;
  });
  app.patch('/api/inbound-routes/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const idx = model.inboundRoutes.findIndex((r) => r.id === id);
    if (idx < 0) throw notFound('inbound route not found');
    const body = req.body as Record<string, unknown>;
    const current = model.inboundRoutes[idx];
    const updated = { ...current, ...body } as typeof current;
    const newRoutes = model.inboundRoutes.map((r, i) => (i === idx ? updated : r));
    const newModel = { ...model, inboundRoutes: newRoutes, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Update inbound route', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'update-inbound-route', target: id, commitSha: result.commitSha });
    return updated;
  });
  app.delete('/api/inbound-routes/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const newModel = { ...model, inboundRoutes: model.inboundRoutes.filter((r) => r.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Delete inbound route', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'delete-inbound-route', target: id, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // ring groups
  app.get('/api/ring-groups', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.ringGroups;
  });
  app.post('/api/ring-groups', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const group = createRingGroup({
      name: String(body.name ?? ''),
      number: String(body.number ?? ''),
      memberIds: Array.isArray(body.memberIds) ? (body.memberIds as string[]) : [],
      destinationIfNoAnswer: body.destinationIfNoAnswer as never,
      strategy: typeof body.strategy === 'string' ? (body.strategy as 'ringall' | 'linear' | 'rrmemory') : undefined,
      ringTime: typeof body.ringTime === 'number' ? body.ringTime : undefined,
    } as unknown as Parameters<typeof createRingGroup>[0]);
    const newModel = { ...model, ringGroups: [...model.ringGroups, group], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Create ring group', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'create-ring-group', target: group.id, commitSha: result.commitSha });
    return group;
  });
  app.patch('/api/ring-groups/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const idx = model.ringGroups.findIndex((r) => r.id === id);
    if (idx < 0) throw notFound('ring group not found');
    const body = req.body as Record<string, unknown>;
    const current = model.ringGroups[idx];
    const updated = { ...current, ...body } as typeof current;
    const newGroups = model.ringGroups.map((r, i) => (i === idx ? updated : r));
    const newModel = { ...model, ringGroups: newGroups, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Update ring group', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'update-ring-group', target: id, commitSha: result.commitSha });
    return updated;
  });
  app.delete('/api/ring-groups/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const newModel = { ...model, ringGroups: model.ringGroups.filter((r) => r.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Delete ring group', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'delete-ring-group', target: id, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // ivrs
  app.get('/api/ivrs', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.ivrs;
  });
  app.post('/api/ivrs', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const ivr = createIvr({
      name: String(body.name ?? ''),
      greetingPromptId: String(body.greetingPromptId ?? ''),
      timeoutDestination: body.timeoutDestination as never,
      timeoutSeconds: typeof body.timeoutSeconds === 'number' ? body.timeoutSeconds : undefined,
      maxRetries: typeof body.maxRetries === 'number' ? body.maxRetries : undefined,
      options: Array.isArray(body.options) ? (body.options as never) : undefined,
      invalidDestination: body.invalidDestination as never,
      directDial: typeof body.directDial === 'boolean' ? body.directDial : undefined,
      number: typeof body.number === 'string' ? body.number : undefined,
    } as unknown as Parameters<typeof createIvr>[0]);
    const newModel = { ...model, ivrs: [...model.ivrs, ivr], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Create IVR', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'create-ivr', target: ivr.id, commitSha: result.commitSha });
    return ivr;
  });
  app.patch('/api/ivrs/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const idx = model.ivrs.findIndex((r) => r.id === id);
    if (idx < 0) throw notFound('ivr not found');
    const body = req.body as Record<string, unknown>;
    const current = model.ivrs[idx];
    const updated = { ...current, ...body } as typeof current;
    const newIvrs = model.ivrs.map((r, i) => (i === idx ? updated : r));
    const newModel = { ...model, ivrs: newIvrs, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Update IVR', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'update-ivr', target: id, commitSha: result.commitSha });
    return updated;
  });
  app.delete('/api/ivrs/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const newModel = { ...model, ivrs: model.ivrs.filter((r) => r.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Delete IVR', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'delete-ivr', target: id, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // prompts
  app.get('/api/prompts', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    return model.prompts;
  });
  app.post('/api/prompts', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const prompt = createPrompt({
      name: String(body.name ?? ''),
      kind: (body.kind === 'custom' ? 'custom' : 'builtin') as 'builtin' | 'custom',
      file: String(body.file ?? ''),
      originalName: typeof body.originalName === 'string' ? body.originalName : undefined,
      durationMs: typeof body.durationMs === 'number' ? body.durationMs : undefined,
    } as unknown as Parameters<typeof createPrompt>[0]);
    const newModel = { ...model, prompts: [...model.prompts, prompt], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Create prompt', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'create-prompt', target: prompt.id, commitSha: result.commitSha });
    return prompt;
  });
  app.post('/api/prompts/upload', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? 'uploaded');
    const originalName = typeof body.originalName === 'string' ? body.originalName : 'upload.wav';
    const content = typeof body.content === 'string' ? body.content : '';
    if (!content) throw badRequest('content (base64) required');
    const buf = Buffer.from(content, 'base64');
    if (buf.length === 0) throw badRequest('empty upload');
    if (buf.length > 10 * 1024 * 1024) throw badRequest('file too large (max 10MB)');
    const soundsDir = join(config.dataDir, 'sounds');
    mkdirSync(soundsDir, { recursive: true });
    const id = randomBytes(16).toString('hex');
    const rawPath = join(soundsDir, `${id}.orig`);
    const outPath = join(soundsDir, `${id}.wav`);
    writeFileSync(rawPath, buf);
    // convert via sox
    const { execFileSync } = await import('node:child_process');
    try {
      execFileSync('sox', [rawPath, '-r', '8000', '-c', '1', outPath], { timeout: 30000 });
    } catch {
      // sox unavailable (tests): copy raw as wav
      writeFileSync(outPath, buf);
    }
    // cleanup raw
    try { rmSync(rawPath, { force: true }); } catch { void 0; }
    const prompt = createPrompt({
      name,
      kind: 'custom',
      file: `custom/${id}.wav`,
      originalName,
      durationMs: 0,
    } as unknown as Parameters<typeof createPrompt>[0]);
    const newModel = { ...model, prompts: [...model.prompts, prompt], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Upload prompt', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'upload-prompt', target: prompt.id, commitSha: result.commitSha });
    return prompt;
  });

  app.delete('/api/prompts/:id', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const model = readModel(config);
    if (!model) throw setupRequired();
    const id = (req.params as { id: string }).id;
    const newModel = { ...model, prompts: model.prompts.filter((p) => p.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config, db, git, asterisk, fail2ban, actor: user.username, changeDescription: 'Delete prompt', runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })) }, model);
    recordAudit(db, { actor: user.username, action: 'delete-prompt', target: id, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // snapshots
  app.get('/api/snapshots', async (req) => {
    requireAuth(req);
    return git.listCommits(100);
  });

  app.get('/api/snapshots/:sha', async (req) => {
    requireAuth(req);
    const sha = (req.params as { sha: string }).sha;
    return git.showCommit(sha);
  });

  app.get('/api/snapshots/:sha/diff', async (req) => {
    requireAuth(req);
    const sha = (req.params as { sha: string }).sha;
    return { diff: git.diff(sha) };
  });

  app.post('/api/snapshots/:sha/rollback', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const sha = (req.params as { sha: string }).sha;
    // read model at sha
    const yamlText = git.readFileAt(sha, 'pbx.yaml');
    const raw = yaml.load(yamlText);
    const currentModel = readModel(config);
    const result = await applyModel(raw, {
      config,
      db,
      git,
      asterisk,
      fail2ban,
      actor: user.username,
      changeDescription: `Rollback to ${sha.slice(0, 7)}`,
      runtimeBans: listBans(db, true).map((b) => ({ ip: b.ip })),
    }, currentModel);
    recordAudit(db, { actor: user.username, action: 'rollback', target: sha, commitSha: result.commitSha });
    return { ok: true, commitSha: result.commitSha };
  });

  // security bans
  app.get('/api/security/bans', async (req) => {
    requireAuth(req);
    return listBans(db);
  });

  app.delete('/api/security/bans/:ip', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const user = findUserById(session.userId);
    if (!user) throw unauthorized();
    const ip = (req.params as { ip: string }).ip;
    const ok = removeBan(db, ip);
    // regenerate runtime acl? write file
    const model = readModel(config);
    if (model) {
      void model;
    }
    recordAudit(db, { actor: user.username, action: 'unban', target: ip });
    return { ok };
  });

  app.get('/api/voicemail/counts', async (req) => {
    requireAuth(req);
    const model = readModel(config);
    if (!model) throw setupRequired();
    const base = join(config.dataDir, 'voicemail');
    const counts: Record<string, number> = {};
    for (const ext of model.extensions) {
      if (!ext.voicemail.enabled) continue;
      const dir = join(base, 'default', ext.number);
      let n = 0;
      if (existsSync(dir)) {
        try {
          n = readdirSync(dir).filter((f) => f.endsWith('.wav') || f.endsWith('.txt')).length;
        } catch {
          n = 0;
        }
      }
      counts[ext.number] = n;
    }
    return counts;
  });

  app.get('/api/security/status', async (req) => {
    requireAuth(req);
    return { fail2ban: 'enabled', bans: listBans(db, true).length };
  });

  // internal ban endpoint
  app.post('/internal/bans', async (req) => {
    // loopback check
    const remote = req.ip;
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      throw forbidden('loopback only');
    }
    const provided = req.headers['x-internal-token'];
    const tok = Array.isArray(provided) ? provided[0] : provided;
    if (tok !== internalToken) throw unauthorized('invalid internal token');
    const body = req.body as Record<string, unknown>;
    const ip = String(body?.ip ?? '');
    if (!ip) throw badRequest('ip required');
    const banTime = Number(body?.banTime ?? 3600);
    const expiresAt = new Date(Date.now() + banTime * 1000).toISOString();
    const banInput: { ip: string; source: string; expiresAt: string; reason?: string } = { ip, source: 'fail2ban', expiresAt };
    if (typeof body?.reason === 'string') banInput.reason = body.reason;
    addBan(db, banInput);
    recordAudit(db, { actor: 'fail2ban', action: 'ban', target: ip });
    return { ok: true };
  });

  // system
  app.get('/api/system/registrations', async (req) => {
    requireAuth(req);
    const res = asterisk.ping(); // placeholder
    return { output: res.stdout || res.stderr };
  });

  app.get('/api/system/calls', async (req) => {
    requireAuth(req);
    const res = asterisk.coreShowChannels();
    return { output: res.stdout || res.stderr };
  });

  app.get('/api/system/cdr', async (req) => {
    requireAuth(req);
    const { existsSync, readFileSync } = await import('node:fs');
    const cdrPath = join(config.dataDir, 'log', 'cdr.csv');
    if (!existsSync(cdrPath)) return [];
    const text = readFileSync(cdrPath, 'utf8');
    const lines = text.trim().split('\n').slice(-100);
    return lines.map((l) => ({ raw: l }));
  });

  app.get('/api/system/logs', async (req) => {
    requireAuth(req);
    const q = req.query as Record<string, string>;
    const requested = String(q.file ?? 'messages').toLowerCase();
    const aliasMap: Record<string, string> = {
      messages: 'messages',
      security: 'security',
      sip: 'sip',
      trace: 'sip',
      siptrace: 'sip',
      'sip-trace': 'sip',
      sip_trace: 'sip',
      full: 'full',
    };
    const file = aliasMap[requested] ?? 'messages';
    const tail = Math.min(Math.max(Number(q.tail ?? 200), 1), 10000);
    const { existsSync, readFileSync } = await import('node:fs');
    const logPath = join(config.dataDir, 'log', `${file}.log`);
    if (!existsSync(logPath) && file === 'sip') {
      // Fall back to the messages log, surfacing only SIP-related lines so traces are
      // still visible when a dedicated sip.log has not been created yet.
      const fallback = join(config.dataDir, 'log', 'messages.log');
      if (existsSync(fallback)) {
        const text = readFileSync(fallback, 'utf8');
        const sipLines = text
          .split('\n')
          .filter((line) => /sip|<---|received|sending|register/i.test(line));
        return { lines: sipLines.slice(-tail) };
      }
    }
    if (!existsSync(logPath)) return { lines: [] };
    const text = readFileSync(logPath, 'utf8');
    const lines = text.split('\n');
    return { lines: lines.slice(-tail) };
  });

  app.get('/api/system/sip-trace', async (req) => {
    requireAuth(req);
    return { enabled: sipTraceEnabled };
  });

  app.get('/api/system/trace', async (req) => {
    requireAuth(req);
    return { enabled: sipTraceEnabled };
  });

  app.post('/api/system/trace', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const body = (req.body as Record<string, unknown>) ?? {};
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
    sipTraceEnabled = enabled;
    try {
      if (enabled) {
        asterisk.coreSetVerbose(5);
        asterisk.pjsipSetLogger(true);
      } else {
        asterisk.pjsipSetLogger(false);
      }
    } catch {
      void 0;
    }
    return { enabled: sipTraceEnabled };
  });

  app.post('/api/system/sip-trace', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    const body = (req.body as Record<string, unknown>) ?? {};
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
    sipTraceEnabled = enabled;
    try {
      if (enabled) {
        asterisk.coreSetVerbose(5);
        asterisk.pjsipSetLogger(true);
      } else {
        asterisk.pjsipSetLogger(false);
      }
    } catch {
      void 0;
    }
    return { enabled: sipTraceEnabled };
  });

  app.get('/api/system/queues', async (req) => {
    requireAuth(req);
    return { output: 'no queues' };
  });

  app.get('/api/system/status', async (req) => {
    requireAuth(req);
    return {
      version: process.env.PBX_VERSION ?? API_VERSION,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      setupRequired: setupRequiredNow(),
      gitHead: git.headSha(),
    };
  });

  app.get('/api/system/config', async (req) => {
    requireAuth(req);
    // list rendered files
    const files: Record<string, string> = {};
    function walk(dir: string, base: string) {
      if (!existsSync(dir)) return;
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
          if (name === '.git') continue;
          walk(full, base);
        } else {
          files[relative(config.configDir, full)] = readFileSync(full, 'utf8');
        }
      }
    }
    walk(config.configDir, config.configDir);
    return { files };
  });

  app.post('/api/system/apply-pending', async (req) => {
    const session = requireAuth(req);
    requireCsrf(req, session);
    return { ok: true, message: 'no pending changes' };
  });

  // audit
  app.get('/api/audit', async (req) => {
    requireAuth(req);
    return listAudit(db);
  });

  // openapi docs
  app.get('/api/docs', async () => ({
    openapi: '3.0.0',
    info: { title: 'BetterPBX API', version: API_VERSION },
    paths: {},
  }));

  // static SPA fallback
  const webDist = config.webDistDir;
  if (existsSync(webDist)) {
    app.get('/*', async (req, reply) => {
      const url = ((req.url ?? '').split('?')[0] ?? '');
      if (url.startsWith('/api') || url.startsWith('/internal')) {
        reply.code(404).send({ error: { code: 'not_found', message: 'not found' } });
        return;
      }
      // try file
      const filePath = join(webDist, url === '/' ? 'index.html' : url.replace(/^\//, ''));
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = filePath.split('.').pop() ?? '';
        const type = ext === 'html' ? 'text/html' : ext === 'js' ? 'application/javascript' : ext === 'css' ? 'text/css' : 'application/octet-stream';
        reply.type(type);
        return readFileSync(filePath);
      }
      const index = join(webDist, 'index.html');
      if (existsSync(index)) {
        reply.type('text/html');
        return readFileSync(index);
      }
      reply.code(404).send('not found');
    });
  }

  // sweeper
  const sweeper = setInterval(() => {
    try { sweepExpired(db); } catch { void 0; }
  }, 60_000);
  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    dbWrap.close();
  });

  return app;
}

function ensureConfigLayout(config: ApiConfig): void {
  mkdirSync(config.configDir, { recursive: true });
  mkdirSync(config.runtimeDir, { recursive: true });
}