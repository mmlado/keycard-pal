import { CryptoPSBT } from '@keystonehq/bc-ur-registry';

import { URDecoder } from '@ngraveio/bc-ur';

import {
  BtcPsbtRefusedError,
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

const CARD_PUBKEY = Buffer.alloc(33, 0x02);
const OTHER_PUBKEY = Buffer.alloc(33, 0x03);
const CARD_FINGERPRINT = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
const OTHER_FINGERPRINT = Buffer.from([0x0b, 0xad, 0x0b, 0xad]);
const CHANGE_PATH = "m/84'/1'/0'/1/0";

// One input the card can sign, one recipient output, and one output the PSBT
// marks as change. The knobs forge each half of that claim on its own: the
// script the change output pays to, the key its derivation entry names, and
// the wallet that entry says the key belongs to.
function psbtWithChangeClaim({
  paysTo = CARD_PUBKEY,
  namesKey = CARD_PUBKEY,
  fingerprint = CARD_FINGERPRINT,
  path = CHANGE_PATH,
}: {
  paysTo?: Buffer;
  namesKey?: Buffer;
  fingerprint?: Buffer;
  path?: string;
} = {}): string {
  const { Psbt, payments, networks } = require('bitcoinjs-lib');
  const spend = payments.p2wpkh({
    pubkey: CARD_PUBKEY,
    network: networks.testnet,
  }).output!;
  const change = payments.p2wpkh({
    pubkey: paysTo,
    network: networks.testnet,
  }).output!;

  const psbt = new Psbt({ network: networks.testnet });
  psbt.addInput({
    hash: Buffer.alloc(32, 0xaa),
    index: 0,
    witnessUtxo: { script: spend, value: 100_000 },
    bip32Derivation: [
      {
        masterFingerprint: CARD_FINGERPRINT,
        path: "m/84'/1'/0'/0/0",
        pubkey: CARD_PUBKEY,
      },
    ],
  });
  psbt.addOutput({ script: spend, value: 90_000 });
  psbt.addOutput({
    script: change,
    value: 9_000,
    bip32Derivation: [
      { masterFingerprint: fingerprint, path, pubkey: namesKey },
    ],
  });

  return psbt.toBuffer().toString('hex');
}

// A PSBT whose only output is the one under test, carrying one derivation
// entry. The input is there to keep the unsigned transaction unambiguous:
// a zero-input transaction serialises to bytes that read back as segwit.
function psbtWithOutput(
  output: Record<string, unknown> & { script: Buffer },
  pubkey: Buffer = CARD_PUBKEY,
): string {
  const { Psbt, networks } = require('bitcoinjs-lib');
  const psbt = new Psbt({ network: networks.testnet });

  psbt.addInput({ hash: Buffer.alloc(32, 0xaa), index: 0 });
  psbt.addOutput({
    ...output,
    value: 9_000,
    bip32Derivation: [
      { masterFingerprint: CARD_FINGERPRINT, path: CHANGE_PATH, pubkey },
    ],
  });

  return psbt.toBuffer().toString('hex');
}

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

// One spendable input per entry; undefined leaves PSBT_IN_SIGHASH_TYPE off.
function psbtWithSighashTypes(sighashTypes: Array<number | undefined>): string {
  const { Psbt, payments, networks } = require('bitcoinjs-lib');
  const fakePubkey = Buffer.alloc(33, 0x02);
  const { output } = payments.p2wpkh({
    pubkey: fakePubkey,
    network: networks.testnet,
  });
  const psbt = new Psbt({ network: networks.testnet });

  sighashTypes.forEach((sighashType, index) => {
    psbt.addInput({
      hash: Buffer.alloc(32, 0xa0 + index),
      index: 0,
      witnessUtxo: { script: output!, value: 100_000 },
      bip32Derivation: [
        {
          masterFingerprint: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
          path: `m/84'/1'/0'/0/${index}`,
          pubkey: fakePubkey,
        },
      ],
    });

    // Not through addInput, which refuses a falsy sighash type.
    if (sighashType !== undefined) {
      psbt.data.inputs[index].sighashType = sighashType;
    }
  });

  psbt.addOutput({ script: output!, value: 90_000 });

  return psbt.toBuffer().toString('hex');
}

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

  it('reports a change claim only for the output that carries one', () => {
    const summary = inspectBtcPsbt(TESTNET_WPKH_PSBT_HEX);
    expect(summary.outputs[0].claimsChange).toBe(false);
    expect(summary.outputs[1].claimsChange).toBe(true);
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

// ---------------------------------------------------------------------------
// inspectBtcPsbt – change claims
// ---------------------------------------------------------------------------

describe('inspectBtcPsbt change claims', () => {
  it('keeps a claim whose key is the key the output pays', () => {
    const summary = inspectBtcPsbt(psbtWithChangeClaim());
    expect(summary.outputs[1].claimsChange).toBe(true);
  });

  it('drops a forged entry naming a key the output cannot be spent with', () => {
    const summary = inspectBtcPsbt(
      psbtWithChangeClaim({ paysTo: OTHER_PUBKEY }),
    );
    expect(summary.outputs[1].claimsChange).toBe(false);
  });

  it('leaves a foreign fingerprint to the card rather than deciding on it', () => {
    const summary = inspectBtcPsbt(
      psbtWithChangeClaim({ fingerprint: OTHER_FINGERPRINT }),
    );
    expect(summary.outputs[1].claimsChange).toBe(true);
  });

  it.each([['p2pkh'], ['p2pk']])('keeps a claim on a %s output', form => {
    const { payments, networks } = require('bitcoinjs-lib');
    const summary = inspectBtcPsbt(
      psbtWithOutput({
        script: payments[form]({
          pubkey: CARD_PUBKEY,
          network: networks.testnet,
        }).output!,
      }),
    );
    expect(summary.outputs[0].claimsChange).toBe(true);
  });

  it('keeps a claim on a p2sh-wrapped p2wpkh output', () => {
    const { payments, networks } = require('bitcoinjs-lib');
    const redeem = payments.p2wpkh({
      pubkey: CARD_PUBKEY,
      network: networks.testnet,
    });
    const summary = inspectBtcPsbt(
      psbtWithOutput({
        script: payments.p2sh({ redeem, network: networks.testnet }).output!,
        redeemScript: redeem.output!,
      }),
    );
    expect(summary.outputs[0].claimsChange).toBe(true);
  });

  it('drops a claim whose redeem script does not hash to the output', () => {
    const { payments, networks } = require('bitcoinjs-lib');
    const summary = inspectBtcPsbt(
      psbtWithOutput({
        script: payments.p2sh({
          redeem: payments.p2wpkh({
            pubkey: OTHER_PUBKEY,
            network: networks.testnet,
          }),
          network: networks.testnet,
        }).output!,
        redeemScript: payments.p2wpkh({
          pubkey: CARD_PUBKEY,
          network: networks.testnet,
        }).output!,
      }),
    );
    expect(summary.outputs[0].claimsChange).toBe(false);
  });

  it('drops a claim whose key is only pushed, not required, by the script', () => {
    // <card key> OP_DROP <their key> OP_CHECKSIG: the card's key is in the
    // script and spends nothing. Reading "is the key there" rather than "does
    // the script need it" would call this output the user's change.
    const { payments, networks, script, opcodes } = require('bitcoinjs-lib');
    const decoy = script.compile([
      CARD_PUBKEY,
      opcodes.OP_DROP,
      OTHER_PUBKEY,
      opcodes.OP_CHECKSIG,
    ]);
    const summary = inspectBtcPsbt(
      psbtWithOutput({
        script: payments.p2wsh({
          redeem: { output: decoy },
          network: networks.testnet,
        }).output!,
        witnessScript: decoy,
      }),
    );
    expect(summary.outputs[0].claimsChange).toBe(false);
  });

  it('keeps a p2pkh claim whose key the witness forms would refuse', () => {
    // An uncompressed key has no p2wpkh form at all. Asking p2wpkh first must
    // not cost the output its p2pkh answer.
    const { payments, networks } = require('bitcoinjs-lib');
    const uncompressed = Buffer.concat([
      Buffer.from([0x04]),
      Buffer.alloc(64, 0x05),
    ]);
    const summary = inspectBtcPsbt(
      psbtWithOutput(
        {
          script: payments.p2pkh({
            pubkey: uncompressed,
            network: networks.testnet,
          }).output!,
        },
        uncompressed,
      ),
    );
    expect(summary.outputs[0].claimsChange).toBe(true);
  });

  it('keeps a claim on a multisig output that names the key in its script', () => {
    const { payments, networks } = require('bitcoinjs-lib');
    const multisig = payments.p2ms({
      m: 2,
      pubkeys: [CARD_PUBKEY, OTHER_PUBKEY],
      network: networks.testnet,
    });
    const summary = inspectBtcPsbt(
      psbtWithOutput({
        script: payments.p2wsh({ redeem: multisig, network: networks.testnet })
          .output!,
        witnessScript: multisig.output!,
      }),
    );
    expect(summary.outputs[0].claimsChange).toBe(true);
  });

  it('keeps a claim on a p2sh-wrapped multisig output', () => {
    const { payments, networks } = require('bitcoinjs-lib');
    const multisig = payments.p2ms({
      m: 2,
      pubkeys: [CARD_PUBKEY, OTHER_PUBKEY],
      network: networks.testnet,
    });
    const wsh = payments.p2wsh({
      redeem: multisig,
      network: networks.testnet,
    });
    const summary = inspectBtcPsbt(
      psbtWithOutput({
        script: payments.p2sh({ redeem: wsh, network: networks.testnet })
          .output!,
        redeemScript: wsh.output!,
        witnessScript: multisig.output!,
      }),
    );
    expect(summary.outputs[0].claimsChange).toBe(true);
  });

  it('drops a multisig claim whose key is in no part of the script', () => {
    const { payments, networks } = require('bitcoinjs-lib');
    const multisig = payments.p2ms({
      m: 2,
      pubkeys: [
        OTHER_PUBKEY,
        Buffer.concat([Buffer.from([0x02]), Buffer.alloc(32, 0x09)]),
      ],
      network: networks.testnet,
    });
    const summary = inspectBtcPsbt(
      psbtWithOutput({
        script: payments.p2wsh({ redeem: multisig, network: networks.testnet })
          .output!,
        witnessScript: multisig.output!,
      }),
    );
    expect(summary.outputs[0].claimsChange).toBe(false);
  });

  it('shows a taproot output as a plain output, tweak unverifiable here', () => {
    const { Psbt, networks } = require('bitcoinjs-lib');
    const tapInternalKey = Buffer.alloc(32, 0x07);

    const psbt = new Psbt({ network: networks.testnet });
    psbt.addInput({ hash: Buffer.alloc(32, 0xaa), index: 0 });
    psbt.addOutput({
      script: Buffer.concat([Buffer.from([0x51, 0x20]), tapInternalKey]),
      value: 9_000,
    });
    // Straight onto the field: addOutput tweaks the key to check it, which
    // needs an ECC library the app does not carry. A PSBT off the wire is
    // under no such obligation.
    psbt.data.outputs[0].tapBip32Derivation = [
      {
        masterFingerprint: CARD_FINGERPRINT,
        path: "m/86'/1'/0'/1/0",
        pubkey: tapInternalKey,
        leafHashes: [],
      },
    ];

    const summary = inspectBtcPsbt(psbt.toBuffer().toString('hex'));
    expect(summary.outputs[0].claimsChange).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inspectBtcPsbt – sighash types
// ---------------------------------------------------------------------------

describe('inspectBtcPsbt sighash refusal', () => {
  const REFUSED: Array<[string, number]> = [
    ['SIGHASH_DEFAULT', 0x00],
    ['SIGHASH_NONE', 0x02],
    ['SIGHASH_SINGLE', 0x03],
    ['SIGHASH_ALL|ANYONECANPAY', 0x81],
    ['SIGHASH_NONE|ANYONECANPAY', 0x82],
    ['SIGHASH_SINGLE|ANYONECANPAY', 0x83],
  ];

  it.each(REFUSED)('refuses an input that asks for %s', (name, sighashType) => {
    const hex = psbtWithSighashTypes([sighashType]);
    expect(() => inspectBtcPsbt(hex)).toThrow(BtcPsbtRefusedError);
    expect(() => inspectBtcPsbt(hex)).toThrow(name);
  });

  it('names what SIGHASH_NONE leaves loose', () => {
    expect(() => inspectBtcPsbt(psbtWithSighashTypes([0x02]))).toThrow(
      'leaves every output free to change',
    );
  });

  it('names what SIGHASH_SINGLE leaves loose', () => {
    expect(() => inspectBtcPsbt(psbtWithSighashTypes([0x03]))).toThrow(
      'leaves every output but one free to change',
    );
  });

  it('names what ANYONECANPAY leaves loose on top of the base type', () => {
    expect(() => inspectBtcPsbt(psbtWithSighashTypes([0x82]))).toThrow(
      'leaves every output free to change and lets inputs be added or removed',
    );
  });

  it('falls back to the raw value for an unrecognised sighash type', () => {
    expect(() => inspectBtcPsbt(psbtWithSighashTypes([0x44]))).toThrow(
      'sighash type 0x44',
    );
  });

  it('points at the refused input by its position', () => {
    expect(() => inspectBtcPsbt(psbtWithSighashTypes([0x01, 0x02]))).toThrow(
      'Input 2 asks to be signed with SIGHASH_NONE',
    );
  });

  it('accepts an input with no sighash type', () => {
    const summary = inspectBtcPsbt(psbtWithSighashTypes([undefined]));
    expect(summary.inputCount).toBe(1);
  });

  it('accepts an input that asks for SIGHASH_ALL', () => {
    const summary = inspectBtcPsbt(psbtWithSighashTypes([0x01]));
    expect(summary.inputCount).toBe(1);
  });
});

describe('BtcSigningSession', () => {
  const { pubKeyFingerprint } = require('../src/utils/cryptoAccount');
  const Keycard = require('keycard-sdk').default;
  const cmdSet = {
    exportKey: jest.fn(() => ({
      checkOK: jest.fn(),
      data: new Uint8Array([1, 2, 3]),
    })),
    signWithPath: jest.fn(),
  } as any;

  // Each reader gets its own BERTLV, so both start at the front of the list.
  function mockCardAnswers(publicKey: Buffer) {
    Keycard.BERTLV.mockImplementation(() => {
      const values = [
        publicKey,
        Buffer.alloc(32, 0x11),
        Buffer.alloc(32, 0x22),
      ];
      let next = 0;
      return {
        enterConstructed: jest.fn(),
        readPrimitive: jest.fn(() => values[next++]),
      };
    });
  }

  beforeEach(() => {
    cmdSet.exportKey.mockClear();
    cmdSet.signWithPath.mockClear();
    cmdSet.signWithPath.mockResolvedValue({
      checkOK: jest.fn(),
      data: new Uint8Array([1, 2, 3]),
    });
    pubKeyFingerprint.mockReturnValue(0xdeadbeef);
    mockCardAnswers(CARD_PUBKEY);
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

  it('signs an input that asks for SIGHASH_ALL, and commits to that type', async () => {
    const { Psbt } = require('bitcoinjs-lib');
    const session = new BtcSigningSession(psbtWithSighashTypes([0x01]));

    const result = await session.signWithKeycard(cmdSet);

    expect(result).toMatchObject({ signedInputs: 1, totalInputs: 1 });
    expect(cmdSet.signWithPath).toHaveBeenCalledTimes(1);

    const signed = Psbt.fromBuffer(Buffer.from(result.psbtHex, 'hex'));
    const signature = signed.data.inputs[0].partialSig![0].signature;
    expect(signature[signature.length - 1]).toBe(0x01);
  });

  it('signs an input with no sighash type as SIGHASH_ALL', async () => {
    const { Psbt } = require('bitcoinjs-lib');
    const session = new BtcSigningSession(psbtWithSighashTypes([undefined]));

    const result = await session.signWithKeycard(cmdSet);

    const signed = Psbt.fromBuffer(Buffer.from(result.psbtHex, 'hex'));
    const signature = signed.data.inputs[0].partialSig![0].signature;
    expect(signature[signature.length - 1]).toBe(0x01);
  });

  it.each([0x00, 0x02, 0x03, 0x81, 0x82, 0x83])(
    'refuses a PSBT whose input claims sighash type %i instead of signing it',
    sighashType => {
      expect(
        () => new BtcSigningSession(psbtWithSighashTypes([sighashType])),
      ).toThrow(BtcPsbtRefusedError);
      expect(cmdSet.signWithPath).not.toHaveBeenCalled();
    },
  );

  it('signs once the card confirms the output marked as change is its own', async () => {
    const session = new BtcSigningSession(psbtWithChangeClaim());

    const result = await session.signWithKeycard(cmdSet);

    expect(result).toMatchObject({ signedInputs: 1, totalInputs: 1 });
    expect(cmdSet.exportKey).toHaveBeenCalledWith(0, true, CHANGE_PATH, false);
  });

  it('refuses a change output whose keys all belong to another wallet', async () => {
    const session = new BtcSigningSession(
      psbtWithChangeClaim({ fingerprint: OTHER_FINGERPRINT }),
    );

    await expect(session.signWithKeycard(cmdSet)).rejects.toThrow(
      BtcPsbtRefusedError,
    );
    await expect(session.signWithKeycard(cmdSet)).rejects.toThrow(
      /Output 2 \(tb1.*\) is marked as change, but every key it names belongs to another wallet/,
    );
    expect(cmdSet.signWithPath).not.toHaveBeenCalled();
  });

  it('refuses a change output the card turns out not to hold the key for', async () => {
    // Consistent with itself: the entry names the very key the output pays,
    // under this card's fingerprint. Only the card can call the bluff.
    const session = new BtcSigningSession(
      psbtWithChangeClaim({ paysTo: OTHER_PUBKEY, namesKey: OTHER_PUBKEY }),
    );

    await expect(session.signWithKeycard(cmdSet)).rejects.toThrow(
      new RegExp(
        `Output 2 \\(tb1.*\\) is marked as change, but the key this Keycard ` +
          `holds at ${CHANGE_PATH} is not the key that output pays`,
      ),
    );
    expect(cmdSet.signWithPath).not.toHaveBeenCalled();
  });

  it('asks the card for nothing beyond the master key when nothing claims change', async () => {
    const session = new BtcSigningSession(psbtWithSighashTypes([0x01]));

    await session.signWithKeycard(cmdSet);

    expect(cmdSet.exportKey).toHaveBeenCalledTimes(1);
    expect(cmdSet.exportKey).toHaveBeenCalledWith(0, true, 'm', false);
  });

  it('hands the signer a constant allow-list, not the type the input asked for', async () => {
    const session = new BtcSigningSession(psbtWithSighashTypes([0x01]));
    // Past the constructor, bitcoinjs is the last gate.
    (session as any).psbt.data.inputs[0].sighashType = 0x02;

    await expect(session.signWithKeycard(cmdSet)).rejects.toThrow(
      'Sighash type is not allowed',
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
