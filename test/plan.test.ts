import { describe, expect, it } from 'vitest';
import type { ChangedFile, ExistingComment } from '../src/plan';
import { isCommentType, plan } from '../src/plan';
import { body, decode, FOOTER, PAKO } from './helpers';

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
const KEY = 'docs/a.md#0';
const LINK = { theme: 'default', type: 'link', attribution: true } as const;
const IMAGE = { theme: 'default', type: 'image', attribution: true } as const;
const PAKO_LIGHT = PAKO['graph TD\n  a --> b|default'];
const PAKO_DARK = PAKO['graph TD\n  a --> b|dark'];
const BODY = body(KEY, PAKO_LIGHT, { type: 'link' });
const EDIT = `https://mermaid.live/edit#pako:${PAKO_LIGHT}`;

function file(over: Partial<ChangedFile> = {}): ChangedFile {
  return { path: 'docs/a.md', status: 'added', changes: 6, patch: ADDED, content: DOC, ...over };
}

function existing(over: Partial<ExistingComment> = {}): ExistingComment {
  return { id: 7, path: 'docs/a.md', body: BODY, line: 5, startLine: 2, ...over };
}

describe('isCommentType', () => {
  it('accepts exactly the two documented values', () => {
    expect(['image', 'link'].every(isCommentType)).toBe(true);
    expect(['Image', 'img', ''].some(isCommentType)).toBe(false);
  });
});

describe('plan', () => {
  it('creates a full-range comment for a changed block with no existing comment', () => {
    expect(plan([file()], [], LINK)).toEqual({
      create: [{ key: KEY, path: 'docs/a.md', startLine: 2, line: 5, body: BODY, link: EDIT }],
      update: [],
      remove: [],
      skipped: [],
    });
  });

  it('ends every body with the attribution footer unless attribution is off', () => {
    const [created] = plan([file()], [], LINK).create;
    expect(created?.body.endsWith(`\n\n${FOOTER}`)).toBe(true);
    expect(plan([file()], [], { ...LINK, attribution: false }).create[0]?.body).toBe(
      body(KEY, PAKO_LIGHT, { type: 'link', attribution: false }),
    );
  });

  it('comments with a theme-aware picture linked to the editor when type is image', () => {
    expect(plan([file()], [], IMAGE).create).toEqual([
      {
        key: KEY,
        path: 'docs/a.md',
        startLine: 2,
        line: 5,
        body: body(KEY, PAKO_LIGHT, { type: 'image', pakoDark: PAKO_DARK }),
        link: EDIT,
      },
    ]);
  });

  it('encodes the theme into the link and the light render; the dark render is always dark', () => {
    const theme = (fragment: string | undefined) => JSON.parse(decode(fragment ?? '').mermaid);
    const link = plan([file()], [], { ...LINK, theme: 'forest' }).create[0]?.body ?? '';
    expect(
      theme(
        /\[View in mermaid.live\]\(https:\/\/mermaid.live\/edit#pako:([\w-]+)\)/.exec(link)?.[1],
      ),
    ).toEqual({
      theme: 'forest',
    });
    const image = plan([file()], [], { ...IMAGE, theme: 'forest' }).create[0]?.body ?? '';
    expect(
      theme(/<img [^>]*src="https:\/\/mermaid.ink\/img\/pako:([\w-]+)\?/.exec(image)?.[1]),
    ).toEqual({
      theme: 'forest',
    });
    expect(theme(/srcset="https:\/\/mermaid.ink\/img\/pako:([\w-]+)\?/.exec(image)?.[1])).toEqual({
      theme: 'dark',
    });
  });

  it('keys each block by its ordinal in the file, not among the changed blocks', () => {
    const two = [DOC, '```mermaid', 'pie', '```'].join('\n');
    // Only the second block (lines 7-9) is in the diff.
    const patch = ['@@ -6 +6,4 @@', ' tail', '+```mermaid', '+pie', '+```'].join('\n');
    expect(plan([file({ content: two, patch })], [], LINK).create).toEqual([
      {
        key: 'docs/a.md#1',
        path: 'docs/a.md',
        startLine: 7,
        line: 9,
        body: body('docs/a.md#1', PAKO['pie|default'], { type: 'link' }),
        link: `https://mermaid.live/edit#pako:${PAKO['pie|default']}`,
      },
    ]);
  });

  it('considers every Markdown extension and nothing else', () => {
    const paths = ['a.md', 'b.MD', 'c.markdown', 'd.mdx', 'e.ts', 'f.mdown'];
    const result = plan(
      paths.map((path) => file({ path })),
      [],
      LINK,
    );
    expect(result.create.map((c) => c.path)).toEqual(['a.md', 'b.MD', 'c.markdown', 'd.mdx']);
  });

  it('skips removed files, pure renames, files without a diff or content', () => {
    const result = plan(
      [
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
      LINK,
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
    expect(plan([file({ patch: tail })], [], LINK).create).toEqual([]);
    const above = [
      '@@ -1,3 +1,2 @@',
      ' # T',
      '-removed paragraph',
      ' ```mermaid',
      ' graph TD',
    ].join('\n');
    expect(plan([file({ patch: above })], [], LINK).create).toEqual([]);
  });

  it('updates in place when the range is unchanged and the link changed', () => {
    const stale = existing({ body: body(KEY, 'stale', { type: 'link' }) });
    const result = plan([file()], [stale], LINK);
    expect(result.update).toEqual([
      { id: 7, key: KEY, path: 'docs/a.md', startLine: 2, line: 5, body: BODY, link: EDIT },
    ]);
    expect(result.create).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it('leaves an up-to-date comment alone', () => {
    expect(plan([file()], [existing()], LINK)).toEqual({
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
      const result = plan([file()], [moved], LINK);
      expect(result.remove).toEqual([{ id: 7, key: KEY }]);
      expect(result.create.map((c) => c.key)).toEqual([KEY]);
      expect(result.update).toEqual([]);
    }
  });

  it('removes a comment for a block that is no longer changed, and duplicates; leaves human comments', () => {
    const stale = existing({
      id: 1,
      body: body('docs/a.md#3', 'x', { type: 'link' }),
      line: 9,
      startLine: null,
    });
    const first = existing({ id: 2 });
    const dup = existing({ id: 3 });
    const human = existing({ id: 4, body: 'nice diagram', line: 3, startLine: null });
    const result = plan([file()], [stale, first, dup, human], LINK);
    expect(result.remove).toEqual([
      { id: 1, key: 'docs/a.md#3' },
      { id: 3, key: KEY },
    ]);
    expect(result.create).toEqual([]);
    expect(result.update).toEqual([]);
  });

  it('anchors partially when the block is longer than the hunk, with the same body', () => {
    const long = ['```mermaid', ...Array.from({ length: 12 }, (_, i) => `n${i}`), '```'].join('\n');
    // Only head line 7 changed; the hunk shows 4-10 with three lines of context.
    const patch = ['@@ -4,6 +4,7 @@', ' n2', ' n3', ' n4', '+n5', ' n6', ' n7', ' n8'].join('\n');
    const [created] = plan([file({ path: 'x.md', content: long, patch })], [], LINK).create;
    expect(created).toMatchObject({ key: 'x.md#0', startLine: 4, line: 10 });
    const pako = /view#pako:([A-Za-z0-9_-]+)/.exec(created?.body ?? '')?.[1] ?? '';
    expect(created?.body).toBe(body('x.md#0', pako, { type: 'link' }));
  });
});
