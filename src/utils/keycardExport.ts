/* eslint-disable no-bitwise */
import { keccak_256 } from '@noble/hashes/sha3.js';
import Keycard from 'keycard-sdk';
import type { Commandset } from 'keycard-sdk/dist/commandset';

import {
  buildCryptoAccountUR,
  pubKeyFingerprint,
  type BitcoinCryptoAccount,
} from './cryptoAccount';
import { buildCryptoHdKeyUR } from './cryptoHdKey';
import {
  buildCryptoMultiAccountsUR,
  exportKeysForBitget,
  type BitgetExportResult,
} from './cryptoMultiAccounts';

export type ExportKeyResult =
  | {
      exportRespData: Uint8Array;
      sourceFingerprint: number;
      parentFingerprint: number;
    }
  | BitcoinCryptoAccount
  | BitgetExportResult;

type BitcoinDescriptorPlan = {
  derivationPath: string;
  parentPath: string;
  scriptType: BitcoinCryptoAccount['descriptors'][number]['scriptType'];
};

export function prepareSignHash(
  signData: string,
  dataType: number | undefined,
): Uint8Array {
  const raw = new Uint8Array(Buffer.from(signData.replace(/^0x/i, ''), 'hex'));
  if (dataType === 1 || dataType === 4) {
    return keccak_256(raw);
  }
  if (dataType === 3) {
    // EIP-191 personal_sign: keccak256("\x19Ethereum Signed Message:\n{len}{message}")
    const prefix = `\x19Ethereum Signed Message:\n${raw.length}`;
    const prefixBytes = new TextEncoder().encode(prefix);
    const combined = new Uint8Array(prefixBytes.length + raw.length);
    combined.set(prefixBytes);
    combined.set(raw, prefixBytes.length);
    return keccak_256(combined);
  }
  return raw;
}

export function buildExportUr(
  result: ExportKeyResult,
  derivationPath: string,
  source?: string,
): string {
  if ('exportRespData' in result) {
    return buildCryptoHdKeyUR(
      result.exportRespData,
      derivationPath,
      result.sourceFingerprint,
      result.parentFingerprint,
      source,
    );
  }
  if ('keys' in result) {
    return buildCryptoMultiAccountsUR(result);
  }
  return buildCryptoAccountUR(result);
}

export async function exportKeyForWallet(
  cmdSet: Commandset,
  derivationPath: string,
  setStatus: (s: string) => void = () => {},
): Promise<ExportKeyResult> {
  if (derivationPath === 'bitget') {
    return exportKeysForBitget(cmdSet, setStatus);
  }

  if (!isBitcoinPath(derivationPath)) {
    const masterResp = await cmdSet.exportKey(0, true, 'm', false);
    masterResp.checkOK();

    const parentPath = derivationPath.split('/').slice(0, -1).join('/') || 'm';
    const parentResp = await cmdSet.exportKey(0, true, parentPath, false);
    parentResp.checkOK();

    const resp = await cmdSet.exportExtendedKey(0, derivationPath, false);
    resp.checkOK();
    return {
      exportRespData: resp.data,
      sourceFingerprint: pubKeyFingerprint(
        Keycard.BIP32KeyPair.fromTLV(masterResp.data).publicKey,
      ),
      parentFingerprint: pubKeyFingerprint(
        Keycard.BIP32KeyPair.fromTLV(parentResp.data).publicKey,
      ),
    };
  }

  const rootResp = await cmdSet.exportKey(0, true, 'm', false);
  rootResp.checkOK();
  const masterFingerprint = pubKeyFingerprint(
    Keycard.BIP32KeyPair.fromTLV(rootResp.data).publicKey,
  );

  const descriptors: BitcoinCryptoAccount['descriptors'] = [];
  for (const descriptor of bitcoinDescriptorPlan(derivationPath)) {
    const keyResp = await cmdSet.exportExtendedKey(
      0,
      descriptor.derivationPath,
      false,
    );
    keyResp.checkOK();

    const parentResp = await cmdSet.exportKey(
      0,
      true,
      descriptor.parentPath,
      false,
    );
    parentResp.checkOK();

    descriptors.push({
      derivationPath: descriptor.derivationPath,
      exportRespData: keyResp.data,
      parentFingerprint: pubKeyFingerprint(
        Keycard.BIP32KeyPair.fromTLV(parentResp.data).publicKey,
      ),
      scriptType: descriptor.scriptType,
    });
  }

  return {
    masterFingerprint,
    descriptors,
  };
}

function isBitcoinMultisigPath(path: string) {
  return /^m\/48'\/0'\/\d+'\/2'$/.test(path);
}

function isBitcoinPath(path: string) {
  return /^m\/(44'|49'|84'|48')\/(0'|1')\//.test(path);
}

function parsePath(path: string): number[] {
  const parts = path.split('/').slice(1);
  return parts.map(part => {
    const hardened = part.endsWith("'");
    const value = parseInt(hardened ? part.slice(0, -1) : part, 10);
    return hardened ? value | 0x80000000 : value;
  });
}

function formatPath(parts: number[]): string {
  return (
    'm/' +
    parts
      .map(part => {
        const hardened = (part & 0x80000000) !== 0;
        const value = part & 0x7fffffff;
        return `${value}${hardened ? "'" : ''}`;
      })
      .join('/')
  );
}

function bitcoinDescriptorPlan(path: string): BitcoinDescriptorPlan[] {
  const parts = parsePath(path);

  if (isBitcoinMultisigPath(path)) {
    const [purpose, coin, account] = parts;
    return [
      {
        derivationPath: formatPath([purpose, coin, account, 0x80000002]),
        parentPath: formatPath([purpose, coin, account]),
        scriptType: 'wsh',
      },
      {
        derivationPath: formatPath([purpose, coin, account, 0x80000001]),
        parentPath: formatPath([purpose, coin, account]),
        scriptType: 'sh-wsh',
      },
      {
        derivationPath: "m/45'",
        parentPath: 'm',
        scriptType: 'sh',
      },
    ];
  }

  const [, coin, account] = parts;
  return [
    {
      derivationPath: formatPath([0x80000054, coin, account]),
      parentPath: formatPath([0x80000054, coin]),
      scriptType: 'wpkh',
    },
    {
      derivationPath: formatPath([0x80000031, coin, account]),
      parentPath: formatPath([0x80000031, coin]),
      scriptType: 'sh-wpkh',
    },
    {
      derivationPath: formatPath([0x8000002c, coin, account]),
      parentPath: formatPath([0x8000002c, coin]),
      scriptType: 'pkh',
    },
  ];
}
