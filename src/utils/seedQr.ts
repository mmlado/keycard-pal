import { entropyToMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';

export type SeedQrDecodeResult =
  | { kind: 'success'; words: string[] }
  | { kind: 'error'; message: string };

// Standard SeedQR: each word's zero-based wordlist index as four decimal digits,
// concatenated, in QR numeric mode. 12 words is 48 digits, 24 words is 96.
const DIGITS_PER_INDEX = 4;
const VALID_DIGIT_LENGTHS = [48, 96];

// CompactSeedQR: the raw entropy in QR byte mode, checksum bits truncated.
const VALID_ENTROPY_LENGTHS = [16, 32];

export function decodeSeedQr(payload: string): SeedQrDecodeResult {
  const cleaned = payload.trim();

  if (!/^[0-9]+$/.test(cleaned)) {
    return { kind: 'error', message: 'SeedQR payload must be digits only' };
  }

  if (!VALID_DIGIT_LENGTHS.includes(cleaned.length)) {
    return {
      kind: 'error',
      message: `Invalid SeedQR: expected 48 or 96 digits, got ${cleaned.length}`,
    };
  }

  const words: string[] = [];
  for (let i = 0; i < cleaned.length; i += DIGITS_PER_INDEX) {
    const index = Number(cleaned.slice(i, i + DIGITS_PER_INDEX));
    if (index >= englishWordlist.length) {
      return {
        kind: 'error',
        message: `Invalid SeedQR: word index ${index} is out of range`,
      };
    }
    words.push(englishWordlist[index]);
  }

  // The checksum rides inside the last index, so a corrupted stream still yields real words.
  if (!validateMnemonic(words.join(' '), englishWordlist)) {
    return {
      kind: 'error',
      message: 'Decoded recovery phrase failed its checksum',
    };
  }

  return { kind: 'success', words };
}

export function isSeedQrPayload(value: string): boolean {
  const cleaned = value.trim();
  return (
    /^[0-9]+$/.test(cleaned) && VALID_DIGIT_LENGTHS.includes(cleaned.length)
  );
}

export function decodeCompactSeedQr(entropy: Uint8Array): SeedQrDecodeResult {
  if (!VALID_ENTROPY_LENGTHS.includes(entropy.length)) {
    return {
      kind: 'error',
      message: `Invalid CompactSeedQR: expected 16 or 32 bytes, got ${entropy.length}`,
    };
  }

  try {
    // No checksum to verify: it is truncated from the payload and derived here,
    // so any 16 or 32 bytes are a well-formed phrase.
    return {
      kind: 'success',
      words: entropyToMnemonic(entropy, englishWordlist).split(' '),
    };
  } catch (e: any) {
    return {
      kind: 'error',
      message: `Failed to decode CompactSeedQR: ${e.message}`,
    };
  }
}

export function isCompactSeedQrBytes(bytes: Uint8Array): boolean {
  return VALID_ENTROPY_LENGTHS.includes(bytes.length);
}
