/**
 * Decodes bytes as UTF-8, or returns null when they are not valid UTF-8.
 * Buffer substitutes U+FFFD for every invalid sequence and U+FFFD re-encodes
 * to EF BF BD, so the bytes survive a round trip exactly when they were valid.
 */
export function decodeUtf8Strict(bytes: Uint8Array): string | null {
  const text = Buffer.from(bytes).toString('utf8');
  return Buffer.from(text, 'utf8').equals(Buffer.from(bytes)) ? text : null;
}
