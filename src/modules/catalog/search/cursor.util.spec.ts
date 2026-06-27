import { decodeCursor, encodeCursor } from './cursor.util';

describe('cursor.util', () => {
  it('round-trips a string cursor', () => {
    const token = encodeCursor({ v: '2026-06-26T00:00:00.000Z', id: 'abc' });
    expect(decodeCursor(token)).toEqual({
      v: '2026-06-26T00:00:00.000Z',
      id: 'abc',
    });
  });

  it('round-trips a numeric cursor', () => {
    const token = encodeCursor({ v: 199.99, id: 'xyz' });
    expect(decodeCursor(token)).toEqual({ v: 199.99, id: 'xyz' });
  });

  it('returns null for a malformed token', () => {
    expect(decodeCursor('not-base64-json!!')).toBeNull();
  });

  it('returns null when the shape is wrong', () => {
    const bad = Buffer.from(JSON.stringify({ nope: 1 })).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });
});
