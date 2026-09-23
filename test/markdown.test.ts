import { describe, expect, it } from 'vitest';
import { findMermaidBlocks } from '../src/markdown';

describe('findMermaidBlocks', () => {
  it('reports each mermaid block with fence lines and source', () => {
    const md = [
      '# T',
      '',
      '```mermaid',
      'graph TD',
      '  a --> b',
      '```',
      '',
      '```mermaid',
      'pie',
      '```',
    ].join('\n');
    expect(findMermaidBlocks(md)).toEqual([
      { ordinal: 0, startLine: 3, endLine: 6, code: 'graph TD\n  a --> b' },
      { ordinal: 1, startLine: 8, endLine: 10, code: 'pie' },
    ]);
  });

  it('ignores other languages, tilde fences count, info string is case-insensitive', () => {
    const md = ['```js', 'x', '```', '~~~Mermaid', 'graph LR', '~~~'].join('\n');
    expect(findMermaidBlocks(md)).toEqual([
      { ordinal: 0, startLine: 4, endLine: 6, code: 'graph LR' },
    ]);
  });

  it('takes the first word of the info string only', () => {
    const md = ['```mermaid title="x"', 'graph LR', '```', '```mermaidx', 'no', '```'].join('\n');
    expect(findMermaidBlocks(md)).toEqual([
      { ordinal: 0, startLine: 1, endLine: 3, code: 'graph LR' },
    ]);
  });

  it('allows up to three spaces of fence indentation, not four', () => {
    const two = ['  ```mermaid', '  graph LR', '  ```'].join('\n');
    expect(findMermaidBlocks(two)).toEqual([
      { ordinal: 0, startLine: 1, endLine: 3, code: '  graph LR' },
    ]);
    const four = ['    ```mermaid', '    graph LR', '    ```'].join('\n');
    expect(findMermaidBlocks(four)).toEqual([]);
  });

  it('treats a mermaid fence inside a longer fence as content', () => {
    const md = ['````md', '```mermaid', 'graph TD', '```', '````'].join('\n');
    expect(findMermaidBlocks(md)).toEqual([]);
  });

  it('closes only on the same fence character, at least as long', () => {
    const md = ['```mermaid', '~~~', 'graph TD', '``', '````', 'after'].join('\n');
    expect(findMermaidBlocks(md)).toEqual([
      { ordinal: 0, startLine: 1, endLine: 5, code: '~~~\ngraph TD\n``' },
    ]);
  });

  it('does not report an unclosed block, and accepts CRLF', () => {
    expect(findMermaidBlocks('```mermaid\ngraph TD\n')).toEqual([]);
    expect(findMermaidBlocks('```mermaid\r\ngraph TD\r\n```\r\n')).toEqual([
      { ordinal: 0, startLine: 1, endLine: 3, code: 'graph TD' },
    ]);
  });
});
