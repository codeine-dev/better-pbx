import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { join, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, statSync } from 'node:fs';
import yaml from 'js-yaml';
import { readModel } from './model-store.js';
import { applyModel } from './apply.js';
import { listBans, removeBan } from './bans.js';
import { listAudit } from './audit.js';
import type { ApiConfig } from './config.js';
import type { GitManager } from './git-manager.js';
import type { AsteriskCli, Fail2banCli } from './cli.js';
import { recordAudit } from './audit.js';

import {
  createExtension,
  createTrunk,
  createOutboundRoute,
  createInboundRoute,
  createRingGroup,
  createIvr,
  generateSipSecret,
} from '@better-pbx/shared';
import type { PbxModel } from '@better-pbx/shared';

export interface McpContext {
  config: ApiConfig;
  db: DatabaseSync;
  git: GitManager;
  asterisk: AsteriskCli;
  fail2ban: Fail2banCli;
  mcpToken: string;
  startedAt: number;
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function requireModel(ctx: McpContext): PbxModel {
  const model = readModel(ctx.config);
  if (!model) throw new Error('setup required: complete the setup wizard first');
  return model;
}

function runtimeBans(ctx: McpContext) {
  return listBans(ctx.db, true).map((b) => ({ ip: b.ip }));
}

export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: 'better-pbx', version: process.env.PBX_VERSION ?? '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // ---------- read / debug tools ----------
  server.registerTool('pbx_health', { description: 'Health and uptime of the BetterPBX API.', inputSchema: {} }, async () => {
    return text({ status: 'ok', service: 'better-pbx-api', version: process.env.PBX_VERSION ?? '0.1.0', uptimeSeconds: Math.floor((Date.now() - ctx.startedAt) / 1000) });
  });

  server.registerTool('pbx_status', { description: 'System status: setup state, git head, uptime.', inputSchema: {} }, async () => {
    return text({
      version: process.env.PBX_VERSION ?? '0.1.0',
      uptimeSeconds: Math.floor((Date.now() - ctx.startedAt) / 1000),
      setupRequired: !existsSync(ctx.config.modelPath) || !readModel(ctx.config),
      gitHead: ctx.git.headSha(),
    });
  });

  server.registerTool('pbx_model_summary', { description: 'Counts of configured resources.', inputSchema: {} }, async () => {
    const model = readModel(ctx.config);
    if (!model) return text({ setupRequired: true });
    return text({
      extensions: model.extensions.length,
      trunks: model.trunks.length,
      outboundRoutes: model.outboundRoutes.length,
      inboundRoutes: model.inboundRoutes.length,
      ringGroups: model.ringGroups.length,
      ivrs: model.ivrs.length,
      prompts: model.prompts.length,
    });
  });

  server.registerTool('pbx_extensions_list', { description: 'List extensions (SIP secrets masked).', inputSchema: {} }, async () => {
    const model = requireModel(ctx);
    return text(model.extensions.map((e) => ({ ...e, secret: undefined })));
  });

  server.registerTool('pbx_trunks_list', { description: 'List trunks (passwords masked).', inputSchema: {} }, async () => {
    const model = requireModel(ctx);
    return text(model.trunks.map((t) => ({ ...t, password: undefined })));
  });

  server.registerTool('pbx_outbound_routes_list', { description: 'List outbound routes.', inputSchema: {} }, async () => {
    return text(requireModel(ctx).outboundRoutes);
  });

  server.registerTool('pbx_inbound_routes_list', { description: 'List inbound routes.', inputSchema: {} }, async () => {
    return text(requireModel(ctx).inboundRoutes);
  });

  server.registerTool('pbx_ring_groups_list', { description: 'List ring groups.', inputSchema: {} }, async () => {
    return text(requireModel(ctx).ringGroups);
  });

  server.registerTool('pbx_ivrs_list', { description: 'List IVRs.', inputSchema: {} }, async () => {
    return text(requireModel(ctx).ivrs);
  });

  server.registerTool('pbx_settings_get', { description: 'Get current PBX settings.', inputSchema: {} }, async () => {
    return text(requireModel(ctx).settings);
  });

  server.registerTool('pbx_snapshots_list', { description: 'List recent configuration snapshots (git commits).', inputSchema: { limit: z.number().int().min(1).max(200).optional() } }, async ({ limit }) => {
    return text(ctx.git.listCommits(limit ?? 50));
  });

