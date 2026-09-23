import { describe, expect, it } from 'vitest';
import { isForbidden } from '../src/github';

describe('isForbidden', () => {
  it('matches the statuses a read-only token gets on a write', () => {
    expect(isForbidden({ status: 403 })).toBe(true);
    expect(isForbidden({ status: 404 })).toBe(true);
    expect(isForbidden({ status: 500 })).toBe(false);
    expect(isForbidden(new Error('x'))).toBe(false);
    expect(isForbidden(null)).toBe(false);
  });
});
