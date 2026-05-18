import { hashTypedData, isAddress } from 'viem';

import type { WCContext } from '@/constants/walletConnect';
import type { WCRequest } from '@/providers/walletConnect/context';
import type { ScanResult } from '@/types';

export type { WCContext };

function splitAddrParam(params: unknown): { address: string; other: string } {
  if (!Array.isArray(params) || params.length < 2) {
    throw new Error('Invalid params: expected array of at least 2 strings');
  }
  const [p0, p1] = params as [unknown, unknown];
  if (typeof p0 !== 'string' || typeof p1 !== 'string') {
    throw new Error('Invalid params: expected strings');
  }
  if (isAddress(p0, { strict: false })) {
    return { address: p0, other: p1 };
  }
  if (isAddress(p1, { strict: false })) {
    return { address: p1, other: p0 };
  }
  throw new Error('Invalid params: signer address missing');
}

function hexEncodeMessage(value: string): string {
  if (value.toLowerCase().startsWith('0x')) {
    return value;
  }
  const bytes = new TextEncoder().encode(value);
  let hex = '0x';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

function resolvePath(
  address: string,
  addressToPath?: Map<string, string>,
): string {
  if (!addressToPath) {
    throw new Error('Missing WalletConnect address mapping');
  }
  const resolved = addressToPath.get(address.toLowerCase());
  if (!resolved) {
    throw new Error(
      `Address ${address} not found in session — cannot determine derivation path`,
    );
  }
  return resolved;
}

function handlePersonalSign(
  req: WCRequest,
  addressToPath?: Map<string, string>,
): ScanResult {
  const { address, other: message } = splitAddrParam(req.params);
  return {
    kind: 'eth-sign-request',
    request: {
      signData: hexEncodeMessage(message),
      dataType: 3, // personal_sign — EIP-191 prefix applied in prepareSignHash
      derivationPath: resolvePath(address, addressToPath),
      address,
      origin: 'WalletConnect',
    },
  };
}

function handleTypedData(
  req: WCRequest,
  addressToPath?: Map<string, string>,
): ScanResult {
  const { address, other: typedDataJson } = splitAddrParam(req.params);

  let parsed: { domain: any; types: any; primaryType?: string; message: any };
  try {
    parsed = JSON.parse(typedDataJson);
  } catch {
    throw new Error('Invalid EIP-712 payload: JSON parse failed');
  }

  const { domain, types, primaryType, message } = parsed;
  if (!domain || !types || !message) {
    throw new Error('Invalid EIP-712 payload: missing domain/types/message');
  }

  let digest: `0x${string}`;
  try {
    // Remove EIP712Domain — the hashing library adds it internally from domain
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { EIP712Domain: _EIP712Domain, ...signingTypes } = types;
    digest = hashTypedData({
      domain,
      types: signingTypes,
      primaryType: primaryType ?? Object.keys(signingTypes)[0],
      message,
    });
  } catch {
    throw new Error('Invalid EIP-712 payload: hashing failed');
  }

  return {
    kind: 'eth-sign-request',
    request: {
      signData: digest, // 32-byte hash — dataType=0 means no further hashing
      dataType: 0,
      derivationPath: resolvePath(address, addressToPath),
      address,
      origin: 'WalletConnect',
      reviewData: hexEncodeMessage(typedDataJson),
    },
  };
}

export function wcRequestToScanResult(
  req: WCRequest,
  addressToPath?: Map<string, string>,
): ScanResult {
  const { method } = req;

  if (method === 'personal_sign') {
    return handlePersonalSign(req, addressToPath);
  }

  if (method === 'eth_signTypedData' || method === 'eth_signTypedData_v4') {
    return handleTypedData(req, addressToPath);
  }

  throw new Error(`Unsupported method: ${method}`);
}
