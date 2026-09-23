// Find fenced mermaid code blocks in a Markdown document, with their line
// range (1-based, fences inclusive) and their source. Follows CommonMark's
// fence rules closely enough for the cases a repository's docs produce: a
// fence is three or more backticks or tildes with up to three spaces of
// indentation; it closes on a fence of the same character at least as long;
// inside an open block, a fence of the other character, or a shorter fence
// of the same character, is content, not a block.

export interface MermaidBlock {
  /** Zero-based position among the mermaid blocks of the same file. */
  ordinal: number;
  /** Line of the opening fence, 1-based. */
  startLine: number;
  /** Line of the closing fence, 1-based. */
  endLine: number;
  /** The diagram source between the fences, without the fences. */
  code: string;
}

const OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)/;

export function findMermaidBlocks(markdown: string): MermaidBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MermaidBlock[] = [];
  let open: { fence: string; mermaid: boolean; startLine: number; body: string[] } | null = null;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (open === null) {
      const match = OPEN.exec(line);
      if (match === null) continue;
      const fence = match[1] as string;
      const info = (match[2] as string).toLowerCase();
      open = { fence, mermaid: info === 'mermaid', startLine: lineNumber, body: [] };
      continue;
    }
    if (closes(line, open.fence)) {
      if (open.mermaid) {
        blocks.push({
          ordinal: blocks.length,
          startLine: open.startLine,
          endLine: lineNumber,
          code: open.body.join('\n'),
        });
      }
      open = null;
      continue;
    }
    open.body.push(line);
  }

  // An unclosed fence runs to the end of the document and is not a block we
  // can anchor a comment on both ends of, so it is not reported.
  return blocks;
}

function closes(line: string, fence: string): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  if (match === null) return false;
  const candidate = match[1] as string;
  return candidate[0] === fence[0] && candidate.length >= fence.length;
}
