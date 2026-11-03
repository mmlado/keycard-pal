import {
  DataItem,
  URRegistryDecoder,
  decodeToDataItem,
} from '@keystonehq/bc-ur-registry';
import { URDecoder } from '@ngraveio/bc-ur';

import {
  buildCryptoAccountUR,
  pubKeyFingerprint,
} from '../src/utils/cryptoAccount';

/* eslint-disable no-bitwise */
// Mock keycard-sdk so tests work with synthetic (non-curve-valid) public keys
jest.mock('keycard-sdk', () => ({
  BIP32KeyPair: {
    fromTLV: (data: Uint8Array) => {
      // Minimal TLV parse: 0xa1 outer, then read 0x80 pubkey and 0x82 chainCode
      let pos = 2; // skip 0xa1 + length
      if (data[1] === 0x81) pos = 3;
      const pubLen = data[pos + 1];
      const pubKey = data.slice(pos + 2, pos + 2 + pubLen);
      pos += 2 + pubLen;
      const chainLen = data[pos + 1];
      const chainCode = data.slice(pos + 2, pos + 2 + chainLen);
      return { publicKey: pubKey, chainCode };
    },
  },
  CryptoUtils: {
    compressPublicKey: (pub: Uint8Array) => {
      const prefix = (pub[64] & 1) === 0 ? 0x02 : 0x03;
      const out = new Uint8Array(33);
      out[0] = prefix;
      out.set(pub.slice(1, 33), 1);
      return out;
    },
  },
}));

function tlvEncode(tag: number, data: Uint8Array): Uint8Array {
  const len = data.length;
  const header =
    len < 0x80 ? new Uint8Array([tag, len]) : new Uint8Array([tag, 0x81, len]);
  const out = new Uint8Array(header.length + len);
  out.set(header, 0);
  out.set(data, header.length);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function buildExportKeyTLV(
  pubKey: Uint8Array,
  chainCode: Uint8Array,
): Uint8Array {
  return tlvEncode(
    0xa1,
    concat(tlvEncode(0x80, pubKey), tlvEncode(0x82, chainCode)),
  );
}

const PUB_KEY_UNCOMPRESSED = new Uint8Array(65);
PUB_KEY_UNCOMPRESSED[0] = 0x04;
PUB_KEY_UNCOMPRESSED[32] = 0x01;

const CHAIN_CODE = new Uint8Array(32).fill(0xaa);
const EXPORT_DATA = buildExportKeyTLV(PUB_KEY_UNCOMPRESSED, CHAIN_CODE);

const COIN_INFO_TAG = 305;

function coinInfoMaps(ur: string): unknown[] {
  const decoder = new URDecoder();
  decoder.receivePart(ur);
  const found: unknown[] = [];
  const walk = (item: unknown): void => {
    if (item instanceof DataItem) {
      if (item.getTag() === COIN_INFO_TAG) {
        found.push(item.getData());
      }
      walk(item.getData());
    } else if (Array.isArray(item)) {
      item.forEach(walk);
    } else if (item && typeof item === 'object' && !Buffer.isBuffer(item)) {
      Object.values(item).forEach(walk);
    }
  };
  walk(decodeToDataItem(decoder.resultUR().cbor));
  return found;
}

function accountUR(derivationPaths: string[]): string {
  return buildCryptoAccountUR({
    masterFingerprint: 0xaabbccdd,
    descriptors: derivationPaths.map(derivationPath => ({
      derivationPath,
      exportRespData: EXPORT_DATA,
      parentFingerprint: 0x11223344,
      scriptType: 'wpkh',
    })),
  });
}

describe('buildCryptoAccountUR', () => {
  it('returns a ur:crypto-account string', () => {
    const ur = buildCryptoAccountUR({
      masterFingerprint: 0xaabbccdd,
      descriptors: [
        {
          derivationPath: "m/84'/0'/0'",
          exportRespData: EXPORT_DATA,
          parentFingerprint: 0x11223344,
          scriptType: 'wpkh',
        },
      ],
    });

    expect(ur.toLowerCase()).toMatch(/^ur:crypto-account\//);
  });

  it('encodes master fingerprint and descriptor list', () => {
    const ur = buildCryptoAccountUR({
      masterFingerprint: 0xaabbccdd,
      descriptors: [
        {
          derivationPath: "m/84'/0'/0'",
          exportRespData: EXPORT_DATA,
          parentFingerprint: 0x11223344,
          scriptType: 'wpkh',
        },
        {
          derivationPath: "m/49'/0'/0'",
          exportRespData: EXPORT_DATA,
          parentFingerprint: 0x55667788,
          scriptType: 'sh-wpkh',
        },
        {
          derivationPath: "m/44'/0'/0'",
          exportRespData: EXPORT_DATA,
          parentFingerprint: 0x99aabbcc,
          scriptType: 'pkh',
        },
      ],
    });

    const decoder = new URRegistryDecoder();
    decoder.receivePart(ur);
    expect(decoder.isSuccess()).toBe(true);

    const cryptoAccount = decoder.resultRegistryType() as any;
    expect(cryptoAccount.getMasterFingerprint().toString('hex')).toBe(
      'aabbccdd',
    );

    const descriptors = cryptoAccount.getOutputDescriptors();
    expect(descriptors).toHaveLength(3);
    expect(descriptors.map((item: any) => item.toString())).toEqual([
      expect.stringContaining('wpkh('),
      expect.stringContaining('sh(wpkh('),
      expect.stringContaining('pkh('),
    ]);
  });

  it('encodes multisig descriptor script expressions', () => {
    const ur = buildCryptoAccountUR({
      masterFingerprint: 0xaabbccdd,
      descriptors: [
        {
          derivationPath: "m/48'/0'/0'/2'",
          exportRespData: EXPORT_DATA,
          parentFingerprint: 0x11223344,
          scriptType: 'wsh',
        },
        {
          derivationPath: "m/48'/0'/0'/1'",
          exportRespData: EXPORT_DATA,
          parentFingerprint: 0x55667788,
          scriptType: 'sh-wsh',
        },
        {
          derivationPath: "m/45'",
          exportRespData: EXPORT_DATA,
          parentFingerprint: 0x99aabbcc,
          scriptType: 'sh',
        },
      ],
    });

    const decoder = new URRegistryDecoder();
    decoder.receivePart(ur);
    const cryptoAccount = decoder.resultRegistryType() as any;

    expect(
      cryptoAccount.getOutputDescriptors().map((item: any) => item.toString()),
    ).toEqual([
      expect.stringContaining('wsh('),
      expect.stringContaining('sh(wsh('),
      expect.stringContaining('sh('),
    ]);
  });

  it('writes the mainnet coin type and network explicitly', () => {
    expect(
      coinInfoMaps(accountUR(["m/84'/0'/0'", "m/48'/0'/0'/2'", "m/45'"])),
    ).toEqual([
      { 1: 0, 2: 0 },
      { 1: 0, 2: 0 },
      { 1: 0, 2: 0 },
    ]);
  });

  it('writes the testnet network', () => {
    expect(coinInfoMaps(accountUR(["m/84'/1'/0'"]))).toEqual([{ 1: 0, 2: 1 }]);
  });

  it('computes a public-key fingerprint', () => {
    expect(pubKeyFingerprint(PUB_KEY_UNCOMPRESSED)).toBe(0xe01b06b9);
  });
});
