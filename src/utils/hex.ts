export type HexString = `0x${string}`;

export function ensureHexPrefix(value: string): HexString {
  return (value.startsWith('0x') ? value : `0x${value}`) as HexString;
}

/** The bytes of an unprefixed hex string. The inverse of `toHex`. */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function toHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
