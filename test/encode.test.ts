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

describe('the pinned fixtures', () => {
  it('each decode to the diagram and theme their key names', () => {
    for (const [key, encoded] of Object.entries(PAKO)) {
      const [code, theme] = key.split('|');
      const state = decode(encoded);
      expect(state.code).toBe(code);
      expect(JSON.parse(state.mermaid)).toEqual({ theme });
    }
  });
});

describe('previewLinks', () => {
  it('builds the view and edit routes from one encoding', () => {
    expect(previewLinks('graph TD', 'default')).toEqual({
      view: `https://mermaid.live/view#pako:${PAKO['graph TD|default']}`,
      edit: `https://mermaid.live/edit#pako:${PAKO['graph TD|default']}`,
      image: `https://mermaid.ink/img/pako:${PAKO['graph TD|default']}`,
    });
  });
});
