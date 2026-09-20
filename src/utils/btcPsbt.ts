/* eslint-disable no-bitwise */
import { CryptoPSBT } from '@keystonehq/bc-ur-registry';
import {
  Psbt,
  Transaction,
  address,
  networks,
  payments,
  script as bscript,
} from 'bitcoinjs-lib';
import Keycard from 'keycard-sdk';
import type { Commandset } from 'keycard-sdk/dist/commandset';

import { pubKeyFingerprint } from './cryptoAccount';
import { TLV_KEY_TEMPLATE, TLV_PUB_KEY, parseDerSignature } from './keycardTlv';
import { encodeToUR } from './ur';

type NetworkName = 'mainnet' | 'testnet' | 'unknown';

export type BtcPsbtOutputSummary = {
  address: string;
  valueSats: number;
  // The PSBT's own claim that this output comes back to the wallet, kept
  // only when the key it names is a key the output can be spent with.
  // Nothing on this side of the QR code can confirm whose key that is;
  // the tapped card does, before any input is signed.
  claimsChange: boolean;
};

export type BtcPsbtSummary = {
  requestType: 'transaction' | 'bip322-message';
  network: NetworkName;
  inputCount: number;
  outputCount: number;
  outputs: BtcPsbtOutputSummary[];
  feeSats?: number;
  totalOutputSats: number;
  bip322Address?: string;
};

type KeycardSignature = {
  signature: Buffer;
  publicKey: Buffer;
};

type SignableInput = {
  index: number;
  path: string;
  pubkey: Buffer;
};

type PsbtOutput = Psbt['data']['outputs'][number];

type Bip32Derivation = NonNullable<PsbtOutput['bip32Derivation']>[number];

// One output the PSBT marks as its own, with the derivation entries that
// survived the local check. Carries the address so a refusal can name the
// output the user saw on the review, not just its position.
type ChangeClaim = {
  index: number;
  address: string;
  derivations: Bip32Derivation[];
};

// Only a SIGHASH_ALL signature commits to the outputs the review showed. A
// constant, never the PSBT's own claim. SIGHASH_DEFAULT joins it with #35.
const SIGNABLE_SIGHASH_TYPES = [Transaction.SIGHASH_ALL];

const SIGHASH_BASE_NAMES: Record<number, string> = {
  [Transaction.SIGHASH_DEFAULT]: 'SIGHASH_DEFAULT',
  [Transaction.SIGHASH_ALL]: 'SIGHASH_ALL',
  [Transaction.SIGHASH_NONE]: 'SIGHASH_NONE',
  [Transaction.SIGHASH_SINGLE]: 'SIGHASH_SINGLE',
};

// SIGHASH_ALL and SIGHASH_DEFAULT have no entry: neither leaves an output loose.
const SIGHASH_BASE_RISKS: Record<number, string> = {
  [Transaction.SIGHASH_NONE]: 'leaves every output free to change',
  [Transaction.SIGHASH_SINGLE]: 'leaves every output but one free to change',
};

// Apart from a parse failure, so the scan can say why instead of blaming bytes.
export class BtcPsbtRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BtcPsbtRefusedError';
  }
}

function toPsbt(psbtHex: string): Psbt {
  return Psbt.fromBuffer(Buffer.from(psbtHex, 'hex'));
}

function describeSighashType(sighashType: number): string {
  const name =
    SIGHASH_BASE_NAMES[sighashType & ~Transaction.SIGHASH_ANYONECANPAY];
  if (name === undefined) {
    return `sighash type 0x${sighashType.toString(16)}`;
  }

  return (sighashType & Transaction.SIGHASH_ANYONECANPAY) !== 0
    ? `${name}|ANYONECANPAY`
    : name;
}

function describeSighashRisk(sighashType: number): string | undefined {
  const risks = [
    SIGHASH_BASE_RISKS[sighashType & ~Transaction.SIGHASH_ANYONECANPAY],
  ];

  if ((sighashType & Transaction.SIGHASH_ANYONECANPAY) !== 0) {
    risks.push('lets inputs be added or removed');
  }

  const named = risks.filter(Boolean);
  return named.length > 0 ? named.join(' and ') : undefined;
}

