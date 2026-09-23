import { describe, expect, it } from 'vitest';
import { buildBody, commentKey, isMarkdown, keyOf, marker, plan } from '../src/plan';

const DOC = ['# T', '```mermaid', 'graph TD', '  a --> b', '```', 'tail'].join('\n');
// Whole file added.
const ADDED = [
  '@@ -0,0 +1,6 @@',
  '+# T',
  '+```mermaid',
  '+graph TD',
  '+  a --> b',
  '+```',
  '+tail',
].join('\n');
const KEY = commentKey('docs/a.md', 0);
const BODY = buildBody(KEY, 'graph TD\n  a --> b', 'default', false);

describe('helpers', () => {
  it('marker and keyOf agree', () => {
    expect(keyOf(`${marker('x.md#2')}\nrest`)).toBe('x.md#2');
    expect(keyOf('no marker')).toBeNull();
  });
  it('isMarkdown matches the Markdown extensions only', () => {
    expect(['a.md', 'b.MD', 'c.markdown', 'd.mdx'].every(isMarkdown)).toBe(true);
    expect(isMarkdown('a.ts')).toBe(false);
  });
  it('buildBody notes a partial anchor', () => {
    expect(buildBody('k', 'x', 'default', true)).toContain('Only part of this block');
    expect(BODY).not.toContain('Only part');
    expect(BODY.startsWith(marker(KEY))).toBe(true);
  });
});

describe('plan', () => {
  it('creates a full-range comment for a changed block with no existing comment', () => {
    const result = plan(
      [{ path: 'docs/a.md', status: 'added', patch: ADDED, content: DOC }],
      [],
      'default',
    );
    expect(result).toEqual({
      create: [{ key: KEY, path: 'docs/a.md', startLine: 2, line: 5, body: BODY }],
      update: [],
      remove: [],
      skipped: [],
    });
  });

  it('skips non-Markdown, removed files, files without a diff or content', () => {
    const result = plan(
      [
        { path: 'a.ts', status: 'modified', patch: ADDED, content: DOC },
        { path: 'gone.md', status: 'removed' },
        { path: 'big.md', status: 'modified', content: DOC },
        { path: 'unread.md', status: 'modified', patch: ADDED },
      ],
      [],
      'default',
    );
    expect(result.create).toEqual([]);
    expect(result.skipped).toEqual([
      { path: 'big.md', reason: 'GitHub returned no diff for this file' },
      { path: 'unread.md', reason: 'head content could not be read' },
    ]);
  });

  it('does not comment on a block the diff did not touch', () => {
    const patch = ['@@ -6 +6 @@', '-old tail', '+tail'].join('\n');
    const result = plan(
      [{ path: 'docs/a.md', status: 'modified', patch, content: DOC }],
      [],
      'default',
    );
    expect(result.create).toEqual([]);
  });

  it('updates in place when the range is unchanged and the link changed', () => {
    const existing = {
      id: 7,
      path: 'docs/a.md',
      body: buildBody(KEY, 'stale', 'default', false),
      line: 5,
      startLine: 2,
    };
    const result = plan(
      [{ path: 'docs/a.md', status: 'added', patch: ADDED, content: DOC }],
      [existing],
      'default',
    );
    expect(result.update).toEqual([{ id: 7, body: BODY }]);
    expect(result.create).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it('leaves an up-to-date comment alone', () => {
    const existing = { id: 7, path: 'docs/a.md', body: BODY, line: 5, startLine: 2 };
    const result = plan(
      [{ path: 'docs/a.md', status: 'added', patch: ADDED, content: DOC }],
      [existing],
      'default',
    );
    expect(result).toEqual({ create: [], update: [], remove: [], skipped: [] });
  });

  it('replaces a comment whose range moved, since the API cannot move one', () => {
    const existing = { id: 7, path: 'docs/a.md', body: BODY, line: 4, startLine: null };
    const result = plan(
      [{ path: 'docs/a.md', status: 'added', patch: ADDED, content: DOC }],
      [existing],
      'default',
    );
    expect(result.remove).toEqual([{ id: 7, key: KEY }]);
    expect(result.create.map((c) => c.key)).toEqual([KEY]);
  });

  it('removes a comment for a block that is no longer changed, and duplicates', () => {
    const stale = {
      id: 1,
      path: 'docs/a.md',
      body: buildBody('docs/a.md#3', 'x', 'default', false),
      line: 9,
      startLine: null,
    };
    const first = { id: 2, path: 'docs/a.md', body: BODY, line: 5, startLine: 2 };
    const dup = { id: 3, path: 'docs/a.md', body: BODY, line: 5, startLine: 2 };
    const human = { id: 4, path: 'docs/a.md', body: 'nice diagram', line: 3, startLine: null };
    const result = plan(
      [{ path: 'docs/a.md', status: 'added', patch: ADDED, content: DOC }],
      [stale, first, dup, human],
      'default',
    );
    expect(result.remove).toEqual([
      { id: 1, key: 'docs/a.md#3' },
      { id: 3, key: KEY },
    ]);
    expect(result.create).toEqual([]);
    expect(result.update).toEqual([]);
  });

  it('anchors partially when the block is longer than the hunk', () => {
    const long = ['```mermaid', ...Array.from({ length: 12 }, (_, i) => `n${i}`), '```'].join('\n');
    // Only head line 7 changed; the hunk shows 4-10 with three lines of context.
    const patch = ['@@ -4,6 +4,7 @@', ' n2', ' n3', ' n4', '+n5', ' n6', ' n7', ' n8'].join('\n');
    const result = plan(
      [{ path: 'x.md', status: 'modified', patch, content: long }],
      [],
      'default',
    );
    expect(result.create[0]).toMatchObject({ startLine: 4, line: 10 });
    expect(result.create[0]?.body).toContain('Only part of this block');
  });
});
