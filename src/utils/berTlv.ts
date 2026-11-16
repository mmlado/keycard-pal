/* eslint-disable no-bitwise */
export type Tlv = { tag: number; value: Uint8Array; end: number };

/** Two-byte tags at most: GlobalPlatform uses '9F70' and nothing longer. */
export function readTlv(data: Uint8Array, offset: number): Tlv | null {
  let start = offset + 2;
  if (start > data.length) {
    return null;
  }
  let tag = data[offset];
  if ((tag & 0x1f) === 0x1f) {
    const second = data[offset + 1];
    if (second & 0x80) {
      return null;
    }
    tag = (tag << 8) | second;
    start += 1;
    if (start > data.length) {
      return null;
    }
  }
  let length = data[start - 1];
  if (length === 0x81 && start + 1 <= data.length) {
    length = data[start];
    start += 1;
  } else if (length === 0x82 && start + 2 <= data.length) {
    length = (data[start] << 8) | data[start + 1];
    start += 2;
  } else if (length > 0x7f) {
    return null;
  }
  const end = start + length;
  return end > data.length
    ? null
    : { tag, value: data.subarray(start, end), end };
}