function assertSighashTypesAreSignable(psbt: Psbt): void {
  for (const [index, input] of psbt.data.inputs.entries()) {
    const sighashType = input.sighashType;
    if (
      sighashType === undefined ||
      SIGNABLE_SIGHASH_TYPES.includes(sighashType)
    ) {
      continue;
    }

    const risk = describeSighashRisk(sighashType);
    throw new BtcPsbtRefusedError(
      `Input ${index + 1} asks to be signed with ` +
        `${describeSighashType(sighashType)}` +
        (risk ? `, which ${risk} after you approve it` : '') +
        '. Keycard Pal signs only with SIGHASH_ALL, whose signature covers ' +
        'every input and output on the review.',
    );
  }
}

function inferNetworkFromPath(path: string | undefined): NetworkName {
  if (!path) {
    return 'unknown';
  }

  const match = path.match(/^m\/\d+'\/(\d+)'/);
  if (!match) {
    return 'unknown';
  }

  if (match[1] === '0') {
    return 'mainnet';
  }

  if (match[1] === '1') {
    return 'testnet';
  }

  return 'unknown';
}

function decodeAddress(script: Buffer, network: NetworkName): string {
  try {
    if (network === 'mainnet') {
      return address.fromOutputScript(script, networks.bitcoin);
    }

    if (network === 'testnet') {
      return address.fromOutputScript(script, networks.testnet);
    }
  } catch {}

  for (const candidate of [networks.bitcoin, networks.testnet]) {
    try {
      return address.fromOutputScript(script, candidate);
    } catch {}
  }

  return script.toString('hex');
}

function extractInputPath(
  input: Psbt['data']['inputs'][number],
): string | undefined {
  return input.bip32Derivation?.[0]?.path;
}

function inferNetwork(psbt: Psbt): NetworkName {
  return inferNetworkFromPath(
    psbt.data.inputs[0] ? extractInputPath(psbt.data.inputs[0]) : undefined,
  );
}

function getInputUtxo(
  psbt: Psbt,
  index: number,
):
  | {
      script: Buffer;
      valueSats: number;
    }
  | undefined {
  const input = psbt.data.inputs[index];
  if (!input) {
    return undefined;
  }

  if (input.witnessUtxo) {
    return {
      script: input.witnessUtxo.script,
      valueSats: input.witnessUtxo.value,
    };
  }

  if (input.nonWitnessUtxo) {
    const prevTx = Transaction.fromBuffer(input.nonWitnessUtxo).outs;
    const prevout = prevTx[psbt.txInputs[index]?.index ?? -1];
    if (!prevout) {
      return undefined;
    }

    return {
      script: prevout.script,
      valueSats: prevout.value,
    };
  }

  return undefined;
}

function isBip322MessagePsbt(psbt: Psbt): boolean {
  if (psbt.inputCount !== 1 || psbt.txOutputs.length !== 1) {
    return false;
  }

  const input = psbt.txInputs[0];
  const output = psbt.txOutputs[0];
  const utxo = getInputUtxo(psbt, 0);

  return (
    input.sequence === 0 &&
    input.index === 0 &&
    output.value === 0 &&
    output.script.length === 1 &&
    output.script[0] === 0x6a &&
    utxo?.valueSats === 0
  );
}

function scriptNamesPubkey(candidate: Buffer, pubkey: Buffer): boolean {
  const chunks = bscript.decompile(candidate);
  return (
    chunks?.some(chunk => Buffer.isBuffer(chunk) && chunk.equals(pubkey)) ??
    false
  );
}

// Whether spending this output needs the entry's key: on its own for
// single-sig, or as one of the keys the script names for multisig. An entry
// that fails this points at a key the output cannot be spent with, so it says
// nothing about whose output it is and is thrown out here, before any tap.
function outputNeedsPubkey(
  output: PsbtOutput,
  script: Buffer,
  pubkey: Buffer,
): boolean {
  try {
    const { witnessScript, redeemScript } = output;

    if (witnessScript) {
      const wsh = payments.p2wsh({ redeem: { output: witnessScript } }).output!;
      const nested =
        redeemScript !== undefined &&
        redeemScript.equals(wsh) &&
        script.equals(payments.p2sh({ redeem: { output: wsh } }).output!);

      return (
        (script.equals(wsh) || nested) &&
        scriptNamesPubkey(witnessScript, pubkey)
      );
    }

    if (redeemScript) {
      return (
        script.equals(
          payments.p2sh({ redeem: { output: redeemScript } }).output!,
        ) &&
        (redeemScript.equals(payments.p2wpkh({ pubkey }).output!) ||
          scriptNamesPubkey(redeemScript, pubkey))
      );
    }

    return (
      script.equals(payments.p2wpkh({ pubkey }).output!) ||
      script.equals(payments.p2pkh({ pubkey }).output!) ||
      script.equals(payments.p2pk({ pubkey }).output!)
    );
  } catch {
    // A key the payment builders refuse cannot be the key of any script.
    return false;
  }
}

