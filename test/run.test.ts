import { describe, expect, it } from 'vitest';
import type { HeadFile, PullRequestClient } from '../src/github';
import type { ChangedFile, DesiredComment, ExistingComment } from '../src/plan';
import { buildBody, commentKey } from '../src/plan';
import { type Reporter, run } from '../src/run';

const DOC = ['```mermaid', 'graph TD', '```'].join('\n');
const ADDED = ['@@ -0,0 +1,3 @@', '+```mermaid', '+graph TD', '+```'].join('\n');
const KEY = commentKey('a.md', 0);

interface Fake extends PullRequestClient {
  log: string[];
}

function fake(
  files: Partial<ChangedFile>[],
  existing: ExistingComment[],
  writeError?: unknown,
): Fake {
  const log: string[] = [];
  const write = async (entry: string) => {
    if (writeError !== undefined) throw writeError;
    log.push(entry);
  };
  return {
    log,
    listChangedFiles: async () =>
      files.map((f) => ({ path: 'a.md', status: 'added', changes: 3, ...f }) as ChangedFile),
    readHeadFile: async (path): Promise<HeadFile> => {
      log.push(`read ${path}`);
      if (path === 'a.md' || path === 'e.md') return { content: DOC };
      if (path === 'b.md') return { unreadable: 'the path is a symlink, not a file' };
      throw new Error(`reading ${path}: Not Found`);
    },
    listReviewComments: async () => existing,
    createReviewComment: (c: DesiredComment) => write(`create ${c.key} ${c.startLine}-${c.line}`),
    updateReviewComment: (id, body) =>
      write(`update ${id} ${body === buildBody('e.md#0', 'graph TD', 'default', false)}`),
    deleteReviewComment: (id) => write(`delete ${id}`),
  };
}

function reporter(): Reporter & { lines: string[] } {
  const lines: string[] = [];
  return { lines, info: (m) => lines.push(`info ${m}`), warning: (m) => lines.push(`warn ${m}`) };
}

const SAME_REPO = { theme: 'default', allowReadOnly: false };
const FORK = { theme: 'dark', allowReadOnly: true };

describe('run', () => {
  it('reads changed Markdown at head, applies the plan in delete, update, create order', async () => {
    const stale = {
      id: 1,
      path: 'a.md',
      body: buildBody('a.md#9', 'x', 'default', false),
      line: 1,
      startLine: null,
    };
    const same = {
      id: 2,
      path: 'b.md',
      body: buildBody('b.md#0', 'old', 'default', false),
      line: 3,
      startLine: 1,
    };
    const stale2 = {
      id: 3,
      path: 'e.md',
      body: buildBody('e.md#0', 'old', 'default', false),
      line: 3,
      startLine: 1,
    };
    const client = fake(
      [
        { path: 'a.md', patch: ADDED },
        { path: 'b.md', status: 'modified', patch: ADDED },
        { path: 'c.ts', status: 'modified', patch: '@@ -1 +1 @@\n+x' },
        { path: 'd.md', status: 'removed' },
        { path: 'e.md', patch: ADDED },
      ],
      [stale, same, stale2],
    );
    const report = reporter();
    const result = await run(client, SAME_REPO, report);
    expect(result.outcome).toBe('completed');
    expect(result.comments).toBe(2);
    // c.ts and the removed d.md are never read at head.
    expect(client.log).toEqual([
      'read a.md',
      'read b.md',
      'read e.md',
      'delete 1',
      'delete 2',
      'update 3 true',
      `create ${KEY} 1-3`,
    ]);
    expect(result.summary).toEqual(['- `b.md`: skipped, the path is a symlink, not a file']);
    expect(report.lines).toEqual([
      'warn b.md: skipped, the path is a symlink, not a file',
      'info removed comment for a.md#9',
      'info removed comment for b.md#0',
      `info commented on ${KEY} lines 1-3`,
    ]);
  });

  it('falls back to the job summary on a fork when the token cannot write', async () => {
    const same = {
      id: 2,
      path: 'e.md',
      body: buildBody('e.md#0', 'old', 'dark', false),
      line: 3,
      startLine: 1,
    };
    const client = fake(
      [
        { path: 'a.md', patch: ADDED },
        { path: 'e.md', patch: ADDED },
      ],
      [same],
      Object.assign(new Error('Resource not accessible by integration'), { status: 403 }),
    );
    const report = reporter();
    const result = await run(client, FORK, report);
    expect(result.outcome).toBe('read-only');
    expect(result.comments).toBe(0);
    // Updates and creates both listed, each named by path and range, marker stripped.
    expect(result.summary).toEqual([
      `- \`e.md\` lines 1-3: ${buildBody('e.md#0', 'graph TD', 'dark', false).replace(/^<!--.*-->\n/, '')}`,
      `- \`a.md\` lines 1-3: ${buildBody(KEY, 'graph TD', 'dark', false).replace(/^<!--.*-->\n/, '')}`,
    ]);
    expect(result.summary.join('\n')).not.toContain('<!--');
    expect(report.lines.at(-1)).toBe(
      'warn the token cannot write review comments (403: Resource not accessible by integration); 0 written before that; links are in the job summary',
    );
  });

  it('fails a same-repository run on a 403, naming the block and the permission', async () => {
    const client = fake(
      [{ path: 'a.md', patch: ADDED }],
      [],
      Object.assign(new Error('Resource not accessible by integration'), { status: 403 }),
    );
    await expect(run(client, SAME_REPO, reporter())).rejects.toThrow(
      `writing the comment for ${KEY}: Resource not accessible by integration (does the job grant pull-requests: write?)`,
    );
  });

  it('fails a fork run on anything but a 403', async () => {
    const stale = {
      id: 1,
      path: 'a.md',
      body: buildBody('a.md#9', 'x', 'dark', false),
      line: 1,
      startLine: null,
    };
    const client = fake(
      [{ path: 'a.md', patch: ADDED }],
      [stale],
      Object.assign(new Error('Not Found'), { status: 404 }),
    );
    await expect(run(client, FORK, reporter())).rejects.toThrow(
      'writing the comment for a removed block: Not Found',
    );
    await expect(
      run(fake([{ path: 'a.md', patch: ADDED }], [], new Error('boom')), FORK, reporter()),
    ).rejects.toThrow(`writing the comment for ${KEY}: boom`);
  });
});
