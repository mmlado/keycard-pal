import {
  CryptoHDKey,
  CryptoKeypath,
  PathComponent,
} from '@keystonehq/bc-ur-registry';
import { encodeToUR } from './ur';
import Keycard from 'keycard-sdk';

import {
  derivationPathToKeypath,
  numberToFingerprintBuffer,
} from './hdKeyUtils';

const LEDGER_LEGACY_SOURCE = 'account.ledger_legacy';
const CRYPTO_HDKEY_NAME = 'GapSign';

/**
 * Parse the raw Keycard exportKey TLV response, encode it as a
 * crypto-hdkey (BCR-2020-007), and return a `ur:crypto-hdkey/...` string
 * ready to display as a QR code.
 *
 * MetaMask can scan this to add the Keycard account to the wallet.
 *
 * @param exportRespData - raw bytes from `cmdSet.exportKey()` response
 * @param derivationPath - BIP32 path used, e.g. "m/44'/60'/0'"
 */
export function buildCryptoHdKeyUR(
  exportRespData: Uint8Array,
  derivationPath: string,
  sourceFingerprint: number,
  parentFingerprint: number,
  source?: string,
): string {
  const parsed = Keycard.BIP32KeyPair.fromTLV(exportRespData);

  const hdKey = new CryptoHDKey({
    isMaster: false,
    isPrivateKey: false,
    key: Buffer.from(Keycard.CryptoUtils.compressPublicKey(parsed.publicKey)),
    chainCode: Buffer.from(parsed.chainCode),
    origin: derivationPathToKeypath(derivationPath, sourceFingerprint),
    parentFingerprint: numberToFingerprintBuffer(parentFingerprint),
    name: CRYPTO_HDKEY_NAME,
    ...(source !== undefined && { note: source }),
    ...(source === LEDGER_LEGACY_SOURCE && {
      children: new CryptoKeypath([
        new PathComponent({ index: undefined, hardened: false }),
      ]),
    }),
  });

  const cbor = hdKey.toCBOR();
  const type = hdKey.getRegistryType().getType();
  return encodeToUR(type, cbor);
}