// Taproot entries are left out whole: matching one against the output needs
// the taproot tweak, and the app does not sign Taproot inputs yet (#35). A
// Taproot output is shown as a plain output rather than on the PSBT's word.
function collectChangeClaims(psbt: Psbt, network: NetworkName): ChangeClaim[] {
  return psbt.txOutputs.flatMap((txOutput, index) => {
    const output = psbt.data.outputs[index];
    const derivations = (output?.bip32Derivation ?? []).filter(derivation =>
      outputNeedsPubkey(output, txOutput.script, derivation.pubkey),
    );

    if (derivations.length === 0) {
      return [];
    }

    return [
      {
        index,
        address: decodeAddress(txOutput.script, network),
        derivations,
      },
    ];
  });
}

function parseKeycardSignature(data: Uint8Array): KeycardSignature {
  const { publicKey, r, s } = parseDerSignature(data);
  return {
    publicKey,
    signature: Buffer.concat([Buffer.from(r), Buffer.from(s)]),
  };
}

function hasPartialSigForPubkey(
  input: Psbt['data']['inputs'][number],
  pubkey: Buffer,
): boolean {
  return (
    input.partialSig?.some(partialSig => partialSig.pubkey.equals(pubkey)) ??
    false
  );
}

async function exportPublicKey(
  cmdSet: Commandset,
  path: string,
): Promise<Uint8Array> {
  const resp = await cmdSet.exportKey(0, true, path, false);
  resp.checkOK();

  const tlv = new Keycard.BERTLV(resp.data);
  tlv.enterConstructed(TLV_KEY_TEMPLATE);
  return tlv.readPrimitive(TLV_PUB_KEY);
}

async function exportMasterFingerprint(cmdSet: Commandset): Promise<number> {
  return pubKeyFingerprint(await exportPublicKey(cmdSet, 'm'));
}

// The half of the change check that only the card can answer. The scan
// already proved the entry's key is a key of the output; what is left is
// whether that key is this card's, which is one export per change output,
// normally one. Runs before the first signature, so a forged claim costs
// the user a refusal and not a signed transaction.
async function assertChangeClaimsBelongToCard(
  psbt: Psbt,
  network: NetworkName,
  cmdSet: Commandset,
  masterFingerprint: number,
  setStatus?: (status: string) => void,
): Promise<void> {
  for (const claim of collectChangeClaims(psbt, network)) {
    const where = `Output ${claim.index + 1} (${claim.address})`;
    const mine = claim.derivations.filter(
      derivation =>
        derivation.masterFingerprint.readUInt32BE(0) === masterFingerprint,
    );

    if (mine.length === 0) {
      throw new BtcPsbtRefusedError(
        `${where} is marked as change, but every key it names belongs to ` +
          'another wallet. Money sent there does not come back to this ' +
          'Keycard.',
      );
    }

    setStatus?.(`Checking change output ${claim.index + 1}...`);

    let owned = false;
    for (const derivation of mine) {
      const exported = Buffer.from(
        Keycard.CryptoUtils.compressPublicKey(
          await exportPublicKey(cmdSet, derivation.path),
        ),
      );

      if (exported.equals(derivation.pubkey)) {
        owned = true;
        break;
      }
    }

    if (!owned) {
      throw new BtcPsbtRefusedError(
        `${where} is marked as change, but the key this Keycard holds at ` +
          `${mine[0].path} is not the key that output pays. Money sent ` +
          'there does not come back to you.',
      );
    }
  }
}

function buildSignableInputs(
  psbt: Psbt,
  masterFingerprint: number,
): SignableInput[] {
  if (psbt.data.inputs.some(input => input.tapBip32Derivation?.length)) {
    throw new Error('Taproot inputs are not supported yet.');
  }

  return psbt.data.inputs.flatMap((input, index) => {
    const derivation = input.bip32Derivation?.find(candidate => {
      return candidate.masterFingerprint.readUInt32BE(0) === masterFingerprint;
    });

    if (!derivation?.path) {
      return [];
    }

    return [
      {
        index,
        path: derivation.path,
        pubkey: derivation.pubkey,
      },
    ];
  });
}

