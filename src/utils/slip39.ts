/* eslint-disable no-bitwise */
import { sha256 } from '@noble/hashes/sha2.js';
import { BIP32KeyPair } from 'keycard-sdk/dist/bip32key';
import Slip39 from 'slip39';
import { WORD_LIST } from 'slip39/src/slip39_helper.js';

export const SLIP39_SHARE_WORD_COUNT = 20;
export const SLIP39_SECRET_BYTES = 16;
export const SLIP39_MAX_SHARES = 16;
export const SLIP39_WORD_LIST = WORD_LIST;

const SLIP39_GROUP_THRESHOLD = 1;
const SLIP39_ITERATION_EXPONENT = 1;
const SLIP39_EXTENDABLE_BACKUP_FLAG = 1;
const ITERATION_EXP_WORDS_LENGTH = 2;

export type Slip39ShareMetadata = {
  identifier: number;
  extendableBackupFlag: number;
  iterationExponent: number;
  groupIndex: number;
  groupThreshold: number;
  groupCount: number;
  memberIndex: number;
  memberThreshold: number;
};

export type Slip39ShareProgress = {
  acceptedShares: string[];
  requiredShares: number;
  complete: boolean;
  metadata: Slip39ShareMetadata;
};

function decodeInt(indices: number[]): number {
  return indices.reduce((value, index) => value * 1024 + index, 0);
}

function intToIndices(value: number, length: number, bits: number): number[] {
  const mask = (1 << bits) - 1;
  const indices = Array(length).fill(0);
  let remaining = value;

  for (let i = length - 1; i >= 0; i--) {
    indices[i] = remaining & mask;
    remaining = remaining >> bits;
  }

  return indices;
}

