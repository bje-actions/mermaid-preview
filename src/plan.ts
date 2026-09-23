// Decide what to do to the pull request's review comments, from data alone:
// the changed Markdown files with their head content and patch, and the
// review comments already on the pull request. Pure, so every rule below is
// tested without GitHub. `run.ts` fetches the inputs and applies the output.
import { anchorRange, changedWithin, parsePatch } from './diff';
import { previewLinks } from './encode';
import { findMermaidBlocks } from './markdown';

export interface ChangedFile {
  path: string;
  /** GitHub's per-file status: added, modified, renamed, removed, ... */
  status: string;
  /** Unified diff for the file; absent when GitHub omits it (too large, binary). */
  patch?: string | undefined;
  /** Head content; absent for a removed file. */
  content?: string | undefined;
}

export interface ExistingComment {
  id: number;
  path: string;
  body: string;
  /** The last (or only) line of the comment's range. */
  line: number | null;
  /** The first line of a multi-line comment; null for a single-line one. */
  startLine: number | null;
}

export interface DesiredComment {
  key: string;
  path: string;
  startLine: number;
  line: number;
  body: string;
}

export interface Plan {
  create: DesiredComment[];
  update: { id: number; body: string }[];
  remove: { id: number; key: string }[];
  /** Files skipped and why, for the job summary. */
  skipped: { path: string; reason: string }[];
}

const MARKER_PREFIX = '<!-- mermaid-preview:';

/** The identity a comment keeps across pushes: file path and block ordinal. */
export function commentKey(path: string, ordinal: number): string {
  return `${path}#${ordinal}`;
}

export function marker(key: string): string {
  return `${MARKER_PREFIX} ${key} -->`;
}

export function keyOf(body: string): string | null {
  const match = /^<!-- mermaid-preview: (.+?) -->/m.exec(body);
  return match === null ? null : (match[1] as string);
}

export function buildBody(key: string, code: string, theme: string, partial: boolean): string {
  const links = previewLinks(code, theme);
  const lines = [
    marker(key),
    `Preview this diagram on mermaid.live: [view](${links.view}) or [edit](${links.edit}).`,
  ];
  if (partial) {
    lines.push('', '_Only part of this block is in the diff, so the comment spans that part._');
  }
  return lines.join('\n');
}

export function isMarkdown(path: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(path);
}

export function plan(files: ChangedFile[], existing: ExistingComment[], theme: string): Plan {
  const desired = new Map<string, DesiredComment>();
  const skipped: Plan['skipped'] = [];

  for (const file of files) {
    if (!isMarkdown(file.path) || file.status === 'removed') continue;
    if (file.patch === undefined) {
      skipped.push({ path: file.path, reason: 'GitHub returned no diff for this file' });
      continue;
    }
    if (file.content === undefined) {
      skipped.push({ path: file.path, reason: 'head content could not be read' });
      continue;
    }
    const diff = parsePatch(file.patch);
    for (const block of findMermaidBlocks(file.content)) {
      const range = { start: block.startLine, end: block.endLine };
      if (!changedWithin(range, diff)) continue;
      const anchor = anchorRange(range, diff);
      /* v8 ignore next: a changed line is always in the diff, so this cannot happen */
      if (anchor === null) continue;
      const key = commentKey(file.path, block.ordinal);
      desired.set(key, {
        key,
        path: file.path,
        startLine: anchor.start,
        line: anchor.end,
        body: buildBody(key, block.code, theme, anchor.partial),
      });
    }
  }

  const result: Plan = { create: [], update: [], remove: [], skipped };
  const seen = new Set<string>();
  for (const comment of existing) {
    const key = keyOf(comment.body);
    if (key === null) continue;
    const want = desired.get(key);
    // A duplicate marker (two comments for one key) keeps the first and
    // removes the rest, so a partially applied earlier run self-heals.
    if (want === undefined || seen.has(key)) {
      result.remove.push({ id: comment.id, key });
      continue;
    }
    seen.add(key);
    const startLine = comment.startLine ?? comment.line;
    const sameRange = startLine === want.startLine && comment.line === want.line;
    if (sameRange) {
      if (comment.body !== want.body) result.update.push({ id: comment.id, body: want.body });
    } else {
      // The API cannot move a comment's range: replace it.
      result.remove.push({ id: comment.id, key });
      result.create.push(want);
    }
  }
  for (const [key, want] of desired) {
    if (!seen.has(key)) result.create.push(want);
  }
  return result;
}
