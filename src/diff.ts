// Read a file's unified diff (the `patch` field GitHub returns per file on
// GET /pulls/{n}/files) into the right-side line sets a review comment
// needs: which head lines appear in a hunk at all (context or added: the
// only lines a comment may anchor to), which were added, and where a
// deletion sits (the head line that follows the removed lines), so a block
// that only lost lines still reads as changed.
//
// Invariant: `added` and `deletedBefore` are subsets of `inDiff`. A deletion
// is recorded only once a following context or added line lands in the same
// hunk; a hunk that ends on `-` lines (end of file) records nothing, since no
// head line follows.

export interface DiffLines {
  /** Head lines that appear in some hunk: context or added. */
  inDiff: ReadonlySet<number>;
  /** Head lines marked `+`. */
  added: ReadonlySet<number>;
  /** Head line numbers immediately after a run of `-` lines. */
  deletedBefore: ReadonlySet<number>;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string): DiffLines {
  const inDiff = new Set<number>();
  const added = new Set<number>();
  const deletedBefore = new Set<number>();
  let line = 0;
  let inHunk = false;
  let pendingDeletion = false;

  for (const raw of patch.split('\n')) {
    const hunk = HUNK.exec(raw);
    if (hunk !== null) {
      line = Number(hunk[1]);
      inHunk = true;
      pendingDeletion = false;
      continue;
    }
    if (!inHunk) continue;
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    if (raw.startsWith('-')) {
      pendingDeletion = true;
      continue;
    }
    if (pendingDeletion) {
      deletedBefore.add(line);
      pendingDeletion = false;
    }
    if (raw.startsWith('+')) added.add(line);
    inDiff.add(line);
    line += 1;
  }

  return { inDiff, added, deletedBefore };
}

/** 1-based, inclusive, `start <= end`. */
export interface LineRange {
  start: number;
  end: number;
}

/**
 * True when a line of `range` was added, or lines were deleted inside it.
 * A deletion recorded at `range.start` sits above the range's first line
 * (text removed just before an opening fence), so it does not count.
 */
export function changedWithin(range: LineRange, diff: DiffLines): boolean {
  return changedLines(range, range, diff) > 0;
}

/** Changed lines of `run`, a sub-range of the block `block`. */
function changedLines(run: LineRange, block: LineRange, diff: DiffLines): number {
  let changed = 0;
  for (let line = run.start; line <= run.end; line += 1) {
    if (diff.added.has(line) || (line > block.start && diff.deletedBefore.has(line))) changed += 1;
  }
  return changed;
}

export interface Anchor extends LineRange {
  /** False when the whole block is in the diff; true when only part of it is. */
  partial: boolean;
}

/**
 * The line range a review comment on `range` may take. The whole range when
 * every line of it is in a hunk; otherwise the contiguous in-hunk run inside
 * the range holding the most changed lines (the earliest on a tie), marked
 * partial; null when no line of the range is in the diff at all.
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
  let best = runs[0] as LineRange;
  if (runs.length === 1 && best.start === range.start && best.end === range.end) {
    return { ...best, partial: false };
  }
  // Runs are in line order, so a strict comparison keeps the earliest on a tie.
  let bestScore = changedLines(best, range, diff);
  for (const run of runs.slice(1)) {
    const score = changedLines(run, range, diff);
    if (score > bestScore) {
      best = run;
      bestScore = score;
    }
  }
  return { ...best, partial: true };
}
