#!/usr/bin/env node
/**
 * BetterPBX progress tracker.
 *
 * A dependency-free helper for a multi-agent workflow:
 *   phases/*.md      canonical task checklists (source of truth)
 *   claims/*.md      atomic per-task claims
 *   WORKLOG.md       append-only completion log
 *   STATUS.md        generated dashboard
 *
 * Run `node scripts/progress.mjs help` for commands.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const STATUSES = new Set([
  'not_started',
  'ready',
  'in_progress',
  'blocked',
  'review',
  'done',
  'parked',
]);

const FRONTMATTER_ORDER = [
  'phase',
  'title',
  'status',
  'owner',
  'branch',
  'depends_on',
  'updated',
  'blocked_reason',
  'task',
  'agent',
  'session',
  'started',
  'lease_until',
  'note',
];

function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (
      fs.existsSync(path.join(dir, 'PLAN.md')) &&
      fs.existsSync(path.join(dir, 'docs', 'progress'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('Could not find repository root (PLAN.md + docs/progress)');
    }
    dir = parent;
  }
}

const ROOT = findRoot();
const PROGRESS = path.join(ROOT, 'docs', 'progress');
const PHASES = path.join(PROGRESS, 'phases');
const CLAIMS = path.join(PROGRESS, 'claims');
const HANDOFFS = path.join(PROGRESS, 'handoffs');
const WORKLOG = path.join(PROGRESS, 'WORKLOG.md');
const STATUS = path.join(PROGRESS, 'STATUS.md');

function iso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function ensureDirs() {
  for (const dir of [PROGRESS, PHASES, CLAIMS, HANDOFFS]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(WORKLOG)) {
    fs.writeFileSync(WORKLOG, '# Work Log\n\nAppend-only. Entries are written by `node scripts/progress.mjs done ...`.\n');
  }
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === '' || value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((item) => parseScalar(item))
      .filter((item) => item !== null);
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    data[key] = parseScalar(value);
  }
  return { data, body: text.slice(match[0].length) };
}

function stringifyValue(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stringifyValue).join(', ')}]`;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const string = String(value).replace(/\r?\n/g, ' ');
  if (
    string === '' ||
    /[:#\[\]{}]/.test(string) ||
    /^\s|\s$/.test(string) ||
    string.startsWith('"') ||
    string.startsWith("'")
  ) {
    return JSON.stringify(string);
  }
  return string;
}

function serializeFrontmatter(data) {
  const keys = [
    ...FRONTMATTER_ORDER.filter((key) => key in data),
    ...Object.keys(data).filter((key) => !FRONTMATTER_ORDER.includes(key)),
  ];
  return `---\n${keys.map((key) => `${key}: ${stringifyValue(data[key])}`).join('\n')}\n---\n`;
}

function writePhaseFile(phase, data, body) {
  fs.writeFileSync(phase.full, serializeFrontmatter(data) + body);
}

function phaseFiles() {
  ensureDirs();
  return fs
    .readdirSync(PHASES)
    .filter((file) => /^\d{2}-.+\.md$/.test(file))
    .sort();
}

function claimFiles() {
  ensureDirs();
  return fs
    .readdirSync(CLAIMS)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .sort();
}

function loadPhases() {
  return phaseFiles().map((file) => {
    const full = path.join(PHASES, file);
    const raw = read(full);
    const { data, body } = parseFrontmatter(raw);
    const tasks = [...body.matchAll(/^- \[([ xX])\]\s+\*\*(P\d{1,2}-\d{2})\*\*\s+(.+)$/gm)].map(
      (match) => ({
        done: match[1].toLowerCase() === 'x',
        id: match[2],
        title: match[3].trim(),
      }),
    );
    return { file, full, raw, data, body, tasks };
  });
}

function loadClaims() {
  return claimFiles().map((file) => {
    const full = path.join(CLAIMS, file);
    const raw = read(full);
    const { data } = parseFrontmatter(raw);
    return { file, full, raw, data };
  });
}

function loadWorklog() {
  ensureDirs();
  return read(WORKLOG)
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '));
}

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agent';
}

function findTask(taskId, phases = loadPhases()) {
  for (const phase of phases) {
    const task = phase.tasks.find((candidate) => candidate.id === taskId);
    if (task) return { phase, task };
  }
  return null;
}

function claimFor(taskId, claims = loadClaims()) {
  return claims.find((claim) => claim.data.task === taskId) ?? null;
}

function phaseByNumber(number, phases = loadPhases()) {
  return phases.find((phase) => Number(phase.data.phase) === Number(number)) ?? null;
}

function taskCounts(phase) {
  const total = phase.tasks.length;
  const done = phase.tasks.filter((task) => task.done).length;
  return { total, done };
}

function statusIcon(status) {
  return (
    {
      not_started: '·',
      ready: '○',
      in_progress: '◐',
      blocked: '✖',
      review: '◑',
      done: '✔',
      parked: '⏸',
    }[status] ?? '?'
  );
}

function phaseLink(phase) {
  const number = Number(phase.data.phase);
  return `[Phase ${number}](phases/${phase.file}) — ${phase.data.title ?? 'Untitled'}`;
}

function maxUpdated(phases, claims) {
  const values = [
    ...phases.map((phase) => phase.data.updated).filter(Boolean),
    ...claims.map((claim) => claim.data.started).filter(Boolean),
  ].map(String);
  if (!values.length) return 'n/a';
  return values.sort().at(-1);
}

function renderStatusText() {
  ensureDirs();
  const phases = loadPhases().sort(
    (a, b) => Number(a.data.phase) - Number(b.data.phase),
  );
  const claims = loadClaims().sort((a, b) =>
    String(a.data.task).localeCompare(String(b.data.task)),
  );
  const phaseMap = new Map(phases.map((phase) => [Number(phase.data.phase), phase]));
  const taskMap = new Map();
  for (const phase of phases) {
    for (const task of phase.tasks) taskMap.set(task.id, { phase, task });
  }
  const claimMap = new Map(claims.map((claim) => [claim.data.task, claim]));

  const totals = phases.reduce(
    (acc, phase) => {
      const counts = taskCounts(phase);
      acc.phases += 1;
      acc.tasks += counts.total;
      acc.doneTasks += counts.done;
      if (phase.data.status === 'done') acc.donePhases += 1;
      return acc;
    },
    { phases: 0, donePhases: 0, tasks: 0, doneTasks: 0 },
  );

  const focus = phases.filter((phase) => phase.data.status === 'in_progress');
  const ready = phases.filter((phase) => phase.data.status === 'ready');
  const blocked = phases.filter((phase) => phase.data.status === 'blocked');
  const expired = claims.filter(
    (claim) => claim.data.lease_until && Date.parse(claim.data.lease_until) < Date.now(),
  );

  const lines = [];
  lines.push('# BetterPBX Progress');
  lines.push('');
  lines.push(
    '> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.',
  );
  lines.push('> Do not edit by hand. Run `node scripts/progress.mjs render`.');
  lines.push('');
  lines.push(
    `**Overall:** ${totals.donePhases}/${totals.phases} phases done · ${totals.doneTasks}/${totals.tasks} tasks done`,
  );
  lines.push(`**Last phase update:** ${maxUpdated(phases, claims)}`);
  lines.push('');
  lines.push('## Current focus');
  lines.push('');
  if (focus.length) {
    for (const phase of focus) {
      const owner = phase.data.owner ? ` — owner: \`${phase.data.owner}\`` : '';
      lines.push(`- ${phaseLink(phase)}${owner}`);
    }
  } else if (ready.length) {
    lines.push(`- Next ready phase: ${phaseLink(ready[0])}`);
  } else {
    lines.push('- No phase is currently in progress.');
  }
  lines.push('');
  lines.push('## Phases');
  lines.push('');
  lines.push('| Phase | Status | Owner | Tasks | Depends on | Updated |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const phase of phases) {
    const counts = taskCounts(phase);
    const status = phase.data.status ?? 'not_started';
    const deps = Array.isArray(phase.data.depends_on) && phase.data.depends_on.length
      ? phase.data.depends_on.join(', ')
      : '—';
    lines.push(
      `| ${phaseLink(phase)} | ${statusIcon(status)} ${status} | ${phase.data.owner ?? '—'} | ${counts.done}/${counts.total} | ${deps} | ${phase.data.updated ?? '—'} |`,
    );
  }
  lines.push('');
  lines.push('## Active claims');
  lines.push('');
  if (claims.length) {
    lines.push('| Task | Phase | Agent | Started | Lease until | Note |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const claim of claims) {
      lines.push(
        `| ${claim.data.task} | ${claim.data.phase} | ${claim.data.agent ?? '—'} | ${claim.data.started ?? '—'} | ${claim.data.lease_until ?? '—'} | ${claim.data.note ?? '—'} |`,
      );
    }
  } else {
    lines.push('_None._');
  }
  lines.push('');
  lines.push('## Blocked');
  lines.push('');
  if (blocked.length) {
    for (const phase of blocked) {
      lines.push(
        `- ${phaseLink(phase)} — ${phase.data.blocked_reason ?? 'no reason recorded'}`,
      );
    }
  } else {
    lines.push('_None._');
  }
  lines.push('');
  if (expired.length) {
    lines.push('## Expired claims');
    lines.push('');
    for (const claim of expired) {
      lines.push(
        `- ${claim.data.task} — \`${claim.data.agent}\` — expired ${claim.data.lease_until}`,
      );
    }
    lines.push('');
  }
  lines.push('## Ready to claim');
  lines.push('');
  const candidates = [];
  for (const phase of phases) {
    if (!['ready', 'in_progress'].includes(phase.data.status)) continue;
    for (const task of phase.tasks) {
      if (candidates.length >= 12) break;
      if (task.done || claimMap.has(task.id)) continue;
      candidates.push(`- **${task.id}** — ${task.title} _(${phaseLink(phase)})_`);
    }
  }
  if (candidates.length) lines.push(...candidates);
  else lines.push('_None._');
  lines.push('');
  lines.push('## Recent worklog');
  lines.push('');
  const recent = loadWorklog().slice(-8);
  if (recent.length) lines.push(...recent);
  else lines.push('_No completed tasks yet._');
  lines.push('');
  return lines.join('\n');
}

function writeStatus() {
  ensureDirs();
  fs.writeFileSync(STATUS, renderStatusText());
}

function appendWorklog({ task, agent, title, commit, note }) {
  ensureDirs();
  const commitText = commit ? `commit: ${commit}` : 'commit: n/a';
  const noteText = note ? ` — ${note.replace(/\r?\n/g, ' ')}` : '';
  fs.appendFileSync(
    WORKLOG,
    `- ${iso()} — ${task} — ${agent} — ${title} — ${commitText}${noteText}\n`,
  );
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseArgs(args) {
  const options = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      options._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (['force', 'json', 'help'].includes(key)) {
      options[key] = true;
    } else {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        fail(`option --${key} requires a value`);
      }
      options[key] = value;
      i += 1;
    }
  }
  return options;
}

function agentName(options) {
  return options.agent || process.env.AGENT_NAME || 'unknown';
}

function commandStatus(options) {
  const phases = loadPhases().sort(
    (a, b) => Number(a.data.phase) - Number(b.data.phase),
  );
  const claims = loadClaims().sort((a, b) =>
    String(a.data.task).localeCompare(String(b.data.task)),
  );
  const totals = phases.reduce(
    (acc, phase) => {
      const counts = taskCounts(phase);
      acc.phases += 1;
      acc.tasks += counts.total;
      acc.doneTasks += counts.done;
      if (phase.data.status === 'done') acc.donePhases += 1;
      return acc;
    },
    { phases: 0, donePhases: 0, tasks: 0, doneTasks: 0 },
  );

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: iso(),
          root: ROOT,
          totals,
          phases: phases.map((phase) => ({
            phase: Number(phase.data.phase),
            title: phase.data.title,
            status: phase.data.status,
            owner: phase.data.owner,
            tasks: taskCounts(phase),
            taskList: phase.tasks,
            file: `docs/progress/phases/${phase.file}`,
            dependsOn: phase.data.depends_on ?? [],
            updated: phase.data.updated,
          })),
          claims: claims.map((claim) => ({
            task: claim.data.task,
            phase: claim.data.phase,
            agent: claim.data.agent,
            started: claim.data.started,
            leaseUntil: claim.data.lease_until,
            note: claim.data.note,
            file: `docs/progress/claims/${claim.file}`,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `Overall: ${totals.donePhases}/${totals.phases} phases · ${totals.doneTasks}/${totals.tasks} tasks`,
  );
  console.log('');
  for (const phase of phases) {
    const counts = taskCounts(phase);
    console.log(
      `${statusIcon(phase.data.status)} Phase ${String(phase.data.phase).padStart(2, '0')}  ${phase.data.status.padEnd(12)} ${counts.done}/${counts.total}  ${phase.data.title}`,
    );
  }
  const active = claims.filter((claim) => !taskMapDone(claim));
  if (active.length) {
    console.log('');
    console.log('Active claims:');
    for (const claim of active) {
      console.log(
        `  ${claim.data.task}  ${claim.data.agent}  lease ${claim.data.lease_until ?? 'n/a'}`,
      );
    }
  }
}

function taskMapDone(claim) {
  const found = findTask(claim.data.task);
  return Boolean(found?.task.done);
}

function commandClaim(options) {
  const taskId = options._[0];
  if (!taskId) fail('usage: claim <task-id> [--agent name] [--note text] [--hours 8] [--force]');
  const phases = loadPhases();
  const found = findTask(taskId, phases);
  if (!found) fail(`unknown task: ${taskId}`);
  if (found.task.done) fail(`task ${taskId} is already done`);
  const phaseStatus = found.phase.data.status;
  if (phaseStatus === 'done') fail(`phase ${found.phase.data.phase} is already done`);
  if (phaseStatus === 'blocked' && !options.force) {
    fail(`phase ${found.phase.data.phase} is blocked; resolve it or pass --force`);
  }

  const claimPath = path.join(CLAIMS, `${taskId}.md`);
  if (fs.existsSync(claimPath) && !options.force) {
    const existing = parseFrontmatter(read(claimPath)).data;
    fail(
      `${taskId} is already claimed by ${existing.agent ?? 'unknown'} until ${existing.lease_until ?? 'unknown'}; release it or use --force`,
    );
  }
  if (options.force) fs.rmSync(claimPath, { force: true });

  const agent = agentName(options);
  const hours = Math.max(1, Number(options.hours ?? 8));
  const branch = currentBranch();
  const started = iso();
  const leaseUntil = new Date(Date.now() + hours * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
  const claimData = {
    task: taskId,
    phase: Number(found.phase.data.phase),
    agent,
    session: options.session ?? null,
    branch,
    started,
    lease_until: leaseUntil,
    note: options.note ?? null,
  };

  let fd;
  try {
    fd = fs.openSync(claimPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') fail(`${taskId} was claimed concurrently; re-read STATUS.md`);
    throw error;
  }
  try {
    fs.writeSync(
      fd,
      `${serializeFrontmatter(claimData)}\n# Claim — ${taskId}\n\n${found.task.title}\n`,
    );
  } finally {
    fs.closeSync(fd);
  }

  const nextStatus = ['not_started', 'ready', 'review', 'parked'].includes(phaseStatus)
    ? 'in_progress'
    : phaseStatus;
  writePhaseFile(
    found.phase,
    {
      ...found.phase.data,
      status: nextStatus,
      owner: found.phase.data.owner || agent,
      branch: found.phase.data.branch || branch,
      updated: iso(),
    },
    found.phase.body,
  );
  writeStatus();
  console.log(`claimed ${taskId} for ${agent} (${hours}h lease)`);
  console.log(`  phase: ${found.phase.data.phase} — ${found.phase.data.title}`);
  console.log(`  task:  ${found.task.title}`);
}

function commandRelease(options) {
  const taskId = options._[0];
  if (!taskId) fail('usage: release <task-id> [--agent name] [--force]');
  const claim = claimFor(taskId);
  if (!claim) fail(`no claim for ${taskId}`);
  if (claim.data.agent !== agentName(options) && !options.force) {
    fail(`${taskId} is claimed by ${claim.data.agent}; use --force only with the lead's approval`);
  }
  fs.rmSync(claim.full, { force: true });
  const found = findTask(taskId);
  if (found && found.phase.data.status === 'in_progress') {
    const others = loadClaims().filter(
      (candidate) => Number(candidate.data.phase) === Number(found.phase.data.phase),
    );
    if (!others.length) {
      writePhaseFile(
        found.phase,
        { ...found.phase.data, status: 'ready', owner: null, updated: iso() },
        found.phase.body,
      );
    }
  }
  writeStatus();
  console.log(`released ${taskId}`);
}

function commandDone(options) {
  const taskId = options._[0];
  if (!taskId) {
    fail('usage: done <task-id> [--agent name] [--commit sha] [--note text] [--force]');
  }
  const phases = loadPhases();
  const found = findTask(taskId, phases);
  if (!found) fail(`unknown task: ${taskId}`);
  if (found.task.done) fail(`task ${taskId} is already checked`);
  const claim = claimFor(taskId);
  if (claim && claim.data.agent !== agentName(options) && !options.force) {
    fail(`${taskId} is claimed by ${claim.data.agent}; use --force only with the lead's approval`);
  }
  if (!claim && !options.force) {
    fail(`${taskId} has no active claim; claim it first or use --force`);
  }

  const idPattern = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const checkbox = new RegExp(
    `^(- )\\[ \\](\\s+\\*\\*${idPattern}\\*\\*.*)$`,
    'm',
  );
  if (!checkbox.test(found.phase.body)) {
    fail(`could not find unchecked checkbox for ${taskId}`);
  }
  const body = found.phase.body.replace(checkbox, '$1[x]$2');
  const remaining = [...body.matchAll(/^- \[ \]\s+\*\*(P\d{1,2}-\d{2})\*\*/gm)];
  const agent = agentName(options);

  if (claim) fs.rmSync(claim.full, { force: true });
  const otherClaims = loadClaims().filter(
    (candidate) => Number(candidate.data.phase) === Number(found.phase.data.phase),
  );
  const nextStatus = remaining.length
    ? otherClaims.length
      ? 'in_progress'
      : 'ready'
    : 'done';
  writePhaseFile(
    found.phase,
    {
      ...found.phase.data,
      status: nextStatus,
      owner: nextStatus === 'ready' ? null : found.phase.data.owner || agent,
      updated: iso(),
    },
    body,
  );
  appendWorklog({
    task: taskId,
    agent,
    title: found.task.title,
    commit: options.commit,
    note: options.note,
  });
  writeStatus();
  console.log(`completed ${taskId} for ${agent} — phase status: ${nextStatus}`);
}

