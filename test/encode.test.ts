import { describe, expect, it } from 'vitest';
import { encodeState, previewLinks } from '../src/encode';
import { decode } from './helpers';

describe('encodeState', () => {
  it('round-trips the diagram and a stringified config, as mermaid.live expects', () => {
    const state = decode(encodeState('graph TD\n  a --> b', 'dark'));
    expect(state.code).toBe('graph TD\n  a --> b');
    expect(JSON.parse(state.mermaid)).toEqual({ theme: 'dark' });
  });

  it('produces the exact bytes mermaid.live receives: deflate level 9, base64url, no padding', () => {
    // Pinned from a run that mermaid.ink rendered (HTTP 200) on 2026-09-22.
    expect(encodeState('graph TD\n  a --> b', 'default')).toBe(
      'eNqrVkrOT0lVslJKL0osyFAIcYnJU1BIVNDVtVNIUtJRyk0tyk3MTFGyUqqOUSrJSM1NjVGyilFKSU1LLM0piVGqVaoFAKEoFLQ',
    );
  });
});

describe('previewLinks', () => {
  it('builds the view and edit routes from one encoding', () => {
    const links = previewLinks('graph TD', 'default');
    const encoded = encodeState('graph TD', 'default');
    expect(links.view).toBe(`https://mermaid.live/view#pako:${encoded}`);
    expect(links.edit).toBe(`https://mermaid.live/edit#pako:${encoded}`);
    expect(decode(encoded).code).toBe('graph TD');
  });
});
