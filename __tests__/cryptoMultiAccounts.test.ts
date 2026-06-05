import { CryptoMultiAccounts } from '@keystonehq/bc-ur-registry';
import { URDecoder } from '@ngraveio/bc-ur';
import {
  buildCryptoMultiAccountsUR,
  exportKeysForBitget,
  type BitgetExportResult,
} from '../src/utils/cryptoMultiAccounts';

/* eslint-disable no-bitwise */
// Mock keycard-sdk so tests work with synthetic (non-curve-valid) public keys
jest.mock('keycard-sdk', () => ({
  BIP32KeyPair: {
    fromTLV: (data: Uint8Array) => {
      let pos = 2;
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
  BERTLV: jest.fn().mockImplementation(() => ({
    enterConstructed: jest.fn(),
    readPrimitive: jest.fn().mockReturnValue(new Uint8Array(65)),
  })),
}));

// ---------------------------------------------------------------------------
// TLV builder helpers (mirrors Keycard exportExtendedKey response)
// ---------------------------------------------------------------------------

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
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function buildExtendedKeyTLV(
  pubKey: Uint8Array,
  chainCode: Uint8Array,
): Uint8Array {
  const inner = concat(tlvEncode(0x80, pubKey), tlvEncode(0x82, chainCode));
  return tlvEncode(0xa1, inner);
}

function makeMockCmdSet() {
  let exportKeyCall = 0;
  let exportExtendedKeyCall = 0;

  return {
    exportKey: jest.fn().mockImplementation(() => {
      const seed = ++exportKeyCall;
      const pub = new Uint8Array(65);
      pub[0] = 0x04;
      pub[1] = seed;
      const data = tlvEncode(0xa1, concat(tlvEncode(0x80, pub)));
      return Promise.resolve({ checkOK: jest.fn(), data });
    }),
    exportExtendedKey: jest.fn().mockImplementation(() => {
      const seed = ++exportExtendedKeyCall;
      const pub = new Uint8Array(65);
      pub[0] = 0x04;
      pub[1] = seed + 100;
      const cc = new Uint8Array(32).fill(seed);
      const data = buildExtendedKeyTLV(pub, cc);
      return Promise.resolve({ checkOK: jest.fn(), data });
    }),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MASTER_FINGERPRINT = 0xaabbccdd;
const DERIVATION_PATHS = [
  "m/84'/0'/0'",
  "m/49'/0'/0'",
  "m/44'/0'/0'",
  "m/44'/60'/0'",
];

function buildFixture(): BitgetExportResult {
  return {
    masterFingerprint: MASTER_FINGERPRINT,
    keys: DERIVATION_PATHS.map((derivationPath, i) => {
      const pub = new Uint8Array(65);
      pub[0] = 0x04;
      pub[1] = i + 1; // distinguishable per key
      const cc = new Uint8Array(32).fill(i + 1);
      return {
        derivationPath,
        exportRespData: buildExtendedKeyTLV(pub, cc),
        parentFingerprint: 0x11000000 + i,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Decode via URDecoder + CryptoMultiAccounts.fromCBOR
// ---------------------------------------------------------------------------

function decodeMultiAccounts(urString: string): CryptoMultiAccounts {
  const decoder = new URDecoder();
  decoder.receivePart(urString);
  return CryptoMultiAccounts.fromCBOR(decoder.resultUR().cbor);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// exportKeysForBitget
// ---------------------------------------------------------------------------

describe('exportKeysForBitget', () => {
  it('calls setStatus with progress messages', async () => {
    const cmdSet = makeMockCmdSet() as any;
    const setStatus = jest.fn();
    await exportKeysForBitget(cmdSet, setStatus);

    expect(setStatus).toHaveBeenCalledWith('Reading master key...');
    expect(setStatus).toHaveBeenCalledWith('Exporting key 1 of 4...');
    expect(setStatus).toHaveBeenCalledWith('Exporting key 2 of 4...');
    expect(setStatus).toHaveBeenCalledWith('Exporting key 3 of 4...');
    expect(setStatus).toHaveBeenCalledWith('Exporting key 4 of 4...');
  });

  it('returns 4 keys and a masterFingerprint', async () => {
    const cmdSet = makeMockCmdSet() as any;
    const result = await exportKeysForBitget(cmdSet, jest.fn());
    expect(result.keys).toHaveLength(4);
    expect(typeof result.masterFingerprint).toBe('number');
  });

  it('each key has a parentFingerprint', async () => {
    const cmdSet = makeMockCmdSet() as any;
    const result = await exportKeysForBitget(cmdSet, jest.fn());
    for (const key of result.keys) {
      expect(typeof key.parentFingerprint).toBe('number');
    }
  });

  it('keys have the correct derivation paths', async () => {
    const cmdSet = makeMockCmdSet() as any;
    const result = await exportKeysForBitget(cmdSet, jest.fn());
    expect(result.keys.map(k => k.derivationPath)).toEqual([
      "m/84'/0'/0'",
      "m/49'/0'/0'",
      "m/44'/0'/0'",
      "m/44'/60'/0'",
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildCryptoMultiAccountsUR
// ---------------------------------------------------------------------------

describe('buildCryptoMultiAccountsUR', () => {
  let urString: string;
  let multiAccounts: CryptoMultiAccounts;

  beforeAll(() => {
    urString = buildCryptoMultiAccountsUR(buildFixture());
    multiAccounts = decodeMultiAccounts(urString);
  });

  it('returns a ur:crypto-multi-accounts string', () => {
    expect(urString.toLowerCase()).toMatch(/^ur:crypto-multi-accounts\//);
  });

  it('encodes the master fingerprint correctly', () => {
    const fp = multiAccounts.getMasterFingerprint();
    expect(fp.toString('hex')).toBe('aabbccdd');
  });

  it('contains exactly 4 keys', () => {
    expect(multiAccounts.getKeys()).toHaveLength(4);
  });

  it('device name is "Keycard Pal"', () => {
    expect(multiAccounts.getDevice()).toBe('Keycard Pal');
  });

  describe('individual keys', () => {
    it('each key has a 33-byte compressed public key', () => {
      for (const hdKey of multiAccounts.getKeys()) {
        expect(hdKey.getKey().length).toBe(33);
      }
    });

    it('each key has a 32-byte chain code', () => {
      for (const hdKey of multiAccounts.getKeys()) {
        expect(hdKey.getChainCode()!.length).toBe(32);
      }
    });

    it('each key has an origin keypath', () => {
      for (const hdKey of multiAccounts.getKeys()) {
        expect(hdKey.getOrigin()).toBeDefined();
      }
    });

    it('each key has name "Keycard Pal"', () => {
      for (const hdKey of multiAccounts.getKeys()) {
        expect(hdKey.getName()).toBe('Keycard Pal');
      }
    });

    it('keys have distinct public keys', () => {
      const pubkeys = multiAccounts
        .getKeys()
        .map(k => k.getKey().toString('hex'));
      expect(new Set(pubkeys).size).toBe(4);
    });

    it('all keys have depth 3 in their origin path', () => {
      for (const hdKey of multiAccounts.getKeys()) {
        expect(hdKey.getOrigin()!.getComponents()).toHaveLength(3);
      }
    });

    it('origin of key 0 starts with index 84 (hardened)', () => {
      const components = multiAccounts
        .getKeys()[0]
        .getOrigin()!
        .getComponents();
      expect(components[0].getIndex()).toBe(84);
      expect(components[0].isHardened()).toBe(true);
    });

    it('origin of key 3 starts with index 44 (Ethereum path)', () => {
      const components = multiAccounts
        .getKeys()[3]
        .getOrigin()!
        .getComponents();
      expect(components[0].getIndex()).toBe(44);
      expect(components[1].getIndex()).toBe(60);
    });
  });

  describe('parentFingerprint', () => {
    it('each key has a parentFingerprint', () => {
      for (const hdKey of multiAccounts.getKeys()) {
        expect(hdKey.getParentFingerprint()).toBeDefined();
      }
    });

    it('parentFingerprint matches the fixture values', () => {
      const fps = multiAccounts
        .getKeys()
        .map(k => k.getParentFingerprint()!.readUInt32BE(0));
      expect(fps).toEqual([0x11000000, 0x11000001, 0x11000002, 0x11000003]);
    });
  });

  describe('useInfo (coin type)', () => {
    it('BTC keys (0-2) have no useInfo', () => {
      for (const hdKey of multiAccounts.getKeys().slice(0, 3)) {
        expect(hdKey.getUseInfo()).toBeUndefined();
      }
    });

    it('ETH key (3) has useInfo with coin type 60', () => {
      const useInfo = multiAccounts.getKeys()[3].getUseInfo();
      expect(useInfo).toBeDefined();
      expect(useInfo!.getType()).toBe(60);
    });
  });

  describe('source field (note)', () => {
    it('BTC keys (0-2) have no note/source', () => {
      for (const hdKey of multiAccounts.getKeys().slice(0, 3)) {
        expect(hdKey.getNote()).toBeUndefined();
      }
    });

    it('ETH key (3) has note "account.standard"', () => {
      expect(multiAccounts.getKeys()[3].getNote()).toBe('account.standard');
    });
  });
});