function commandSetPhase(options) {
  const [phaseNumber, status] = options._;
  if (!phaseNumber || !status) {
    fail(`usage: set-phase <n> <${[...STATUSES].join('|')}> [--owner name] [--note reason]`);
  }
  if (!STATUSES.has(status)) fail(`invalid status: ${status}`);
  const phases = loadPhases();
  const phase = phaseByNumber(phaseNumber, phases);
  if (!phase) fail(`unknown phase: ${phaseNumber}`);
  const counts = taskCounts(phase);
  if (status === 'done' && counts.done !== counts.total && !options.force) {
    fail(
      `phase ${phaseNumber} has ${counts.total - counts.done} unchecked task(s); finish them or pass --force`,
    );
  }
  const claims = loadClaims().filter(
    (claim) => Number(claim.data.phase) === Number(phaseNumber),
  );
  if (status === 'done' && claims.length && !options.force) {
    fail(`phase ${phaseNumber} still has ${claims.length} active claim(s)`);
  }
  const owner =
    options.owner === undefined
      ? phase.data.owner
      : options.owner === 'null' || options.owner === 'none'
        ? null
        : options.owner;
  writePhaseFile(
    phase,
    {
      ...phase.data,
      status,
      owner,
      updated: iso(),
      blocked_reason: status === 'blocked' ? options.note ?? phase.data.blocked_reason ?? null : null,
    },
    phase.body,
  );
  writeStatus();
  console.log(`phase ${phaseNumber} -> ${status}`);
}

