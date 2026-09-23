import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodeState, previewLinks } from '../src/encode';

function decode(encoded: string): { code: string; mermaid: string } {
  return JSON.parse(inflateSync(Buffer.from(encoded, 'base64url')).toString('utf8'));
}

describe('encodeState', () => {
  it('round-trips the diagram and a stringified config, as mermaid.live expects', () => {
    const state = decode(encodeState('graph TD\n  a --> b', 'dark'));
    expect(state.code).toBe('graph TD\n  a --> b');
    expect(JSON.parse(state.mermaid)).toEqual({ theme: 'dark' });
  });

  it('uses base64url without padding', () => {
    expect(encodeState('x', 'default')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('previewLinks', () => {
  it('builds the view and edit routes from one encoding', () => {
    const links = previewLinks('graph TD', 'default');
    const encoded = links.view.slice('https://mermaid.live/view#pako:'.length);
    expect(links.edit).toBe(`https://mermaid.live/edit#pako:${encoded}`);
    expect(decode(encoded).code).toBe('graph TD');
  });
});
