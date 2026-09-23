import { describe, expect, it } from 'vitest';
import type { ChangedFile, ExistingComment } from '../src/plan';
import { type Reporter, run } from '../src/run';
import { body, fakePullRequest, PAKO } from './helpers';

const DOC = { content: ['```mermaid', 'graph TD', '```'].join('\n') };
const ADDED = ['@@ -0,0 +1,3 @@', '+```mermaid', '+graph TD', '+```'].join('\n');
const SYMLINK = { unreadable: 'the path is a symlink, not a file' };

function changed(path: string, over: Partial<ChangedFile> = {}): ChangedFile {
  return { path, status: 'added', changes: 3, patch: ADDED, ...over };
}

function reporter(): Reporter & { lines: string[] } {
  const lines: string[] = [];
  return { lines, info: (m) => lines.push(`info ${m}`), warning: (m) => lines.push(`warn ${m}`) };
}

const SAME_REPO = { theme: 'default', type: 'link', allowReadOnly: false } as const;
const FORK = { theme: 'dark', type: 'link', allowReadOnly: true } as const;
const denied = () =>
  Object.assign(new Error('Resource not accessible by integration'), { status: 403 });

describe('run', () => {
  it('leaves the pull request with one current comment per changed block', async () => {
    const before: ExistingComment[] = [
      // A block that is no longer changed.
      { id: 1, path: 'a.md', body: body('a.md#9', 'x'), line: 1, startLine: null },
      // A file that can no longer be read.
      { id: 2, path: 'b.md', body: body('b.md#0', 'old'), line: 3, startLine: 1 },
      // Same range, stale link.
      { id: 3, path: 'e.md', body: body('e.md#0', 'old'), line: 3, startLine: 1 },
      { id: 4, path: 'a.md', body: 'nice diagram', line: 2, startLine: null },
    ];
    const pr = fakePullRequest({
      files: [
        changed('a.md'),
        changed('b.md', { status: 'modified' }),
        changed('c.ts', { status: 'modified', patch: '@@ -1 +1 @@\n+x' }),
        changed('d.md', { status: 'removed', patch: undefined }),
        changed('e.md'),
      ],
      // c.ts and the removed d.md are not readable at head; reading one would throw.
      head: { 'a.md': DOC, 'b.md': SYMLINK, 'e.md': DOC },
      comments: before,
    });
    const report = reporter();
    const result = await run(pr, SAME_REPO, report);
    expect(result.outcome).toBe('completed');
    expect(result.comments).toBe(2);
    expect(pr.comments).toEqual([
      {
        id: 3,
        path: 'e.md',
        body: body('e.md#0', PAKO['graph TD|default']),
        line: 3,
        startLine: 1,
      },
      { id: 4, path: 'a.md', body: 'nice diagram', line: 2, startLine: null },
      {
        id: 100,
        path: 'a.md',
        body: body('a.md#0', PAKO['graph TD|default']),
        line: 3,
        startLine: 1,
      },
    ]);
    expect(result.summary).toEqual(['- `b.md`: skipped, the path is a symlink, not a file']);
    expect(report.lines).toEqual([
      'warn b.md: skipped, the path is a symlink, not a file',
      'info removed comment for a.md#9',
      'info removed comment for b.md#0',
      'info commented on a.md#0 lines 1-3',
    ]);
  });

  it('falls back to the job summary on a fork when the token cannot write', async () => {
    const pr = fakePullRequest({
      files: [changed('a.md'), changed('e.md')],
      head: { 'a.md': DOC, 'e.md': DOC },
      comments: [{ id: 2, path: 'e.md', body: body('e.md#0', 'old'), line: 3, startLine: 1 }],
      writeError: denied(),
    });
    const report = reporter();
    const result = await run(pr, FORK, report);
    expect(result.outcome).toBe('read-only');
    expect(result.comments).toBe(0);
    const links = (pako: string) =>
      `[view](https://mermaid.live/view#pako:${pako}) or [edit](https://mermaid.live/edit#pako:${pako})`;
    // Updates and creates both listed, each named by path and range, marker stripped.
    // Marker and footer stripped: the summary is one line per block.
    expect(result.summary).toEqual([
      `- \`e.md\` lines 1-3: Preview this diagram on mermaid.live: ${links(PAKO['graph TD|dark'])}.`,
      `- \`a.md\` lines 1-3: Preview this diagram on mermaid.live: ${links(PAKO['graph TD|dark'])}.`,
    ]);
    expect(report.lines.at(-1)).toBe(
      'warn the token cannot write review comments (403: Resource not accessible by integration); 0 written before that; links are in the job summary',
    );
  });

  it('fails a same-repository run on a 403, naming the block and the permission', async () => {
    const pr = fakePullRequest({
      files: [changed('a.md')],
      head: { 'a.md': DOC },
      writeError: denied(),
    });
    await expect(run(pr, SAME_REPO, reporter())).rejects.toThrow(
      'writing the comment for a.md#0: Resource not accessible by integration (does the job grant pull-requests: write?)',
    );
  });

  it('fails a fork run on anything but a 403', async () => {
    const gone = fakePullRequest({
      files: [changed('a.md')],
      head: { 'a.md': DOC },
      comments: [{ id: 1, path: 'a.md', body: body('a.md#9', 'x'), line: 1, startLine: null }],
      writeError: Object.assign(new Error('Not Found'), { status: 404 }),
    });
    await expect(run(gone, FORK, reporter())).rejects.toThrow(
      'writing the comment for a removed block: Not Found',
    );
    const boom = fakePullRequest({
      files: [changed('a.md')],
      head: { 'a.md': DOC },
      writeError: new Error('boom'),
    });
    await expect(run(boom, FORK, reporter())).rejects.toThrow(
      'writing the comment for a.md#0: boom',
    );
  });
});
