import { sha256 } from '@noble/hashes/sha2.js';
import * as secp from '@noble/secp256k1';
import { base64, createBase58check } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';

import { Icons, type IconComponent } from '@/assets/icons';

import { toHex } from './hex';

export type Bip85Format =
  | 'words12'
  | 'words18'
  | 'words24'
  | 'wif'
  | 'xprv'
  | 'hex32'
  | 'hex64'
  | 'password';

/** The largest hardened index, so an index used with any other BIP85 tool can be derived here. */
export const BIP85_MAX_INDEX = 2 ** 31 - 1;

const ROOT = "m/83696968'";
const PASSWORD_LENGTH = 21;

const base58check = createBase58check(sha256);

/**
 * One BIP85 application: the menu row, the bytes the card returns for it,
 * its path and how those bytes are written down.
 */
export type Bip85FormatRow = {
  section: string;
  label: string;
  /** The screen title, and the name of the hidden secret. */
  title: string;
  icon: IconComponent;
  layout: 'words' | 'text';
  /** The length EXPORT BIP85 is asked for. */
  bytes: number;
  /** The path between the BIP85 root and the index. */
  application: string;
  /** Null when the bytes are no valid private key; BIP85 then moves to the next index. */
  encode: (entropy: Uint8Array) => string | null;
};

function words(entropy: Uint8Array): string {
  return entropyToMnemonic(entropy, englishWordlist);
}

function wif(entropy: Uint8Array): string | null {
  if (!secp.utils.isValidSecretKey(entropy)) {
    return null;
  }
  // Mainnet, compressed: Bitcoin Core's hdseed.
  return base58check.encode(new Uint8Array([0x80, ...entropy, 0x01]));
}

function xprv(entropy: Uint8Array): string | null {
  // The chain code comes first, the reverse of BIP32.
  const chainCode = entropy.slice(0, 32);
  const privateKey = entropy.slice(32);
  if (!secp.utils.isValidSecretKey(privateKey)) {
    return null;
  }
  return new HDKey({ chainCode, privateKey }).privateExtendedKey;
}

function password(entropy: Uint8Array): string {
  return base64.encode(entropy).slice(0, PASSWORD_LENGTH);
}

/** Keyed by format, so a new format does not compile without its row. Menu order. */
const FORMATS: Record<Bip85Format, Bip85FormatRow> = {
  words12: {
    section: 'BIP39 recovery phrase',
    label: '12 words',
    title: '12-word BIP39 phrase',
    icon: Icons.phraseShort,
    layout: 'words',
    bytes: 16,
    application: "39'/0'/12'",
    encode: words,
  },
  words18: {
    section: 'BIP39 recovery phrase',
    label: '18 words',
    title: '18-word BIP39 phrase',
    icon: Icons.phraseLong,
    layout: 'words',
    bytes: 24,
    application: "39'/0'/18'",
    encode: words,
  },
  words24: {
    section: 'BIP39 recovery phrase',
    label: '24 words',
    title: '24-word BIP39 phrase',
    icon: Icons.phraseLong,
    layout: 'words',
    bytes: 32,
    application: "39'/0'/24'",
    encode: words,
  },
  wif: {
    section: 'Private key',
    label: 'Bitcoin WIF',
    title: 'Bitcoin WIF private key',
    icon: Icons.key,
    layout: 'text',
    bytes: 32,
    application: "2'",
    encode: wif,
  },
  xprv: {
    section: 'Private key',
    label: 'BIP32 XPRV',
    title: 'BIP32 extended private key',
    icon: Icons.key,
    layout: 'text',
    bytes: 64,
    application: "32'",
    encode: xprv,
  },
  hex32: {
    section: 'Hex entropy',
    label: '32 bytes',
    title: '32-byte hex entropy',
    icon: Icons.hex,
    layout: 'text',
    bytes: 32,
    application: "128169'/32'",
    encode: toHex,
  },
  hex64: {
    section: 'Hex entropy',
    label: '64 bytes',
    title: '64-byte hex entropy',
    icon: Icons.hex,
    layout: 'text',
    bytes: 64,
    application: "128169'/64'",
    encode: toHex,
  },
  password: {
    section: 'Base64 password',
    label: `${PASSWORD_LENGTH} characters`,
    title: 'Base64 password',
    icon: Icons.password,
    layout: 'text',
    bytes: 64,
    application: `707764'/${PASSWORD_LENGTH}'`,
    encode: password,
  },
};

export const BIP85_FORMATS = Object.keys(FORMATS) as Bip85Format[];

export function bip85Format(format: Bip85Format): Bip85FormatRow {
  return FORMATS[format];
}

export function bip85Path(format: Bip85Format, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > BIP85_MAX_INDEX) {
    throw new Error(`BIP85 index must be 0 to ${BIP85_MAX_INDEX}`);
  }
  return `${ROOT}/${FORMATS[format].application}/${index}'`;
}
