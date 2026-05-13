import Keycard from 'keycard-sdk';

export const TLV_SIGNATURE_TEMPLATE = 0xa0;
export const TLV_KEY_TEMPLATE = 0xa1;
export const TLV_PUB_KEY = 0x80;
export const TLV_ECDSA_TEMPLATE = 0x30;
export const TLV_INTEGER = 0x02;
export const SCALAR_BYTES = 32;

export function derIntTo32(bytes: Uint8Array): Uint8Array {
  const stripped = bytes[0] === 0x00 ? bytes.slice(1) : bytes;
  if (stripped.length === 0 || stripped.length > SCALAR_BYTES) {
    throw new RangeError(
      `DER integer has invalid length ${stripped.length} (expected 1–${SCALAR_BYTES})`,
    );
  }
  if (stripped.length === SCALAR_BYTES) {
    return stripped;
  }
  const padded = new Uint8Array(SCALAR_BYTES);
  padded.set(stripped, SCALAR_BYTES - stripped.length);
  return padded;
}

export type ParsedDerSignature = {
  publicKey: Buffer;
  r: Uint8Array;
  s: Uint8Array;
};

export function parseDerSignature(data: Uint8Array): ParsedDerSignature {
  const tlv = new Keycard.BERTLV(data);
  tlv.enterConstructed(TLV_SIGNATURE_TEMPLATE);
  const publicKey = Buffer.from(
    Keycard.CryptoUtils.compressPublicKey(tlv.readPrimitive(TLV_PUB_KEY)),
  );
  tlv.enterConstructed(TLV_ECDSA_TEMPLATE);
  const r = derIntTo32(tlv.readPrimitive(TLV_INTEGER));
  const s = derIntTo32(tlv.readPrimitive(TLV_INTEGER));
  return { publicKey, r, s };
}
