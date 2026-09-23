import { describe, expect, it } from 'vitest';
import { anchorRange, changedWithin, parsePatch } from '../src/diff';

// Head lines 1-9. Hunk 1 covers head 1-4 (line 2 added, a deletion before
// line 3). Hunk 2 covers head 7-9 (line 8 added).
const PATCH = [
  '@@ -1,4 +1,4 @@',
  ' one',
  '+two',
  '-gone',
  ' three',
  ' four',
  '@@ -6,2 +7,3 @@',
  ' seven',
  '+eight',
  ' nine',
  '\\ No newline at end of file',
].join('\n');

describe('parsePatch', () => {
  it('reads right-side line sets from the hunks', () => {
    const diff = parsePatch(PATCH);
    expect([...diff.inDiff]).toEqual([1, 2, 3, 4, 7, 8, 9]);
    expect([...diff.added]).toEqual([2, 8]);
    expect([...diff.deletedBefore]).toEqual([3]);
  });

  it('ignores the file header before the first hunk', () => {
    const diff = parsePatch(['--- a/x', '+++ b/x', '@@ -1 +1 @@', '+a'].join('\n'));
    expect([...diff.added]).toEqual([1]);
  });

  it('records a deletion only when a head line follows it in the hunk', () => {
    // Trailing deletions at end of file: no head line follows.
    const eof = parsePatch(['@@ -1,3 +1 @@', ' one', '-two', '-three'].join('\n'));
    expect([...eof.deletedBefore]).toEqual([]);
    expect([...eof.inDiff]).toEqual([1]);
    // A deletion at the end of one hunk does not leak into the next.
    const twoHunks = parsePatch(
      ['@@ -1,2 +1 @@', ' one', '-two', '@@ -9 +8 @@', ' nine'].join('\n'),
    );
    expect([...twoHunks.deletedBefore]).toEqual([]);
    expect([...twoHunks.inDiff]).toEqual([1, 8]);
  });
});

describe('changedWithin', () => {
  const diff = parsePatch(PATCH);
  it('is true for an added line or a deletion inside the range', () => {
    expect(changedWithin({ start: 2, end: 4 }, diff)).toBe(true); // deletion before 3
    expect(changedWithin({ start: 8, end: 9 }, diff)).toBe(true); // added 8
  });
  it('is false for context-only or out-of-diff ranges', () => {
    expect(changedWithin({ start: 4, end: 7 }, diff)).toBe(false);
  });
  it('does not count a deletion just above the range as inside it', () => {
    // Text removed right before an opening fence at line 3.
    expect(changedWithin({ start: 3, end: 4 }, diff)).toBe(false);
  });
});

describe('anchorRange', () => {
  const diff = parsePatch(PATCH);
  it('is the whole range when every line is in a hunk', () => {
    expect(anchorRange({ start: 1, end: 4 }, diff)).toEqual({ start: 1, end: 4, partial: false });
  });
  it('is partial when a single run misses either end of the range', () => {
    expect(anchorRange({ start: 5, end: 9 }, diff)).toEqual({ start: 7, end: 9, partial: true });
    expect(anchorRange({ start: 1, end: 6 }, diff)).toEqual({ start: 1, end: 4, partial: true });
  });
  it('picks the in-hunk run with the most changed lines, wherever it is', () => {
    // 1-4 holds two changes (added 2, deletion at 3); 7-9 holds one.
    expect(anchorRange({ start: 1, end: 9 }, diff)).toEqual({ start: 1, end: 4, partial: true });
    // Later run wins with two additions against one.
    const later = parsePatch(['@@ -1 +1 @@', '+a', '@@ -5,2 +5,3 @@', ' e', '+f', '+g'].join('\n'));
    expect(anchorRange({ start: 1, end: 7 }, later)).toEqual({ start: 5, end: 7, partial: true });
    // Later run wins through a deletion alone.
    const del = parsePatch(
      ['@@ -1 +1 @@', ' a', '@@ -5,3 +5,2 @@', ' e', '-x', '-y', ' f'].join('\n'),
    );
    expect(anchorRange({ start: 1, end: 6 }, del)).toEqual({ start: 5, end: 6, partial: true });
  });
  it('prefers the earlier run on a tie', () => {
    const tie = parsePatch(['@@ -1 +1 @@', '+a', '@@ -5 +5 @@', '+e'].join('\n'));
    expect(anchorRange({ start: 1, end: 5 }, tie)).toEqual({ start: 1, end: 1, partial: true });
  });
  it('is null when no line is in the diff', () => {
    expect(anchorRange({ start: 5, end: 6 }, diff)).toBeNull();
  });
});
