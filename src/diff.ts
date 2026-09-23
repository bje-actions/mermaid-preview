// Read a file's unified diff (the `patch` field GitHub returns per file on
// GET /pulls/{n}/files) into the right-side line sets a review comment
// needs: which head lines appear in a hunk at all (context or added: the
// only lines a comment may anchor to), which were added, and where a
// deletion sits (the head line that follows the removed lines), so a block
// that only lost lines still reads as changed.

export interface DiffLines {
  /** Head lines that appear in some hunk: context or added. */
  inDiff: Set<number>;
  /** Head lines marked `+`. */
  added: Set<number>;
  /** Head line numbers immediately after a run of `-` lines. */
  deletedBefore: Set<number>;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string): DiffLines {
  const inDiff = new Set<number>();
  const added = new Set<number>();
  const deletedBefore = new Set<number>();
  let line = 0;
  let inHunk = false;

  for (const raw of patch.split('\n')) {
    const hunk = HUNK.exec(raw);
    if (hunk !== null) {
      line = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    if (raw.startsWith('-')) {
      deletedBefore.add(line);
      continue;
    }
    if (raw.startsWith('+')) added.add(line);
    inDiff.add(line);
    line += 1;
  }

  return { inDiff, added, deletedBefore };
}

export interface LineRange {
  start: number;
  end: number;
}

/** True when any line of `range` was added, or a deletion sits inside it. */
export function changedWithin(range: LineRange, diff: DiffLines): boolean {
  for (let line = range.start; line <= range.end; line += 1) {
    if (diff.added.has(line) || diff.deletedBefore.has(line)) return true;
  }
  return false;
}

export interface Anchor extends LineRange {
  /** False when the whole block is in the diff; true when only part of it is. */
  partial: boolean;
}

/**
 * The line range a review comment on `range` may take. The whole range when
 * every line of it is in a hunk; otherwise the longest contiguous in-hunk run
 * inside the range that holds the most changed lines, marked partial; null
 * when no line of the range is in the diff at all.
 */
export function anchorRange(range: LineRange, diff: DiffLines): Anchor | null {
  const runs: LineRange[] = [];
  let current: LineRange | null = null;
  for (let line = range.start; line <= range.end; line += 1) {
    if (diff.inDiff.has(line)) {
      if (current === null) current = { start: line, end: line };
      else current.end = line;
    } else if (current !== null) {
      runs.push(current);
      current = null;
    }
  }
  if (current !== null) runs.push(current);
  if (runs.length === 0) return null;
  const whole = runs[0] as LineRange;
  if (runs.length === 1 && whole.start === range.start && whole.end === range.end) {
    return { ...whole, partial: false };
  }
  const best = runs
    .map((run) => ({ run, score: score(run, diff) }))
    .sort((a, b) => b.score - a.score || a.run.start - b.run.start)[0] as { run: LineRange };
  return { ...best.run, partial: true };
}

function score(run: LineRange, diff: DiffLines): number {
  let changed = 0;
  for (let line = run.start; line <= run.end; line += 1) {
    if (diff.added.has(line) || diff.deletedBefore.has(line)) changed += 1;
  }
  return changed;
}
