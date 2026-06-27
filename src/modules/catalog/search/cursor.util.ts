/** Opaque keyset cursor: the last row's sort value + id tiebreaker (D73). */
export interface CursorPayload {
  v: string | number;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Decode a cursor; returns null for any malformed token (treated as page 1). */
export function decodeCursor(token: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8'),
    ) as Partial<CursorPayload>;
    if (
      parsed &&
      (typeof parsed.v === 'string' || typeof parsed.v === 'number') &&
      typeof parsed.id === 'string'
    ) {
      return { v: parsed.v, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}
