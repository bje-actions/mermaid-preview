import { describe, expect, it } from 'vitest';
import { encodeState, previewLinks } from '../src/encode';
import { decode, PAKO } from './helpers';

describe('encodeState', () => {
  it('round-trips the diagram and a stringified config, as mermaid.live expects', () => {
    const state = decode(encodeState('graph TD\n  a --> b', 'dark'));
    expect(state.code).toBe('graph TD\n  a --> b');
    expect(JSON.parse(state.mermaid)).toEqual({ theme: 'dark' });
  });

  it('produces the exact bytes mermaid.live receives: deflate level 9, base64url, no padding', () => {
    expect(encodeState('graph TD\n  a --> b', 'default')).toBe(PAKO['graph TD\n  a --> b|default']);
    expect(encodeState('graph TD', 'dark')).toBe(PAKO['graph TD|dark']);
  });
});

describe('previewLinks', () => {
  it('builds the view and edit routes from one encoding', () => {
    expect(previewLinks('graph TD', 'default')).toEqual({
      view: `https://mermaid.live/view#pako:${PAKO['graph TD|default']}`,
      edit: `https://mermaid.live/edit#pako:${PAKO['graph TD|default']}`,
    });
  });
});
