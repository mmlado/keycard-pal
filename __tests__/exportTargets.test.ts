import type { ExportedKey } from '../src/utils/keycardExport';
import { EXPORT_TARGETS, getExportTarget } from '../src/utils/exportTargets';

jest.mock('../src/utils/cryptoHdKey', () => ({
  buildCryptoHdKeyUR: jest.fn(() => 'ur:crypto-hdkey/mock'),
}));
jest.mock('../src/utils/cryptoAccount', () => ({
  buildCryptoAccountUR: jest.fn(() => 'ur:crypto-account/mock'),
}));
jest.mock('../src/utils/cryptoMultiAccounts', () => ({
  buildCryptoMultiAccountsUR: jest.fn(() => 'ur:crypto-multi-accounts/mock'),
}));

const { buildCryptoHdKeyUR } = require('../src/utils/cryptoHdKey');
const { buildCryptoAccountUR } = require('../src/utils/cryptoAccount');
const {
  buildCryptoMultiAccountsUR,
} = require('../src/utils/cryptoMultiAccounts');

function exportedKeys(target: { keys: readonly any[] }): ExportedKey<any>[] {
  return target.keys.map((entry, i) => ({
    entry,
    exportRespData: new Uint8Array([i]),
    parentFingerprint: 0x1000 + i,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('export plans', () => {
  it('declares seven targets in menu order', () => {
    expect(EXPORT_TARGETS.map(t => t.id)).toEqual([
      'ethereum',
      'bitcoin',
      'bitcoin-multisig',
      'bitcoin-testnet',
      'bitget',
      'ledger-live',
      'ledger-legacy',
    ]);
  });

  it('every plan entry pairs a derivation path with its parent path', () => {
    for (const target of EXPORT_TARGETS) {
      for (const entry of target.keys) {
        expect(entry.derivationPath.startsWith('m/')).toBe(true);
        expect(
          entry.parentPath === 'm' ||
            entry.derivationPath.startsWith(entry.parentPath + '/'),
        ).toBe(true);
      }
    }
  });

  it('bitcoin single-sig plans export wpkh, sh-wpkh, and pkh accounts', () => {
    const paths = getExportTarget('bitcoin').keys.map(k => k.derivationPath);
    expect(paths).toEqual(["m/84'/0'/0'", "m/49'/0'/0'", "m/44'/0'/0'"]);
    const testnetPaths = getExportTarget('bitcoin-testnet').keys.map(
      k => k.derivationPath,
    );
    expect(testnetPaths).toEqual(["m/84'/1'/0'", "m/49'/1'/0'", "m/44'/1'/0'"]);
  });

  it('bitcoin multisig plan includes the m/45 fallback with the master as parent', () => {
    const keys = getExportTarget('bitcoin-multisig').keys;
    expect(keys.map(k => k.derivationPath)).toEqual([
      "m/48'/0'/0'/2'",
      "m/48'/0'/0'/1'",
      "m/45'",
    ]);
    expect(keys[2].parentPath).toBe('m');
  });

  it('getExportTarget throws on unknown ids', () => {
    expect(() => getExportTarget('nope' as any)).toThrow(
      'Unknown export target',
    );
  });
});

describe('buildUr wiring', () => {
  it('ethereum targets build a crypto-hdkey with the master and parent fingerprints and their source', () => {
    for (const [id, source] of [
      ['ethereum', 'account.standard'],
      ['ledger-live', 'account.ledger_live'],
      ['ledger-legacy', 'account.ledger_legacy'],
    ] as const) {
      const target = getExportTarget(id);
      const keys = exportedKeys(target);
      const ur = target.buildUr({ masterFingerprint: 0xaa, keys });

      expect(buildCryptoHdKeyUR).toHaveBeenCalledWith(
        keys[0].exportRespData,
        "m/44'/60'/0'",
        0xaa,
        keys[0].parentFingerprint,
        source,
      );
      expect(ur).toBe('ur:crypto-hdkey/mock');
    }
  });

  it('bitcoin targets build a crypto-account whose descriptors carry each key script type', () => {
    const target = getExportTarget('bitcoin');
    const keys = exportedKeys(target);
    target.buildUr({ masterFingerprint: 0xbb, keys });

    expect(buildCryptoAccountUR).toHaveBeenCalledWith({
      masterFingerprint: 0xbb,
      descriptors: [
        {
          derivationPath: "m/84'/0'/0'",
          exportRespData: keys[0].exportRespData,
          parentFingerprint: keys[0].parentFingerprint,
          scriptType: 'wpkh',
        },
        {
          derivationPath: "m/49'/0'/0'",
          exportRespData: keys[1].exportRespData,
          parentFingerprint: keys[1].parentFingerprint,
          scriptType: 'sh-wpkh',
        },
        {
          derivationPath: "m/44'/0'/0'",
          exportRespData: keys[2].exportRespData,
          parentFingerprint: keys[2].parentFingerprint,
          scriptType: 'pkh',
        },
      ],
    });
  });

  it('bitget builds a crypto-multi-accounts where every key carries its own coin metadata', () => {
    const target = getExportTarget('bitget');
    const keys = exportedKeys(target);
    target.buildUr({ masterFingerprint: 0xcc, keys });

    expect(buildCryptoMultiAccountsUR).toHaveBeenCalledWith(0xcc, [
      expect.objectContaining({
        derivationPath: "m/84'/0'/0'",
        coinType: 0,
        source: undefined,
      }),
      expect.objectContaining({ derivationPath: "m/49'/0'/0'", coinType: 0 }),
      expect.objectContaining({ derivationPath: "m/44'/0'/0'", coinType: 0 }),
      expect.objectContaining({
        derivationPath: "m/44'/60'/0'",
        coinType: 60,
        source: 'account.standard',
      }),
    ]);
  });
});
