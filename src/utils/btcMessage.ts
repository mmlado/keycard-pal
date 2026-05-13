import {
  CryptoKeypath,
  DataItem,
  RegistryTypes,
  decodeToDataItem,
  encodeDataItem,
} from '@keystonehq/bc-ur-registry';
import { UR, UREncoder } from '@ngraveio/bc-ur';
import { sha256 } from '@noble/hashes/sha2.js';
import Keycard from 'keycard-sdk';

import { parseDerSignature } from './keycardTlv';

const BTC_MESSAGE_SIGNATURE_TYPE = 'btc-signature';
const BTC_SIGN_REQUEST_UUID_TAG = RegistryTypes.UUID.getTag();
const BTC_SIGN_REQUEST_KEYPATH_TAG = RegistryTypes.CRYPTO_KEYPATH.getTag();
const BTC_MESSAGE_DATA_TYPE = 1;
const BTC_MESSAGE_SIGNATURE_HEADER = 27 + 4;

enum BtcSignRequestKeys {
  requestId = 1,
  signData = 2,
  dataType = 3,
  derivationPaths = 4,
  addresses = 5,
  origin = 6,
}

enum BtcSignatureKeys {
  requestId = 1,
  signature = 2,
  publicKey = 3,
}

export type BtcSignRequest = {
  requestId: string;
  signDataHex: string;
  dataType: number;
  derivationPath: string;
  address?: string;
  origin?: string;
};

function formatRequestId(requestId: DataItem | Buffer | string): string {
  if (requestId instanceof DataItem) {
    return Buffer.from(requestId.getData()).toString('hex');
  }

  if (Buffer.isBuffer(requestId)) {
    return requestId.toString('hex');
  }

  return String(requestId);
}

function encodeCompactSize(length: number): Buffer {
  if (length < 253) {
    return Buffer.from([length]);
  }

  if (length <= 0xffff) {
    const out = Buffer.alloc(3);
    out[0] = 0xfd;
    out.writeUInt16LE(length, 1);
    return out;
  }

  if (length <= 0xffffffff) {
    const out = Buffer.alloc(5);
    out[0] = 0xfe;
    out.writeUInt32LE(length, 1);
    return out;
  }

  throw new Error('Bitcoin message too long.');
}

function decodeUtf8Message(bytes: Buffer): string | undefined {
  const text = bytes.toString('utf8');
  if (Buffer.from(text, 'utf8').equals(bytes)) {
    return text;
  }

  return undefined;
}

export function parseBtcSignRequest(cbor: Buffer): BtcSignRequest {
  const map = decodeToDataItem(cbor).getData() as Record<number, any>;
  const requestId = map[BtcSignRequestKeys.requestId];
  const signData = map[BtcSignRequestKeys.signData];
  const dataType = map[BtcSignRequestKeys.dataType];
  const derivationPaths = map[BtcSignRequestKeys.derivationPaths] as
    | DataItem[]
    | undefined;
  const addresses = map[BtcSignRequestKeys.addresses] as string[] | undefined;
  const origin = map[BtcSignRequestKeys.origin] as string | undefined;

  if (!requestId || !Buffer.isBuffer(signData) || !derivationPaths?.[0]) {
    throw new Error('Malformed btc-sign-request payload.');
  }

  if (derivationPaths[0].getTag() !== BTC_SIGN_REQUEST_KEYPATH_TAG) {
    throw new Error('Malformed btc-sign-request derivation path.');
  }

  const derivationPath = CryptoKeypath.fromDataItem(
    derivationPaths[0],
  ).getPath();
  if (!derivationPath) {
    throw new Error('Missing btc-sign-request derivation path.');
  }

  const normalizedDataType = Number(dataType ?? BTC_MESSAGE_DATA_TYPE);
  if (normalizedDataType !== BTC_MESSAGE_DATA_TYPE) {
    throw new Error('Unsupported btc-sign-request data type.');
  }

  return {
    requestId: formatRequestId(requestId),
    signDataHex: signData.toString('hex'),
    dataType: normalizedDataType,
    derivationPath: `m/${derivationPath}`,
    address: addresses?.[0],
    origin,
  };
}

export function inspectBtcSignRequest(request: BtcSignRequest): {
  message: string;
  isUtf8: boolean;
} {
  const bytes = Buffer.from(request.signDataHex, 'hex');
  const utf8 = decodeUtf8Message(bytes);

  return {
    message: utf8 ?? request.signDataHex,
    isUtf8: utf8 !== undefined,
  };
}

export function hashBitcoinMessage(messageHex: string): Uint8Array {
  const message = Buffer.from(messageHex, 'hex');
  const payload = Buffer.concat([
    Buffer.from('\x18Bitcoin Signed Message:\n', 'binary'),
    encodeCompactSize(message.length),
    message,
  ]);

  return sha256(sha256(payload));
}

export function parseKeycardBtcMessageSignature(
  hash: Uint8Array,
  data: Uint8Array,
): {
  signature: Buffer;
  publicKey: Buffer;
} {
  const recoverable = new Keycard.RecoverableSignature({
    hash,
    tlvData: data,
  });
  const { publicKey, r, s } = parseDerSignature(data);

  return {
    signature: Buffer.concat([
      Buffer.from([BTC_MESSAGE_SIGNATURE_HEADER + (recoverable.recId ?? 0)]),
      Buffer.from(r),
      Buffer.from(s),
    ]),
    publicKey,
  };
}

export function buildBtcSignatureUR(args: {
  requestId: string;
  signature: Buffer;
  publicKey: Buffer;
}): string {
  const cbor = encodeDataItem(
    new DataItem({
      [BtcSignatureKeys.requestId]: new DataItem(
        Buffer.from(args.requestId, 'hex'),
        BTC_SIGN_REQUEST_UUID_TAG,
      ),
      [BtcSignatureKeys.signature]: args.signature,
      [BtcSignatureKeys.publicKey]: args.publicKey,
    }),
  );

  return new UREncoder(
    new UR(cbor, BTC_MESSAGE_SIGNATURE_TYPE),
    Math.max(cbor.length, 100),
  ).nextPart();
}
