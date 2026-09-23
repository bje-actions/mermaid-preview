import { deflateSync } from 'node:zlib';

export interface PreviewLinks {
  view: string;
  edit: string;
}

// The state object mermaid.live's own editor puts in the URL: the diagram
// source and the Mermaid config, the config as a JSON *string* inside the
// JSON, which is what mermaid.live's decoder expects. Editor view state
// (grid, pan, zoom) is left out. Compressed with deflate at level 9 and
// base64url-encoded without padding, the `pako:` scheme.
export function encodeState(diagram: string, theme: string): string {
  const state = { code: diagram, mermaid: JSON.stringify({ theme }) };
  const compressed = deflateSync(Buffer.from(JSON.stringify(state), 'utf8'), { level: 9 });
  return compressed.toString('base64url');
}

export function previewLinks(diagram: string, theme: string): PreviewLinks {
  const encoded = encodeState(diagram, theme);
  return {
    view: `https://mermaid.live/view#pako:${encoded}`,
    edit: `https://mermaid.live/edit#pako:${encoded}`,
  };
}