  server.registerTool('pbx_snapshot_diff', { description: 'Show unified diff for a snapshot commit.', inputSchema: { sha: z.string().min(1) } }, async ({ sha }) => {
    return text(ctx.git.diff(sha));
  });

  server.registerTool('pbx_logs_tail', { description: 'Tail a log file (messages, security, sip, full).', inputSchema: { file: z.enum(['messages', 'security', 'sip', 'full', 'trace']).optional(), tail: z.number().int().min(1).max(10000).optional() } }, async ({ file, tail }) => {
    const alias: Record<string, string> = { messages: 'messages', security: 'security', sip: 'sip', trace: 'sip', full: 'full' };
    const name = alias[file ?? 'messages'] ?? 'messages';
    const n = tail ?? 200;
    const candidates = [join(ctx.config.dataDir, 'log', `${name}.log`), join(ctx.config.dataDir, 'log', name)];
    const logPath = (candidates.find((p) => existsSync(p)) ?? candidates[0]) as string;
    if (!existsSync(logPath) && name === 'sip') {
      const fb = [join(ctx.config.dataDir, 'log', 'messages.log'), join(ctx.config.dataDir, 'log', 'messages')].find((p) => existsSync(p));
      if (fb) {
        const lines = readFileSync(fb, 'utf8').split('\n').filter((l) => /sip|<---|received|sending|register/i.test(l));
        return text(lines.slice(-n));
      }
    }
    if (!existsSync(logPath)) return text([]);
    const lines = readFileSync(logPath, 'utf8').split('\n');
    return text(lines.slice(-n));
  });

  server.registerTool('pbx_system_registrations', { description: 'Asterisk PJSIP registered contacts (extensions/trunks).', inputSchema: {} }, async () => {
    const res = ctx.asterisk.pjsipShowContacts();
    return text(res.stdout || res.stderr);
  });

  server.registerTool('pbx_system_calls', { description: 'Active channels.', inputSchema: {} }, async () => {
    const res = ctx.asterisk.coreShowChannels();
    return text(res.stdout || res.stderr);
  });

  server.registerTool('pbx_cdr_tail', { description: 'Tail CDR CSV.', inputSchema: { limit: z.number().int().min(1).max(500).optional() } }, async ({ limit }) => {
    const n = limit ?? 100;
    const cdrPath = join(ctx.config.dataDir, 'log', 'cdr.csv');
    if (!existsSync(cdrPath)) return text([]);
    const lines = readFileSync(cdrPath, 'utf8').trim().split('\n');
    return text(lines.slice(-n).map((l) => ({ raw: l })));
  });

  server.registerTool('pbx_bans_list', { description: 'List active bans.', inputSchema: {} }, async () => {
    return text(listBans(ctx.db));
  });

  server.registerTool('pbx_audit_list', { description: 'List recent audit log entries.', inputSchema: { limit: z.number().int().min(1).max(500).optional() } }, async ({ limit }) => {
    const entries = listAudit(ctx.db);
    return text(entries.slice(-(limit ?? 100)));
  });

  server.registerTool('pbx_config_file', { description: 'Read a rendered config file by relative path (read-only).', inputSchema: { path: z.string().min(1) } }, async ({ path }) => {
    const base = ctx.config.configDir;
    const full = resolve(base, path);
    if (!full.startsWith(resolve(base) + '/') && full !== resolve(base)) throw new Error('invalid path');
    if (!existsSync(full) || !statSync(full).isFile()) throw new Error('file not found');
    return text(readFileSync(full, 'utf8'));
  });

