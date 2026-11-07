import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface GitCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
}

export interface GitManagerOptions {
  repoDir: string;
  gitBin?: string;
}

export class GitManager {
  private readonly repoDir: string;
  private readonly gitBin: string;

  constructor(options: GitManagerOptions) {
    this.repoDir = options.repoDir;
    this.gitBin = options.gitBin ?? 'git';
  }

  ensureRepo(): void {
    mkdirSync(this.repoDir, { recursive: true });
    if (!existsSync(join(this.repoDir, '.git'))) {
      this.run(['init', '-q', '-b', 'main']);
      this.run(['config', 'user.email', 'better-pbx@localhost']);
      this.run(['config', 'user.name', 'BetterPBX']);
    }
  }

  isRepo(): boolean {
    return existsSync(join(this.repoDir, '.git'));
  }

  headSha(): string | null {
    try {
      return this.run(['rev-parse', 'HEAD']).trim();
    } catch {
      return null;
    }
  }

  statusPorcelain(): string {
    return this.run(['status', '--porcelain']);
  }

  isClean(): boolean {
    return this.statusPorcelain().trim() === '';
  }

  readFileAt(sha: string, filePath: string): string {
    // filePath relative to repo root
    return this.run(['show', `${sha}:${filePath}`]);
  }

  listCommits(limit = 50): GitCommit[] {
    const format = '%H%x1f%h%x1f%s%x1f%an%x1f%aI';
    let out = '';
    try {
      out = this.run(['log', `--pretty=format:${format}`, `-n`, String(limit)]);
    } catch {
      return [];
    }
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\x1f');
        return {
          sha: parts[0] ?? '',
          shortSha: parts[1] ?? '',
          message: parts[2] ?? '',
          author: parts[3] ?? '',
          date: parts[4] ?? '',
        };
      });
  }

  diff(fromSha?: string, toSha?: string): string {
    const args = ['diff'];
    if (fromSha && toSha) args.push(fromSha, toSha);
    else if (fromSha) args.push(`${fromSha}^`, fromSha);
    return this.run(args);
  }

  showCommit(sha: string): { sha: string; message: string; diff: string } {
    const message = this.run(['log', '-1', '--pretty=%B', sha]).trim();
    const diff = this.run(['show', '--format=', sha]);
    return { sha, message, diff };
  }

  commitAll(message: string, authorName: string, authorEmail: string): string {
    this.run(['add', '-A']);
    // ensure there is something to commit; allow empty? We want a commit per mutation; if no changes, skip.
    const staged = this.run(['diff', '--cached', '--name-only']).trim();
    if (!staged) {
      // nothing changed; return current head if exists
      const head = this.headSha();
      if (head) return head;
    }
    this.run(
      ['-c', `user.name=${authorName}`, '-c', `user.email=${authorEmail}`, 'commit', '-q', '-m', message],
    );
    return this.headSha() ?? '';
  }

  restoreFilesFrom(sha: string): void {
    // restore working tree files from commit without moving HEAD
    this.run(['restore', '--source', sha, '--worktree', '--', '.']);
  }

  private run(args: string[]): string {
    const fullArgs = ['-C', this.repoDir, ...args];
    try {
      return execFileSync(this.gitBin, fullArgs, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
        env: { ...process.env },
      });
    } catch (e: unknown) {
      const err = e as { stderr?: unknown; message?: string };
      const stderr = (err.stderr as { toString?(): string })?.toString?.() ?? err.message ?? String(e);
      throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
    }
  }
}