import { CryptoPSBT } from '@keystonehq/bc-ur-registry';

import { URDecoder } from '@ngraveio/bc-ur';

import {
  BtcSigningSession,
  buildCryptoPsbtUR,
  inspectBtcPsbt,
  parseCryptoPsbtRequest,
} from '../src/utils/btcPsbt';

jest.mock('keycard-sdk', () => ({
  __esModule: true,
  default: {
    BERTLV: jest.fn().mockImplementation(() => ({
      enterConstructed: jest.fn(),
      readPrimitive: jest.fn(() => new Uint8Array([2, ...Array(32).fill(1)])),
    })),
    CryptoUtils: {
      compressPublicKey: jest.fn(key => key),
    },
  },
}));

jest.mock('../src/utils/cryptoAccount', () => ({
  pubKeyFingerprint: jest.fn(() => 0xdeadbeef),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Minimal valid PSBT v0 (magic + empty global + no inputs/outputs)
const MINIMAL_PSBT_HEX = '70736274ff01000a0200000000000000000000';

// PSBT with one input (m/84'/0'/0'/0/0) and two outputs (one change, one recipient)
// Built with bitcoinjs-lib in a real environment; values are plausible testnet amounts.
// We use a pre-serialised hex to keep the test self-contained.
// The PSBT was constructed to have:
//   - 1 input, 2 outputs
//   - bip32Derivation on input  → path m/84'/1'/0'/0/0  (testnet)
//   - bip32Derivation on output[1] (change)
//   - no feeSats (witnessUtxo missing → psbt.getFee() throws)
const TESTNET_WPKH_PSBT_HEX = (() => {
  // We build it programmatically so the test doesn't depend on a magic string.
  const { Psbt, payments, networks } = require('bitcoinjs-lib');
  const psbt = new Psbt({ network: networks.testnet });

  const fakePubkey = Buffer.alloc(33, 0x02);
  const { output } = payments.p2wpkh({
    pubkey: fakePubkey,
    network: networks.testnet,
  });

  psbt.addInput({
    hash: Buffer.alloc(32, 0xaa),
    index: 0,
    bip32Derivation: [
      {
        masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
        path: "m/84'/1'/0'/0/0",
        pubkey: fakePubkey,
      },
    ],
  });

  psbt.addOutput({ script: output!, value: 90_000 });
  psbt.addOutput({
    script: output!,
    value: 9_000,
    bip32Derivation: [
      {
        masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
        path: "m/84'/1'/0'/1/0",
        pubkey: fakePubkey,
      },
    ],
  });

  return psbt.toBuffer().toString('hex');
})();

const BIP322_PSBT_HEX = (() => {
  const {
    Psbt,
    Transaction,
    payments,
    networks,
    script,
    opcodes,
  } = require('bitcoinjs-lib');

  const fakePubkey = Buffer.alloc(33, 0x02);
  const { output } = payments.p2wpkh({
    pubkey: fakePubkey,
    network: networks.testnet,
  });

  const toSpend = new Transaction();
  toSpend.version = 0;
  toSpend.addInput(
    Buffer.alloc(32, 0x00),
    0xffffffff,
    0,
    script.compile([opcodes.OP_0, Buffer.alloc(32, 0x11)]),
  );
  toSpend.addOutput(output!, 0);

  const psbt = new Psbt({ network: networks.testnet });
  psbt.setVersion(0);
  psbt.addInput({
    hash: toSpend.getHash(),
    index: 0,
    sequence: 0,
    witnessUtxo: {
      script: output!,
      value: 0,
    },
    bip32Derivation: [
      {
        masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
        path: "m/84'/1'/0'/0/0",
        pubkey: fakePubkey,
      },
    ],
  });
  psbt.addOutput({ script: Buffer.from([0x6a]), value: 0 });

  return psbt.toBuffer().toString('hex');
})();

// ---------------------------------------------------------------------------
// parseCryptoPsbtRequest
// ---------------------------------------------------------------------------

describe('parseCryptoPsbtRequest', () => {
  it('extracts psbtHex from a valid CryptoPSBT CBOR', () => {
    const psbtBytes = Buffer.from(MINIMAL_PSBT_HEX, 'hex');
    const cbor = new CryptoPSBT(psbtBytes).toCBOR();
    const result = parseCryptoPsbtRequest(cbor);
    expect(result.psbtHex).toBe(MINIMAL_PSBT_HEX);
  });

  it('returns a psbtHex string even for unexpected CBOR (library quirk)', () => {
    // CryptoPSBT.fromCBOR does not throw on bad input — getPSBT() silently returns
    // an Error object whose .toString('hex') yields a non-PSBT string.
    const result = parseCryptoPsbtRequest(Buffer.from([0x41, 0x00]));
    expect(typeof result.psbtHex).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// inspectBtcPsbt
// ---------------------------------------------------------------------------

describe('inspectBtcPsbt', () => {
  it('throws for an invalid PSBT hex', () => {
    expect(() => inspectBtcPsbt('deadbeef')).toThrow();
  });

  it('returns inputCount 0 for a PSBT with no inputs', () => {
    const summary = inspectBtcPsbt(MINIMAL_PSBT_HEX);
    expect(summary.inputCount).toBe(0);
  });

  it('returns correct input and output counts', () => {
    const summary = inspectBtcPsbt(TESTNET_WPKH_PSBT_HEX);
    expect(summary.inputCount).toBe(1);
    expect(summary.outputCount).toBe(2);
  });

  it('detects testnet from derivation path coin type 1', () => {
    const summary = inspectBtcPsbt(TESTNET_WPKH_PSBT_HEX);
    expect(summary.network).toBe('testnet');
  });

  it('marks outputs with bip32Derivation as change', () => {
    const summary = inspectBtcPsbt(TESTNET_WPKH_PSBT_HEX);
    expect(summary.outputs[0].isChange).toBe(false);
    expect(summary.outputs[1].isChange).toBe(true);
  });

  it('reports totalOutputSats as sum of all outputs', () => {
    const summary = inspectBtcPsbt(TESTNET_WPKH_PSBT_HEX);
    expect(summary.totalOutputSats).toBe(99_000);
  });

  it('detects shell-style BIP-322 message signing PSBTs', () => {
    const summary = inspectBtcPsbt(BIP322_PSBT_HEX);
    expect(summary.requestType).toBe('bip322-message');
    expect(summary.bip322Address).toMatch(/^tb1/);
  });

  it('detects mainnet from derivation path coin type 0', () => {
    const { Psbt, payments, networks } = require('bitcoinjs-lib');
    const fakePubkey = Buffer.alloc(33, 0x02);
    const { output } = payments.p2wpkh({
      pubkey: fakePubkey,
      network: networks.bitcoin,
    });
    const psbt = new Psbt({ network: networks.bitcoin });
    psbt.addInput({
      hash: Buffer.alloc(32, 0xbb),
      index: 0,
      bip32Derivation: [
        {
          masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
          path: "m/84'/0'/0'/0/0",
          pubkey: fakePubkey,
        },
      ],
    });
    psbt.addOutput({ script: output!, value: 50_000 });
    const summary = inspectBtcPsbt(psbt.toBuffer().toString('hex'));
    expect(summary.network).toBe('mainnet');
  });

  it('resolves input value from nonWitnessUtxo', () => {
    const { Psbt, Transaction, payments, networks } = require('bitcoinjs-lib');
    const fakePubkey = Buffer.alloc(33, 0x02);
    const { output } = payments.p2pkh({
      pubkey: fakePubkey,
      network: networks.bitcoin,
    });

    const prevTx = new Transaction();
    prevTx.addInput(Buffer.alloc(32), 0);
    prevTx.addOutput(output!, 80_000);

    const psbt = new Psbt({ network: networks.bitcoin });
    psbt.addInput({
      hash: prevTx.getHash(),
      index: 0,
      nonWitnessUtxo: prevTx.toBuffer(),
      bip32Derivation: [
        {
          masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
          path: "m/44'/0'/0'/0/0",
          pubkey: fakePubkey,
        },
      ],
    });
    psbt.addOutput({ script: output!, value: 70_000 });

    const summary = inspectBtcPsbt(psbt.toBuffer().toString('hex'));
    expect(summary.network).toBe('mainnet');
    expect(summary.inputCount).toBe(1);
    expect(summary.totalOutputSats).toBe(70_000);
  });

  it('returns unknown network when no derivation path present', () => {
    const summary = inspectBtcPsbt(MINIMAL_PSBT_HEX);
    expect(summary.network).toBe('unknown');
  });

  it('falls back to script hex when an output script is not an address', () => {
    const { Psbt, networks } = require('bitcoinjs-lib');
    const fakePubkey = Buffer.alloc(33, 0x02);
    const psbt = new Psbt({ network: networks.testnet });
    psbt.addInput({
      hash: Buffer.alloc(32, 0xcc),
      index: 0,
      bip32Derivation: [
        {
          masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
          path: "m/84'/1'/0'/0/0",
          pubkey: fakePubkey,
        },
      ],
    });
    psbt.addOutput({ script: Buffer.from([0x51]), value: 12_345 });

    const summary = inspectBtcPsbt(psbt.toBuffer().toString('hex'));
    expect(summary.outputs[0].address).toBe('51');
  });
});

describe('BtcSigningSession', () => {
  const { pubKeyFingerprint } = require('../src/utils/cryptoAccount');
  const cmdSet = {
    exportKey: jest.fn(() => ({
      checkOK: jest.fn(),
      data: new Uint8Array([1, 2, 3]),
    })),
    signWithPath: jest.fn(),
  } as any;

  beforeEach(() => {
    cmdSet.exportKey.mockClear();
    cmdSet.signWithPath.mockClear();
    pubKeyFingerprint.mockReturnValue(0xdeadbeef);
  });

  it('throws when the Keycard fingerprint matches no inputs', async () => {
    pubKeyFingerprint.mockReturnValue(0x12345678);
    const session = new BtcSigningSession(TESTNET_WPKH_PSBT_HEX);

    await expect(session.signWithKeycard(cmdSet)).rejects.toThrow(
      'This Keycard cannot sign any inputs in this transaction.',
    );
  });

  it('rejects taproot inputs before signing', async () => {
    const { Psbt, payments, networks } = require('bitcoinjs-lib');
    const fakePubkey = Buffer.alloc(33, 0x02);
    const tapInternalKey = Buffer.alloc(32, 0x03);
    const { output } = payments.p2wpkh({
      pubkey: fakePubkey,
      network: networks.testnet,
    });
    const psbt = new Psbt({ network: networks.testnet });
    psbt.addInput({
      hash: Buffer.alloc(32, 0xdd),
      index: 0,
      witnessUtxo: {
        script: output!,
        value: 50_000,
      },
      tapInternalKey,
      tapBip32Derivation: [
        {
          masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
          path: "m/86'/1'/0'/0/0",
          pubkey: tapInternalKey,
          leafHashes: [],
        },
      ],
    });
    psbt.addOutput({ script: output!, value: 40_000 });
    const session = new BtcSigningSession(psbt.toBuffer().toString('hex'));

    await expect(session.signWithKeycard(cmdSet)).rejects.toThrow(
      'Taproot inputs are not supported yet.',
    );
    expect(cmdSet.signWithPath).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// buildCryptoPsbtUR
// ---------------------------------------------------------------------------

describe('buildCryptoPsbtUR', () => {
  it('returns a UR string with crypto-psbt type prefix', () => {
    const result = buildCryptoPsbtUR(MINIMAL_PSBT_HEX);
    expect(result).toMatch(/^ur:crypto-psbt\//i);
  });

  it('produces output decodable back to the same PSBT bytes', () => {
    const result = buildCryptoPsbtUR(MINIMAL_PSBT_HEX);
    const decoder = new URDecoder();
    decoder.receivePart(result);
    expect(decoder.isComplete()).toBe(true);
    const decoded = CryptoPSBT.fromCBOR(decoder.resultUR().cbor);
    expect(decoded.getPSBT().toString('hex')).toBe(MINIMAL_PSBT_HEX);
  });
});