function commandHandoff(options) {
  const agent = agentName(options);
  const stamp = iso().replace(/[:]/g, '-');
  const file = path.join(HANDOFFS, `${stamp}-${slug(agent)}.md`);
  const claims = loadClaims().filter((claim) => claim.data.agent === agent);
  const claimLines = claims.length
    ? claims
        .map(
          (claim) =>
            `- ${claim.data.task} — ${claim.data.phase} — lease ${claim.data.lease_until ?? 'n/a'} — ${claim.data.note ?? ''}`,
        )
        .join('\n')
    : '- No active claims.';
  const content = `---
agent: ${agent}
created: ${iso()}
phase: ${claims[0]?.data.phase ?? 'null'}
tasks: [${claims.map((claim) => claim.data.task).join(', ')}]
---

# Handoff — ${agent}

## Current state

<!-- What is done, what is in flight, and what is not started. -->

## Files changed

- 

## Tests run

- 

## Next steps

- 

## Blockers / decisions

- 

## Active claims

${claimLines}
`;
  fs.writeFileSync(file, content);
  console.log(path.relative(ROOT, file));
}

function commandCheck() {
  const phases = loadPhases().sort(
    (a, b) => Number(a.data.phase) - Number(b.data.phase),
  );
  const claims = loadClaims();
  const errors = [];
  const warnings = [];
  const taskMap = new Map();

  if (!phases.length) errors.push('no phase files found in docs/progress/phases');

  for (const phase of phases) {
    const number = Number(phase.data.phase);
    if (!Number.isInteger(number) || number < 0) {
      errors.push(`${phase.file}: invalid phase number`);
    }
    if (!phase.data.title) warnings.push(`${phase.file}: missing title`);
    if (!STATUSES.has(phase.data.status)) {
      errors.push(`${phase.file}: invalid status "${phase.data.status}"`);
    }
    if (!phase.tasks.length) errors.push(`${phase.file}: no tasks found`);

    const prefix = `P${number}-`;
    for (const task of phase.tasks) {
      if (taskMap.has(task.id)) {
        errors.push(`duplicate task id ${task.id} in ${phase.file} and ${taskMap.get(task.id).phase.file}`);
      } else {
        taskMap.set(task.id, { phase, task });
      }
      if (!task.id.startsWith(prefix)) {
        errors.push(`${phase.file}: task ${task.id} does not match phase prefix ${prefix}`);
      }
    }

    for (const dependency of phase.data.depends_on ?? []) {
      const dep = phaseByNumber(dependency, phases);
      if (!dep) {
        errors.push(`${phase.file}: unknown dependency phase ${dependency}`);
      } else if (
        ['in_progress', 'review', 'done'].includes(phase.data.status) &&
        dep.data.status !== 'done'
      ) {
        warnings.push(
          `${phase.file}: phase is ${phase.data.status} but dependency phase ${dependency} is ${dep.data.status}`,
        );
      }
    }

    const counts = taskCounts(phase);
    if (phase.data.status === 'done' && counts.done !== counts.total) {
      errors.push(`${phase.file}: status done but ${counts.total - counts.done} task(s) unchecked`);
    }
    if (phase.data.status === 'blocked' && !phase.data.blocked_reason) {
      warnings.push(`${phase.file}: blocked without blocked_reason`);
    }
  }

  for (const claim of claims) {
    if (!claim.data.task) {
      errors.push(`${claim.file}: missing task id`);
      continue;
    }
    if (claim.file !== `${claim.data.task}.md`) {
      errors.push(`${claim.file}: filename must match task id ${claim.data.task}.md`);
    }
    const found = taskMap.get(claim.data.task);
    if (!found) {
      errors.push(`${claim.file}: claim references unknown task ${claim.data.task}`);
    } else if (found.task.done) {
      errors.push(`${claim.file}: task ${claim.data.task} is already done but still claimed`);
    }
    if (!claim.data.agent) warnings.push(`${claim.file}: missing agent`);
    if (
      claim.data.lease_until &&
      Date.parse(claim.data.lease_until) < Date.now()
    ) {
      warnings.push(
        `${claim.file}: lease expired at ${claim.data.lease_until} (owner ${claim.data.agent})`,
      );
    }
  }

  for (const phase of phases) {
    const active = claims.filter(
      (claim) => Number(claim.data.phase) === Number(phase.data.phase),
    ).length;
    if (phase.data.status === 'in_progress' && active === 0) {
      warnings.push(`${phase.file}: in_progress with no active claims`);
    }
    if (phase.data.status === 'done' && active > 0) {
      errors.push(`${phase.file}: done phase still has ${active} claim(s)`);
    }
  }

  const expected = renderStatusText();
  const actual = fs.existsSync(STATUS) ? read(STATUS) : null;
  if (actual === null) {
    errors.push('docs/progress/STATUS.md is missing; run node scripts/progress.mjs render');
  } else if (actual !== expected) {
    errors.push('docs/progress/STATUS.md is stale; run node scripts/progress.mjs render');
  }

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (errors.length) {
    console.error(`\nprogress check failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `progress check OK: ${phases.length} phases, ${taskMap.size} tasks, ${claims.length} active claim(s), ${warnings.length} warning(s)`,
  );
}

function commandRender() {
  writeStatus();
  console.log(path.relative(ROOT, STATUS));
}

function commandHelp() {
  console.log(`BetterPBX progress tracker

Usage:
  node scripts/progress.mjs <command> [options]

Commands:
  status [--json]                  Show a summary (JSON for agents)
  render                           Regenerate docs/progress/STATUS.md
  check                            Validate tasks, claims, and generated status
  claim <task-id> [--agent name] [--note text] [--hours 8] [--force]
  release <task-id> [--agent name] [--force]
  done <task-id> [--agent name] [--commit sha] [--note text] [--force]
  set-phase <n> <status> [--owner name] [--note reason] [--force]
  handoff [--agent name]           Create a session handoff file
  help

Environment:
  AGENT_NAME                       Default agent name for claim/done/handoff

Statuses:
  ${[...STATUSES].join(', ')}
`);
}

function main() {
  ensureDirs();
  const [command, ...args] = process.argv.slice(2);
  const options = parseArgs(args);
  switch (command) {
    case 'status':
      commandStatus(options);
      break;
    case 'render':
      commandRender();
      break;
    case 'check':
      commandCheck();
      break;
    case 'claim':
      commandClaim(options);
      break;
    case 'release':
      commandRelease(options);
      break;
    case 'done':
      commandDone(options);
      break;
    case 'set-phase':
      commandSetPhase(options);
      break;
    case 'handoff':
      commandHandoff(options);
      break;
    case 'help':
    case undefined:
      commandHelp();
      break;
    default:
      fail(`unknown command: ${command}. Run help.`);
  }
}

main();