  // ---------- configuration tools ----------
  server.registerTool('pbx_create_extension', {
    description: 'Create a new extension.',
    inputSchema: {
      number: z.string(),
      displayName: z.string().optional(),
      secret: z.string().optional(),
      codecs: z.array(z.enum(['ulaw', 'alaw', 'gsm', 'g722'])).optional(),
      enabled: z.boolean().optional(),
      transport: z.enum(['udp', 'tls']).optional(),
      maxContacts: z.number().int().optional(),
      callerId: z.string().optional(),
      voicemailEnabled: z.boolean().optional(),
      voicemailPin: z.string().optional(),
      voicemailEmail: z.string().optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const ext = createExtension({
      number: args.number,
      displayName: args.displayName,
      secret: args.secret,
      codecs: args.codecs,
      enabled: args.enabled,
      transport: args.transport,
      maxContacts: args.maxContacts,
      callerId: args.callerId,
      voicemail: { enabled: args.voicemailEnabled ?? false, pin: args.voicemailPin ?? '', email: args.voicemailEmail },
    } as unknown as Parameters<typeof createExtension>[0]);
    const newModel = { ...model, extensions: [...model.extensions, ext], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP create extension', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-create-extension', target: ext.id, commitSha: result.commitSha });
    return text({ extension: ext, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  server.registerTool('pbx_update_extension', {
    description: 'Update an extension by id.',
    inputSchema: {
      id: z.string(),
      displayName: z.string().optional(),
      codecs: z.array(z.enum(['ulaw', 'alaw', 'gsm', 'g722'])).optional(),
      enabled: z.boolean().optional(),
      transport: z.enum(['udp', 'tls']).optional(),
      maxContacts: z.number().int().optional(),
      callerId: z.string().optional(),
      resetSecret: z.boolean().optional(),
      voicemailEnabled: z.boolean().optional(),
      voicemailPin: z.string().optional(),
      voicemailEmail: z.string().optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const idx = model.extensions.findIndex((e) => e.id === args.id);
    if (idx < 0) throw new Error('extension not found');
    const current = model.extensions[idx]!;
    const updated: Record<string, unknown> = { ...current };
    if (args.displayName !== undefined) updated.displayName = args.displayName;
    if (args.codecs !== undefined) updated.codecs = args.codecs;
    if (args.enabled !== undefined) updated.enabled = args.enabled;
    if (args.transport !== undefined) updated.transport = args.transport;
    if (args.maxContacts !== undefined) updated.maxContacts = args.maxContacts;
    if (args.callerId !== undefined) updated.callerId = args.callerId;
    if (args.voicemailEnabled !== undefined || args.voicemailPin !== undefined || args.voicemailEmail !== undefined) {
      updated.voicemail = { ...(current.voicemail as Record<string, unknown>), ...(args.voicemailEnabled !== undefined ? { enabled: args.voicemailEnabled } : {}), ...(args.voicemailPin !== undefined ? { pin: args.voicemailPin } : {}), ...(args.voicemailEmail !== undefined ? { email: args.voicemailEmail } : {}) };
    }
    let revealedSecret: string | undefined;
    if (args.resetSecret === true) {
      revealedSecret = generateSipSecret();
      updated.secret = revealedSecret;
    }
    const newExtensions = model.extensions.map((e, i) => (i === idx ? (updated as typeof current) : e));
    const newModel = { ...model, extensions: newExtensions, meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP update extension', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-update-extension', target: args.id, commitSha: result.commitSha });
    const out: Record<string, unknown> = { ...updated, secret: undefined };
    if (revealedSecret) out.secret = revealedSecret;
    return text({ extension: out, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  server.registerTool('pbx_delete_extension', { description: 'Delete an extension by id.', inputSchema: { id: z.string() } }, async ({ id }) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    if (!model.extensions.some((e) => e.id === id)) throw new Error('extension not found');
    for (const rg of model.ringGroups) {
      if (rg.memberIds.includes(id)) throw new Error('extension is a member of a ring group');
    }
    const newModel = { ...model, extensions: model.extensions.filter((e) => e.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP delete extension', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-delete-extension', target: id, commitSha: result.commitSha });
    return text({ ok: true, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  // trunks
  server.registerTool('pbx_create_trunk', {
    description: 'Create a trunk.',
    inputSchema: {
      name: z.string(),
      host: z.string(),
      port: z.number().int().optional(),
      transport: z.enum(['udp', 'tls']).optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      fromUser: z.string().optional(),
      fromDomain: z.string().optional(),
      callerId: z.string().optional(),
      codecs: z.array(z.enum(['ulaw', 'alaw', 'gsm', 'g722'])).optional(),
      inboundMode: z.enum(['registration', 'ip']).optional(),
      providerCidrs: z.array(z.string()).optional(),
      enabled: z.boolean().optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const trunk = createTrunk(args as unknown as Parameters<typeof createTrunk>[0]);
    const newModel = { ...model, trunks: [...model.trunks, trunk], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP create trunk', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-create-trunk', target: trunk.id, commitSha: result.commitSha });
    return text({ trunk, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  server.registerTool('pbx_delete_trunk', { description: 'Delete a trunk by id.', inputSchema: { id: z.string() } }, async ({ id }) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    if (model.outboundRoutes.some((r) => r.trunkId === id)) throw new Error('trunk is used by an outbound route');
    const newModel = { ...model, trunks: model.trunks.filter((t) => t.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP delete trunk', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-delete-trunk', target: id, commitSha: result.commitSha });
    return text({ ok: true, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  // outbound routes
  server.registerTool('pbx_create_outbound_route', {
    description: 'Create an outbound route.',
    inputSchema: {
      name: z.string(),
      trunkId: z.string(),
      patterns: z.array(z.object({ match: z.string(), strip: z.number().int().optional(), prepend: z.string().optional() })),
      priority: z.number().int().optional(),
      callerId: z.string().optional(),
      allowPremium: z.boolean().optional(),
      enabled: z.boolean().optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const route = createOutboundRoute({
      name: args.name,
      trunkId: args.trunkId,
      patterns: args.patterns.map((p) => ({ match: p.match, strip: p.strip ?? 0, prepend: p.prepend ?? '' })) as never,
      priority: args.priority,
      callerId: args.callerId,
      allowPremium: args.allowPremium,
      enabled: args.enabled,
    } as unknown as Parameters<typeof createOutboundRoute>[0]);
    const newModel = { ...model, outboundRoutes: [...model.outboundRoutes, route], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP create outbound route', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-create-outbound-route', target: route.id, commitSha: result.commitSha });
    return text({ route, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  server.registerTool('pbx_delete_outbound_route', { description: 'Delete an outbound route by id.', inputSchema: { id: z.string() } }, async ({ id }) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const newModel = { ...model, outboundRoutes: model.outboundRoutes.filter((r) => r.id !== id), meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP delete outbound route', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-delete-outbound-route', target: id, commitSha: result.commitSha });
    return text({ ok: true, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  // inbound routes
  server.registerTool('pbx_create_inbound_route', {
    description: 'Create an inbound route.',
    inputSchema: {
      name: z.string(),
      did: z.string(),
      trunkId: z.string().optional(),
      destination: z.any(),
      callerIdFilter: z.string().optional(),
      enabled: z.boolean().optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const route = createInboundRoute(args as unknown as Parameters<typeof createInboundRoute>[0]);
    const newModel = { ...model, inboundRoutes: [...model.inboundRoutes, route], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP create inbound route', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-create-inbound-route', target: route.id, commitSha: result.commitSha });
    return text({ route, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  // ring groups
  server.registerTool('pbx_create_ring_group', {
    description: 'Create a ring group.',
    inputSchema: {
      name: z.string(),
      number: z.string(),
      memberIds: z.array(z.string()),
      destinationIfNoAnswer: z.any().optional(),
      strategy: z.enum(['ringall', 'linear', 'rrmemory']).optional(),
      ringTime: z.number().int().optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const group = createRingGroup(args as unknown as Parameters<typeof createRingGroup>[0]);
    const newModel = { ...model, ringGroups: [...model.ringGroups, group], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP create ring group', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-create-ring-group', target: group.id, commitSha: result.commitSha });
    return text({ group, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  // ivrs
  server.registerTool('pbx_create_ivr', {
    description: 'Create an IVR.',
    inputSchema: {
      name: z.string(),
      greetingPromptId: z.string(),
      timeoutDestination: z.any(),
      timeoutSeconds: z.number().int().optional(),
      maxRetries: z.number().int().optional(),
      options: z.array(z.object({ digit: z.string(), destination: z.any() })).optional(),
      invalidDestination: z.any().optional(),
      directDial: z.boolean().optional(),
      number: z.string().optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const ivr = createIvr(args as unknown as Parameters<typeof createIvr>[0]);
    const newModel = { ...model, ivrs: [...model.ivrs, ivr], meta: { ...model.meta, updatedAt: new Date().toISOString() } };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP create IVR', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-create-ivr', target: ivr.id, commitSha: result.commitSha });
    return text({ ivr, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  // settings update (shallow merge of provided top-level settings fields)
  server.registerTool('pbx_update_settings', {
    description: 'Update PBX settings (region/network/security/voicemail). Deep-merges provided sub-objects.',
    inputSchema: {
      region: z.record(z.string(), z.any()).optional(),
      network: z.record(z.string(), z.any()).optional(),
      security: z.record(z.string(), z.any()).optional(),
      voicemail: z.record(z.string(), z.any()).optional(),
      fail2ban: z.record(z.string(), z.any()).optional(),
    },
  }, async (args) => {
    const model = requireModel(ctx);
    const user = 'mcp-agent';
    const newModel = { ...model, settings: { ...model.settings } } as PbxModel;
    if (args.region) newModel.settings.region = { ...model.settings.region, ...args.region } as typeof model.settings.region;
    if (args.network) newModel.settings.network = { ...model.settings.network, ...args.network } as typeof model.settings.network;
    if (args.security) newModel.settings.security = { ...model.settings.security, ...args.security } as typeof model.settings.security;
    if (args.voicemail) newModel.settings.voicemail = { ...model.settings.voicemail, ...args.voicemail } as typeof model.settings.voicemail;
    if (args.fail2ban) {
      newModel.settings.security = { ...newModel.settings.security, fail2ban: { ...model.settings.security.fail2ban, ...args.fail2ban } } as typeof model.settings.security;
    }
    newModel.meta = { ...model.meta, updatedAt: new Date().toISOString() };
    const result = await applyModel(newModel, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: 'MCP update settings', runtimeBans: runtimeBans(ctx) }, model);
    recordAudit(ctx.db, { actor: user, action: 'mcp-update-settings', target: 'settings', commitSha: result.commitSha });
    return text({ ok: true, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  server.registerTool('pbx_unban_ip', { description: 'Unban an IP.', inputSchema: { ip: z.string() } }, async ({ ip }) => {
    const ok = removeBan(ctx.db, ip);
    recordAudit(ctx.db, { actor: 'mcp-agent', action: 'mcp-unban', target: ip });
    return text({ ok });
  });

  server.registerTool('pbx_rollback_snapshot', { description: 'Rollback configuration to a snapshot commit.', inputSchema: { sha: z.string().min(1) } }, async ({ sha }) => {
    const user = 'mcp-agent';
    const yamlText = ctx.git.readFileAt(sha, 'pbx.yaml');
    const raw = yaml.load(yamlText);
    const currentModel = readModel(ctx.config);
    const result = await applyModel(raw, { config: ctx.config, db: ctx.db, git: ctx.git, asterisk: ctx.asterisk, fail2ban: ctx.fail2ban, actor: user, changeDescription: `MCP rollback to ${sha.slice(0, 7)}`, runtimeBans: runtimeBans(ctx) }, currentModel);
    recordAudit(ctx.db, { actor: user, action: 'mcp-rollback', target: sha, commitSha: result.commitSha });
    return text({ ok: true, commitSha: result.commitSha, restartRequired: result.restartRequired });
  });

  server.registerTool('pbx_sip_trace', { description: 'Enable or disable SIP tracing.', inputSchema: { enabled: z.boolean() } }, async ({ enabled }) => {
    // best-effort; state not persisted globally beyond process, but matches API behavior intent
    try {
      if (enabled) {
        ctx.asterisk.coreSetVerbose(5);
        ctx.asterisk.coreSetDebug(5);
        ctx.asterisk.loggerReload();
        ctx.asterisk.pjsipSetLogger(true);
      } else {
        ctx.asterisk.pjsipSetLogger(false);
      }
    } catch {
      // ignore
    }
    return text({ enabled });
  });

  return server;
}

export function createMcpHttpHandler(ctx: McpContext) {
  return async function handle(req: Request, parsedBody: unknown): Promise<Response> {
    const server = createMcpServer(ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: false });
    await server.connect(transport);
    const res = await transport.handleRequest(req, { parsedBody });
    // schedule cleanup
    // Note: for streaming responses, close after stream ends is handled by caller? We'll close on response close via reader? We'll not close immediately for streams.
    // We'll attach a best-effort close when possible.
    return res;
  };
}
