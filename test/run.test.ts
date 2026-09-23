import { describe, expect, it } from 'vitest';
import type { PullRequestClient } from '../src/github';
import type { ChangedFile, DesiredComment, ExistingComment } from '../src/plan';
import { buildBody, commentKey } from '../src/plan';
import { type Reporter, run } from '../src/run';

const DOC = ['```mermaid', 'graph TD', '```'].join('\n');
const ADDED = ['@@ -0,0 +1,3 @@', '+```mermaid', '+graph TD', '+```'].join('\n');
const KEY = commentKey('a.md', 0);

interface Fake extends PullRequestClient {
  log: string[];
}

function fake(files: ChangedFile[], existing: ExistingComment[], writeError?: unknown): Fake {
  const log: string[] = [];
  const write = async (entry: string) => {
    if (writeError !== undefined) throw writeError;
    log.push(entry);
  };
  return {
    log,
    listChangedFiles: async () => files,
    readHeadFile: async (path) => (path === 'a.md' || path === 'e.md' ? DOC : undefined),
    listReviewComments: async () => existing,
    createReviewComment: (c: DesiredComment) => write(`create ${c.key} ${c.startLine}-${c.line}`),
    updateReviewComment: (id, body) => write(`update ${id} ${body.length > 0}`),
    deleteReviewComment: (id) => write(`delete ${id}`),
  };
}

function reporter(): Reporter & { lines: string[] } {
  const lines: string[] = [];
  return { lines, info: (m) => lines.push(`info ${m}`), warning: (m) => lines.push(`warn ${m}`) };
}

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
        { path: 'a.md', status: 'added', patch: ADDED },
        { path: 'b.md', status: 'modified', patch: ADDED },
        { path: 'c.ts', status: 'modified', patch: '@@ -1 +1 @@\n+x' },
        { path: 'd.md', status: 'removed' },
        { path: 'e.md', status: 'added', patch: ADDED },
      ],
      [stale, same, stale2],
    );
    const report = reporter();
    const result = await run(client, 'default', report);
    expect(result.outcome).toBe('completed');
    expect(result.comments).toBe(2);
    expect(client.log).toEqual(['delete 1', 'delete 2', 'update 3 true', `create ${KEY} 1-3`]);
    expect(result.summary).toEqual(['- `b.md`: skipped, head content could not be read']);
    expect(report.lines).toEqual([
      'warn b.md: skipped, head content could not be read',
      'info removed comment for a.md#9',
      'info removed comment for b.md#0',
      `info commented on ${KEY} lines 1-3`,
    ]);
  });

  it('falls back to the job summary when the token cannot write', async () => {
    const client = fake([{ path: 'a.md', status: 'added', patch: ADDED }], [], { status: 403 });
    const report = reporter();
    const result = await run(client, 'dark', report);
    expect(result.outcome).toBe('read-only');
    expect(result.comments).toBe(0);
    expect(result.summary.join('\n')).toContain('mermaid.live/view#pako:');
    expect(result.summary.join('\n')).not.toContain('<!--');
    expect(report.lines.at(-1)).toMatch(/^warn the token cannot write/);
  });

  it('rethrows any other error', async () => {
    const client = fake([{ path: 'a.md', status: 'added', patch: ADDED }], [], new Error('boom'));
    await expect(run(client, 'default', reporter())).rejects.toThrow('boom');
  });
});
