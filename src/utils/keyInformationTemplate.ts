const TEMPLATE_TAG = 0xe0;
const KEY_TAG = 0xc0;
const EXTENDED_KEY_TYPE = 0xff;

/** A public key or its parameters (GP Card Specification 2.3.1, Table 11-16): none opens a secure channel. */
const PUBLIC_KEY_TYPES = new Set([
  0xa0, 0xa1, 0xb0, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xf0,
]);

type Tlv = { tag: number; value: Uint8Array; end: number };

function readTlv(data: Uint8Array, offset: number): Tlv | null {
  let start = offset + 2;
  if (start > data.length) {
    return null;
  }
  const tag = data[offset];
  let length = data[offset + 1];
  if (length === 0x81 && start + 1 <= data.length) {
    length = data[start];
    start += 1;
  } else if (length === 0x82 && start + 2 <= data.length) {
    length = data[start] * 256 + data[start + 1];
    start += 2;
  } else if (length > 0x7f) {
    return null;
  }
  const end = start + length;
  return end > data.length
    ? null
    : { tag, value: data.subarray(start, end), end };
}

function shortFieldEnd(info: Uint8Array, at: number | null): number | null {
  if (at === null || at >= info.length || info[at] > 1) {
    return null;
  }
  return at + 1 + info[at];
}

function keyTypes(info: Uint8Array): number[] | null {
  const types: number[] = [];
  let i = 2;
  if (info[i] !== EXTENDED_KEY_TYPE) {
    if (info.length % 2 !== 0) {
      return null;
    }
    for (; i < info.length; i += 2) {
      if (info[i] === EXTENDED_KEY_TYPE) {
        return null;
      }
      types.push(info[i]);
    }
    return types;
  }
  for (; info[i] === EXTENDED_KEY_TYPE; i += 4) {
    if (i + 4 > info.length) {
      return null;
    }
    types.push(info[i + 1]);
  }
  const keyUsageEnd = shortFieldEnd(info, i);
  const keyAccessEnd = shortFieldEnd(info, keyUsageEnd);
  return keyAccessEnd === info.length ? types : null;
}

/** Null when the template does not parse or lists no key. */
export function keysetVersions(template: Uint8Array): number[] | null {
  const outer = readTlv(template, 0);
  if (!outer || outer.tag !== TEMPLATE_TAG || outer.end !== template.length) {
    return null;
  }
  const versions: number[] = [];
  let listsKey = false;
  for (let offset = 0; offset < outer.value.length; ) {
    const entry = readTlv(outer.value, offset);
    if (!entry || entry.tag !== KEY_TAG) {
      return null;
    }
    offset = entry.end;
    const info = entry.value;
    // GlobalPlatformPro meets an empty entry on a fresh security domain.
    if (info.length === 0) {
      continue;
    }
    if (info.length < 4) {
      return null;
    }
    listsKey = true;
    const types = keyTypes(info);
    // A key whose types do not parse may still open a channel.
    const opensChannel =
      types === null || types.some(type => !PUBLIC_KEY_TYPES.has(type));
    if (opensChannel && !versions.includes(info[1])) {
      versions.push(info[1]);
    }
  }
  return listsKey ? versions : null;
}
