/* eslint-disable no-bitwise */

const KEYCARD_NAME_TAG = 1 << 5;
export const MAX_KEYCARD_NAME_LENGTH = 20;

function bytesToString(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}

function stringToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'utf8'));
}

export function parseKeycardName(data?: Uint8Array | null): string {
  if (!data || data.length === 0) {
    return '';
  }

  if (data[0] >> 5 !== 1) {
    return '';
  }

  const length = data[0] & 0x1f;
  if (length === 0) {
    return '';
  }

  return bytesToString(data.slice(1, 1 + length));
}

export function validateKeycardName(name: string): void {
  const bytes = stringToBytes(name.trim());
  if (bytes.length > MAX_KEYCARD_NAME_LENGTH) {
    throw new Error(
      `Card name must be ${MAX_KEYCARD_NAME_LENGTH} bytes or fewer.`,
    );
  }
}

export function encodeKeycardName(name: string): Uint8Array {
  const trimmed = name.trim();
  const nameBytes = stringToBytes(trimmed);
  if (nameBytes.length > MAX_KEYCARD_NAME_LENGTH) {
    throw new Error(
      `Card name must be ${MAX_KEYCARD_NAME_LENGTH} bytes or fewer.`,
    );
  }

  return new Uint8Array([KEYCARD_NAME_TAG | nameBytes.length, ...nameBytes]);
}

export function mergeKeycardNameMetadata(
  name: string,
  current?: Uint8Array | null,
): Uint8Array {
  const encodedName = encodeKeycardName(name);
  if (!current || current.length === 0 || current[0] >> 5 !== 1) {
    return encodedName;
  }

  const currentNameLength = current[0] & 0x1f;
  const metadataOffset = 1 + currentNameLength;
  if (metadataOffset > current.length) {
    throw new Error('Corrupt card metadata: name length exceeds data length.');
  }

  return new Uint8Array([...encodedName, ...current.slice(metadataOffset)]);
}

export function formatFingerprint(fingerprint: number): string {
  return (fingerprint >>> 0).toString(16).padStart(8, '0');
}

export function displayKeycardName(
  name?: string | null,
  fingerprint?: number | null,
): string {
  if (name && name.length > 0) {
    return name;
  }
  if (fingerprint != null) {
    return formatFingerprint(fingerprint);
  }
  return 'Unnamed card';
}
