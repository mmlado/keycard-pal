import {
  CryptoCoinInfo,
  CryptoHDKey,
  CryptoMultiAccounts,
} from '@keystonehq/bc-ur-registry';
import { encodeToUR } from './ur';
import Keycard from 'keycard-sdk';

import { APP_NAME } from '@/constants/app';
import {
  derivationPathToKeypath,
  numberToFingerprintBuffer,
} from './hdKeyUtils';

/** One key of a crypto-multi-accounts export, carrying its own coin metadata. */
export type MultiAccountKey = {
  derivationPath: string;
  exportRespData: Uint8Array;
  parentFingerprint: number;
  coinType: number;
  network: number;
  source?: string;
};

export function buildCryptoMultiAccountsUR(
  masterFingerprint: number,
  keys: MultiAccountKey[],
): string {
  const hdKeys = keys.map(keyData => {
    const parsed = Keycard.BIP32KeyPair.fromTLV(keyData.exportRespData);

    return new CryptoHDKey({
      isMaster: false,
      key: Buffer.from(Keycard.CryptoUtils.compressPublicKey(parsed.publicKey)),
      chainCode: Buffer.from(parsed.chainCode),
      origin: derivationPathToKeypath(
        keyData.derivationPath,
        masterFingerprint,
      ),
      useInfo: keyData.source
        ? new CryptoCoinInfo(keyData.coinType, keyData.network)
        : undefined,
      parentFingerprint: numberToFingerprintBuffer(keyData.parentFingerprint),
      name: APP_NAME,
      note: keyData.source,
    });
  });

  const deviceId = numberToFingerprintBuffer(masterFingerprint)
    .toString('hex')
    .toUpperCase();

  const cryptoMultiAccounts = new CryptoMultiAccounts(
    numberToFingerprintBuffer(masterFingerprint),
    hdKeys,
    APP_NAME,
    deviceId,
    undefined,
  );

  const cbor = cryptoMultiAccounts.toCBOR();
  const type = cryptoMultiAccounts.getRegistryType().getType();
  return encodeToUR(type, cbor);
}
