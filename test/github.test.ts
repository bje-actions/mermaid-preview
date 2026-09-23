import { describe, expect, it } from 'vitest';
import { isPermissionDenied, messageOf, statusOf } from '../src/github';

describe('statusOf and isPermissionDenied', () => {
  it('read the numeric status Octokit errors carry', () => {
    expect(statusOf({ status: 403 })).toBe(403);
    expect(statusOf({ status: '403' })).toBeUndefined();
    expect(statusOf(new Error('x'))).toBeUndefined();
    expect(statusOf(null)).toBeUndefined();
    expect(isPermissionDenied({ status: 403 })).toBe(true);
    expect(isPermissionDenied({ status: 404 })).toBe(false);
  });
});

describe('messageOf', () => {
  it('uses the Error message or stringifies anything else', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf('raw')).toBe('raw');
    expect(messageOf(7)).toBe('7');
  });
});
