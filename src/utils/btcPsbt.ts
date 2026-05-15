import { CryptoPSBT } from '@keystonehq/bc-ur-registry';
import { Psbt, Transaction, address, networks } from 'bitcoinjs-lib';
import Keycard from 'keycard-sdk';
import type { Commandset } from 'keycard-sdk/dist/commandset';

import { pubKeyFingerprint } from './cryptoAccount';
import { TLV_KEY_TEMPLATE, TLV_PUB_KEY, parseDerSignature } from './keycardTlv';
import { encodeToUR } from './ur';

type NetworkName = 'mainnet' | 'testnet' | 'unknown';

export type BtcPsbtOutputSummary = {
  address: string;
  valueSats: number;
  isChange: boolean;
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
  sighashType?: number;
};

function toPsbt(psbtHex: string): Psbt {
  return Psbt.fromBuffer(Buffer.from(psbtHex, 'hex'));
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

function isChangeOutput(output: Psbt['data']['outputs'][number]): boolean {
  return (
    (output.bip32Derivation?.length ?? 0) > 0 ||
    (output.tapBip32Derivation?.length ?? 0) > 0
  );
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

async function exportMasterFingerprint(cmdSet: Commandset): Promise<number> {
  const rootResp = await cmdSet.exportKey(0, true, 'm', false);
  rootResp.checkOK();

  const tlv = new Keycard.BERTLV(rootResp.data);
  tlv.enterConstructed(TLV_KEY_TEMPLATE);
  const pubKey = tlv.readPrimitive(TLV_PUB_KEY);
  return pubKeyFingerprint(pubKey);
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
        sighashType: input.sighashType,
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
  const requestType = isBip322MessagePsbt(psbt)
    ? 'bip322-message'
    : 'transaction';
  const network =
    inferNetworkFromPath(
      psbt.data.inputs[0] ? extractInputPath(psbt.data.inputs[0]) : undefined,
    ) ?? 'unknown';

  const outputs = psbt.txOutputs.map((output, index) => ({
    address: decodeAddress(output.script, network),
    valueSats: output.value,
    isChange: isChangeOutput(psbt.data.outputs[index]),
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

  constructor(psbtHex: string) {
    this.psbt = toPsbt(psbtHex);
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
        signable.sighashType ? [signable.sighashType] : undefined,
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