export function normalizeSlip39Share(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

export function isSlip39Word(word: string): boolean {
  return WORD_LIST.includes(word.toLowerCase());
}

function decodeShareIndices(words: string[]): number[] {
  return words.map(word => {
    const index = WORD_LIST.indexOf(word);
    if (index === -1) {
      throw new Error(`"${word}" is not a valid SLIP39 word.`);
    }
    return index;
  });
}

function metadataFromIndices(indices: number[]): Slip39ShareMetadata {
  const idExpExt = decodeInt(indices.slice(0, ITERATION_EXP_WORDS_LENGTH));
  const identifier = idExpExt >> 5;
  const extendableBackupFlag = (idExpExt >> 4) & 1;
  const iterationExponent = idExpExt & 0x0f;
  const groupParts = intToIndices(
    decodeInt(indices.slice(ITERATION_EXP_WORDS_LENGTH, 4)),
    5,
    4,
  );

  return {
    identifier,
    extendableBackupFlag,
    iterationExponent,
    groupIndex: groupParts[0],
    groupThreshold: groupParts[1] + 1,
    groupCount: groupParts[2] + 1,
    memberIndex: groupParts[3],
    memberThreshold: groupParts[4] + 1,
  };
}

export function previewSlip39ShareMetadata(
  share: string,
): Slip39ShareMetadata | null {
  const normalized = normalizeSlip39Share(share);
  const words = normalized.split(' ').filter(Boolean);
  if (words.length < 4) {
    return null;
  }

  try {
    return metadataFromIndices(decodeShareIndices(words.slice(0, 4)));
  } catch {
    return null;
  }
}

export function decodeSlip39ShareMetadata(share: string): Slip39ShareMetadata {
  const normalized = normalizeSlip39Share(share);
  const words = normalized.split(' ').filter(Boolean);
  if (words.length !== SLIP39_SHARE_WORD_COUNT) {
    throw new Error('SLIP39 shares must contain exactly 20 words.');
  }

  const indices = decodeShareIndices(words);

  if (!Slip39.validateMnemonic(normalized)) {
    throw new Error('Invalid SLIP39 share checksum.');
  }

  return metadataFromIndices(indices);
}

export function getSlip39ShareProgress(shares: string[]): Slip39ShareProgress {
  const acceptedShares: string[] = [];
  let firstMetadata: Slip39ShareMetadata | null = null;
  const seen = new Set<string>();

  for (const share of shares) {
    const normalized = normalizeSlip39Share(share);
    if (seen.has(normalized)) {
      throw new Error('Duplicate SLIP39 share.');
    }

    const metadata = decodeSlip39ShareMetadata(normalized);
    if (!firstMetadata) {
      firstMetadata = metadata;
      if (metadata.groupThreshold !== SLIP39_GROUP_THRESHOLD) {
        throw new Error('Multi-group SLIP39 is not supported yet.');
      }
      if (metadata.memberThreshold > SLIP39_MAX_SHARES) {
        throw new Error('SLIP39 member threshold is too high.');
      }
    } else if (metadata.identifier !== firstMetadata.identifier) {
      throw new Error('SLIP39 share identifier does not match.');
    } else if (metadata.groupIndex !== firstMetadata.groupIndex) {
      throw new Error('SLIP39 share group does not match.');
    } else if (metadata.memberThreshold !== firstMetadata.memberThreshold) {
      throw new Error('SLIP39 share threshold does not match.');
    }

    seen.add(normalized);
    acceptedShares.push(normalized);
  }

  if (!firstMetadata) {
    throw new Error('Add at least one SLIP39 share.');
  }

  return {
    acceptedShares,
    requiredShares: firstMetadata.memberThreshold,
    complete: acceptedShares.length >= firstMetadata.memberThreshold,
    metadata: firstMetadata,
  };
}

export function recoverSlip39Secret(
  shares: string[],
  passphrase = '',
): Uint8Array {
  const progress = getSlip39ShareProgress(shares);
  if (!progress.complete) {
    throw new Error(
      `Add ${
        progress.requiredShares - progress.acceptedShares.length
      } more SLIP39 share(s).`,
    );
  }

  const secret = new Uint8Array(
    Slip39.recoverSecret(
      progress.acceptedShares.slice(0, progress.requiredShares),
      // SLIP-0039 requires NFKD; the slip39 package encodes the string as given.
      passphrase.normalize('NFKD'),
    ),
  );

  if (secret.length !== SLIP39_SECRET_BYTES) {
    throw new Error('Unsupported SLIP39 secret length.');
  }

  return secret;
}

export function validateSlip39GenerationArgs(args: {
  shareCount: number;
  threshold: number;
}) {
  const { shareCount, threshold } = args;
  if (!Number.isInteger(shareCount) || !Number.isInteger(threshold)) {
    throw new Error('SLIP39 share count and threshold must be numbers.');
  }
  if (shareCount < 1 || shareCount > SLIP39_MAX_SHARES) {
    throw new Error('SLIP39 share count must be between 1 and 16.');
  }
  if (threshold < 1 || threshold > shareCount) {
    throw new Error('SLIP39 threshold must be between 1 and share count.');
  }
  if (shareCount > 1 && threshold < 2) {
    throw new Error('SLIP39 threshold must be at least 2 for multiple shares.');
  }
}

function createSlip39Shares(
  secret: Uint8Array,
  args: {
    shareCount: number;
    threshold: number;
  },
): string[] {
  validateSlip39GenerationArgs(args);
  if (secret.length !== SLIP39_SECRET_BYTES) {
    throw new Error('Unsupported SLIP39 secret length.');
  }

  const slip = Slip39.fromArray(Array.from(secret), {
    passphrase: '',
    threshold: SLIP39_GROUP_THRESHOLD,
    groups: [[args.threshold, args.shareCount]],
    iterationExponent: SLIP39_ITERATION_EXPONENT,
    extendableBackupFlag: SLIP39_EXTENDABLE_BACKUP_FLAG,
  });

  return slip.fromPath('r/0').mnemonics.map(normalizeSlip39Share);
}

export function slip39SecretFromKeycardEntropy(
  entropy: Uint8Array,
): Uint8Array {
  return sha256(entropy).slice(0, SLIP39_SECRET_BYTES);
}

export function generateSlip39SharesFromKeycardEntropy(
  entropy: Uint8Array,
  args: {
    shareCount: number;
    threshold: number;
  },
): string[] {
  const secret = slip39SecretFromKeycardEntropy(entropy);
  try {
    return createSlip39Shares(secret, args);
  } finally {
    secret.fill(0);
  }
}

export function slip39SecretToKeyPair(secret: Uint8Array): BIP32KeyPair {
  if (secret.length !== SLIP39_SECRET_BYTES) {
    throw new Error('Unsupported SLIP39 secret length.');
  }

  return BIP32KeyPair.fromBinarySeed(secret);
}
