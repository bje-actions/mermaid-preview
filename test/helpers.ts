import { inflateSync } from 'node:zlib';

/** Invert `encodeState`: the state object mermaid.live reads from a `pako:` fragment. */
export function decode(encoded: string): { code: string; mermaid: string } {
  return JSON.parse(inflateSync(Buffer.from(encoded, 'base64url')).toString('utf8'));
}
