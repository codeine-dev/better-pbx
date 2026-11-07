export interface CommandResult {
  stdout: string;
  stderr: string;
  status: number;
}

export type CommandRunner = (cmd: string, args: string[], options?: { timeoutMs?: number }) => CommandResult;

import { execFileSync } from 'node:child_process';

export function defaultRunner(cmd: string, args: string[], options?: { timeoutMs?: number }): CommandResult {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: options?.timeoutMs ?? 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout: stdout ?? '', stderr: '', status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: unknown; stderr?: unknown; message?: string; status?: number };
    return {
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? err.message ?? e),
      status: typeof err.status === 'number' ? err.status : 1,
    };
  }
}

export class AsteriskCli {
  constructor(private runner: CommandRunner = defaultRunner, private binary = 'asterisk') {}

  setRunner(runner: CommandRunner): void {
    this.runner = runner;
  }

  reload(module: string): CommandResult {
    return this.runner(this.binary, ['-rx', `module reload ${module}`], { timeoutMs: 10000 });
  }

  reloadDialplan(): CommandResult {
    return this.reload('pbx_config');
  }
  reloadPjsip(): CommandResult {
    return this.reload('res_pjsip');
  }
  reloadVoicemail(): CommandResult {
    return this.reload('app_voicemail');
  }
  reloadQueues(): CommandResult {
    return this.reload('app_queue');
  }

  coreShowChannels(): CommandResult {
    return this.runner(this.binary, ['-rx', 'core show channels count'], { timeoutMs: 5000 });
  }

  ping(): CommandResult {
    return this.runner(this.binary, ['-rx', 'core show version'], { timeoutMs: 5000 });
  }
}

export class Fail2banCli {
  constructor(private runner: CommandRunner = defaultRunner, private binary = 'fail2ban-client') {}

  setRunner(runner: CommandRunner): void {
    this.runner = runner;
  }

  checkConfig(): CommandResult {
    return this.runner(this.binary, ['-t'], { timeoutMs: 10000 });
  }

  reload(): CommandResult {
    return this.runner(this.binary, ['reload'], { timeoutMs: 10000 });
  }

  status(jail = 'asterisk'): CommandResult {
    return this.runner(this.binary, ['status', jail], { timeoutMs: 10000 });
  }
}