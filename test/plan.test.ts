import { describe, expect, it } from 'vitest';
import type { ChangedFile, ExistingComment } from '../src/plan';
import { buildBody, commentKey, isMarkdown, keyOf, marker, plan } from '../src/plan';
import { decode } from './helpers';

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

function file(over: Partial<ChangedFile> = {}): ChangedFile {
  return { path: 'docs/a.md', status: 'added', changes: 6, patch: ADDED, content: DOC, ...over };
}

function existing(over: Partial<ExistingComment> = {}): ExistingComment {
  return { id: 7, path: 'docs/a.md', body: BODY, line: 5, startLine: 2, ...over };
}

describe('helpers', () => {
  it('marker and keyOf agree', () => {
    expect(keyOf(`${marker('x.md#2')}\nrest`)).toBe('x.md#2');
    expect(keyOf('no marker')).toBeNull();
  });
  it('isMarkdown matches the Markdown extensions only', () => {
    expect(['a.md', 'b.MD', 'c.markdown', 'd.mdx'].every(isMarkdown)).toBe(true);
    expect(isMarkdown('a.ts')).toBe(false);
  });
  it('buildBody is the marker, one sentence with both links, and a note when partial', () => {
    const view = /\[view\]\((https:\/\/mermaid\.live\/view#pako:[A-Za-z0-9_-]+)\)/.exec(BODY)?.[1];
    const edit = view?.replace('/view#', '/edit#');
    expect(BODY).toBe(
      `${marker(KEY)}\nPreview this diagram on mermaid.live: [view](${view}) or [edit](${edit}).`,
    );
    expect(buildBody('k', 'x', 'default', true)).toBe(
      `${buildBody('k', 'x', 'default', false)}\n\n_Only part of this block is in the diff, so the comment spans that part._`,
    );
  });
});

describe('plan', () => {
  it('creates a full-range comment for a changed block with no existing comment', () => {
    expect(plan([file()], [], 'default')).toEqual({
      create: [{ key: KEY, path: 'docs/a.md', startLine: 2, line: 5, body: BODY }],
      update: [],
      remove: [],
      skipped: [],
    });
  });

  it('encodes the theme into the link', () => {
    const [created] = plan([file()], [], 'forest').create;
    const encoded = /view#pako:([A-Za-z0-9_-]+)\)/.exec(created?.body ?? '')?.[1] ?? '';
    expect(JSON.parse(decode(encoded).mermaid)).toEqual({ theme: 'forest' });
  });

  it('keys each block by its ordinal in the file, not among the changed blocks', () => {
    const two = [DOC, '```mermaid', 'pie', '```'].join('\n');
    // Only the second block (lines 7-9) is in the diff.
    const patch = ['@@ -6 +6,4 @@', ' tail', '+```mermaid', '+pie', '+```'].join('\n');
    const result = plan([file({ content: two, patch })], [], 'default');
    expect(result.create).toEqual([
      {
        key: 'docs/a.md#1',
        path: 'docs/a.md',
        startLine: 7,
        line: 9,
        body: buildBody('docs/a.md#1', 'pie', 'default', false),
      },
    ]);
  });

  it('skips non-Markdown, removed files, pure renames, files without a diff or content', () => {
    const result = plan(
      [
        file({ path: 'a.ts' }),
        file({ path: 'gone.md', status: 'removed', patch: undefined, content: undefined }),
        file({ path: 'moved.md', status: 'renamed', changes: 0, patch: undefined }),
        file({ path: 'big.md', status: 'modified', patch: undefined }),
        file({
          path: 'link.md',
          content: undefined,
          unreadable: 'the path is a symlink, not a file',
        }),
        file({ path: 'unread.md', content: undefined }),
      ],
      [],
      'default',
    );
    expect(result.create).toEqual([]);
    expect(result.skipped).toEqual([
      {
        path: 'big.md',
        reason: 'GitHub returned no diff for this file (too large); open it on GitHub instead',
      },
      { path: 'link.md', reason: 'the path is a symlink, not a file' },
      { path: 'unread.md', reason: 'head content was not read' },
    ]);
  });

  it('does not comment on a block the diff did not touch, including a deletion just above it', () => {
    const tail = ['@@ -6 +6 @@', '-old tail', '+tail'].join('\n');
    expect(plan([file({ patch: tail })], [], 'default').create).toEqual([]);
    const above = [
      '@@ -1,3 +1,2 @@',
      ' # T',
      '-removed paragraph',
      ' ```mermaid',
      ' graph TD',
    ].join('\n');
    expect(plan([file({ patch: above })], [], 'default').create).toEqual([]);
  });

  it('updates in place when the range is unchanged and the link changed', () => {
    const stale = existing({ body: buildBody(KEY, 'stale', 'default', false) });
    const result = plan([file()], [stale], 'default');
    expect(result.update).toEqual([
      { id: 7, key: KEY, path: 'docs/a.md', startLine: 2, line: 5, body: BODY },
    ]);
    expect(result.create).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it('leaves an up-to-date comment alone', () => {
    expect(plan([file()], [existing()], 'default')).toEqual({
      create: [],
      update: [],
      remove: [],
      skipped: [],
    });
  });

  it('replaces a comment whose range differs at either end, or is outdated', () => {
    for (const moved of [
      existing({ line: 4, startLine: null }),
      existing({ startLine: 3 }),
      existing({ line: 4 }),
      existing({ line: null, startLine: null }),
    ]) {
      const result = plan([file()], [moved], 'default');
      expect(result.remove).toEqual([{ id: 7, key: KEY }]);
      expect(result.create.map((c) => c.key)).toEqual([KEY]);
      expect(result.update).toEqual([]);
    }
  });

  it('removes a comment for a block that is no longer changed, and duplicates', () => {
    const stale = existing({
      id: 1,
      body: buildBody('docs/a.md#3', 'x', 'default', false),
      line: 9,
      startLine: null,
    });
    const first = existing({ id: 2 });
    const dup = existing({ id: 3 });
    const human = existing({ id: 4, body: 'nice diagram', line: 3, startLine: null });
    const result = plan([file()], [stale, first, dup, human], 'default');
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
    const result = plan([file({ path: 'x.md', content: long, patch })], [], 'default');
    expect(result.create[0]).toMatchObject({ startLine: 4, line: 10 });
    expect(result.create[0]?.body).toContain('Only part of this block');
  });
});