export function parseCryptoPsbtRequest(cbor: Buffer): { psbtHex: string } {
  const request = CryptoPSBT.fromCBOR(cbor);
  return {
    psbtHex: request.getPSBT().toString('hex'),
  };
}

export function inspectBtcPsbt(psbtHex: string): BtcPsbtSummary {
  const psbt = toPsbt(psbtHex);
  assertSighashTypesAreSignable(psbt);

  const requestType = isBip322MessagePsbt(psbt)
    ? 'bip322-message'
    : 'transaction';
  const network = inferNetwork(psbt);

  const claimed = new Set(
    collectChangeClaims(psbt, network).map(claim => claim.index),
  );
  const outputs = psbt.txOutputs.map((output, index) => ({
    address: decodeAddress(output.script, network),
    valueSats: output.value,
    claimsChange: claimed.has(index),
  }));

  let feeSats: number | undefined;
  try {
    feeSats = psbt.getFee();
  } catch {}

  return {
    requestType,
    network,
    inputCount: psbt.inputCount,
    outputCount: psbt.txOutputs.length,
    outputs,
    feeSats,
    totalOutputSats: outputs.reduce((sum, output) => sum + output.valueSats, 0),
    bip322Address:
      requestType === 'bip322-message' && getInputUtxo(psbt, 0)
        ? decodeAddress(getInputUtxo(psbt, 0)!.script, network)
        : undefined,
  };
}

export class BtcSigningSession {
  private readonly psbt: Psbt;

  private readonly network: NetworkName;

  constructor(psbtHex: string) {
    this.psbt = toPsbt(psbtHex);
    // Closes the gap the allow-list leaves: bitcoinjs reads an explicit
    // SIGHASH_DEFAULT on a non-Taproot input as SIGHASH_ALL and lets it pass.
    assertSighashTypesAreSignable(this.psbt);
    this.network = inferNetwork(this.psbt);
  }

  getPsbtHex(): string {
    return this.psbt.toBuffer().toString('hex');
  }

  async signWithKeycard(
    cmdSet: Commandset,
    setStatus?: (status: string) => void,
  ): Promise<{ psbtHex: string; signedInputs: number; totalInputs: number }> {
    const masterFingerprint = await exportMasterFingerprint(cmdSet);
    const signableInputs = buildSignableInputs(this.psbt, masterFingerprint);

    if (signableInputs.length === 0) {
      throw new Error(
        'This Keycard cannot sign any inputs in this transaction.',
      );
    }

    await assertChangeClaimsBelongToCard(
      this.psbt,
      this.network,
      cmdSet,
      masterFingerprint,
      setStatus,
    );

    let signedInputs = 0;

    for (const [position, signable] of signableInputs.entries()) {
      const alreadySigned = hasPartialSigForPubkey(
        this.psbt.data.inputs[signable.index],
        signable.pubkey,
      );
      if (alreadySigned) {
        signedInputs += 1;
        continue;
      }

      setStatus?.(
        `Signing BTC input ${position + 1} of ${signableInputs.length}...`,
      );

      await this.psbt.signInputAsync(
        signable.index,
        {
          publicKey: signable.pubkey,
          sign: async hash => {
            const signResp = await cmdSet.signWithPath(
              new Uint8Array(hash),
              signable.path,
              false,
            );
            signResp.checkOK();

            const parsed = parseKeycardSignature(signResp.data);
            if (!parsed.publicKey.equals(signable.pubkey)) {
              throw new Error(
                `Connected Keycard does not match input ${signable.index + 1}.`,
              );
            }

            return parsed.signature;
          },
        },
        SIGNABLE_SIGHASH_TYPES,
      );

      signedInputs += 1;
    }

    return {
      psbtHex: this.getPsbtHex(),
      signedInputs,
      totalInputs: signableInputs.length,
    };
  }
}

export function buildCryptoPsbtUR(psbtHex: string): string {
  const psbt = new CryptoPSBT(Buffer.from(psbtHex, 'hex'));
  const cbor = psbt.toCBOR();
  const type = psbt.getRegistryType().getType();
  return encodeToUR(type, cbor);
}
