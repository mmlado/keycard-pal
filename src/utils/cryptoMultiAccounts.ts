import {
  CryptoCoinInfo,
  CryptoCoinInfoNetwork,
  CryptoCoinInfoType,
  CryptoHDKey,
  CryptoMultiAccounts,
} from '@keystonehq/bc-ur-registry';
import { encodeToUR } from './ur';
import Keycard from 'keycard-sdk';
import type { Commandset } from 'keycard-sdk/dist/commandset';

import { pubKeyFingerprint } from './cryptoAccount';
import { TLV_KEY_TEMPLATE, TLV_PUB_KEY } from './keycardTlv';
import {
  derivationPathToKeypath,
  numberToFingerprintBuffer,
} from './hdKeyUtils';

// Coin type 60 for Ethereum — not exported by bc-ur-registry's CryptoCoinInfoType
const COIN_TYPE_ETHEREUM = 60;

// EIP-4527 source field — used by Bitget to distinguish account types
const EIP4527_STANDARD = 'account.standard';

type MultiAccountKey = {
  derivationPath: string;
  parentPath: string;
  coinType: number;
  network: number;
  source?: string;
};

const BITGET_KEYS: MultiAccountKey[] = [
  {
    derivationPath: "m/84'/0'/0'",
    parentPath: "m/84'/0'",
    coinType: CryptoCoinInfoType.bitcoin,
    network: CryptoCoinInfoNetwork.mainnet,
  },
  {
    derivationPath: "m/49'/0'/0'",
    parentPath: "m/49'/0'",
    coinType: CryptoCoinInfoType.bitcoin,
    network: CryptoCoinInfoNetwork.mainnet,
  },
  {
    derivationPath: "m/44'/0'/0'",
    parentPath: "m/44'/0'",
    coinType: CryptoCoinInfoType.bitcoin,
    network: CryptoCoinInfoNetwork.mainnet,
  },
  {
    derivationPath: "m/44'/60'/0'",
    parentPath: "m/44'/60'",
    coinType: COIN_TYPE_ETHEREUM,
    network: CryptoCoinInfoNetwork.mainnet,
    source: EIP4527_STANDARD,
  },
];

export type BitgetExportResult = {
  masterFingerprint: number;
  keys: {
    derivationPath: string;
    exportRespData: Uint8Array;
    parentFingerprint: number;
  }[];
};

export async function exportKeysForBitget(
  cmdSet: Commandset,
  setStatus: (s: string) => void,
): Promise<BitgetExportResult> {
  setStatus('Reading master key...');
  const rootResp = await cmdSet.exportKey(0, true, 'm', false);
  rootResp.checkOK();

  const tlv = new Keycard.BERTLV(rootResp.data);
  tlv.enterConstructed(TLV_KEY_TEMPLATE);
  const rootPubKey = tlv.readPrimitive(TLV_PUB_KEY);
  const masterFingerprint = pubKeyFingerprint(rootPubKey);

  const keys: BitgetExportResult['keys'] = [];
  for (let i = 0; i < BITGET_KEYS.length; i++) {
    const key = BITGET_KEYS[i];
    setStatus(`Exporting key ${i + 1} of ${BITGET_KEYS.length}...`);

    const parentResp = await cmdSet.exportKey(0, true, key.parentPath, false);
    parentResp.checkOK();
    const parentTlv = new Keycard.BERTLV(parentResp.data);
    parentTlv.enterConstructed(TLV_KEY_TEMPLATE);
    const parentPubKey = parentTlv.readPrimitive(TLV_PUB_KEY);
    const parentFingerprint = pubKeyFingerprint(parentPubKey);

    const resp = await cmdSet.exportExtendedKey(0, key.derivationPath, false);
    resp.checkOK();
    keys.push({
      derivationPath: key.derivationPath,
      exportRespData: resp.data,
      parentFingerprint,
    });
  }

  return { masterFingerprint, keys };
}

export function buildCryptoMultiAccountsUR(result: BitgetExportResult): string {
  const hdKeys = result.keys.map((keyData, i) => {
    const parsed = Keycard.BIP32KeyPair.fromTLV(keyData.exportRespData);
    const keySpec = BITGET_KEYS[i];

    return new CryptoHDKey({
      isMaster: false,
      key: Buffer.from(Keycard.CryptoUtils.compressPublicKey(parsed.publicKey)),
      chainCode: Buffer.from(parsed.chainCode),
      origin: derivationPathToKeypath(
        keyData.derivationPath,
        result.masterFingerprint,
      ),
      useInfo: keySpec.source
        ? new CryptoCoinInfo(keySpec.coinType, keySpec.network)
        : undefined,
      parentFingerprint: numberToFingerprintBuffer(keyData.parentFingerprint),
      name: 'GapSign',
      note: keySpec.source,
    });
  });

  const deviceId = numberToFingerprintBuffer(result.masterFingerprint)
    .toString('hex')
    .toUpperCase();

  const cryptoMultiAccounts = new CryptoMultiAccounts(
    numberToFingerprintBuffer(result.masterFingerprint),
    hdKeys,
    'GapSign',
    deviceId,
    undefined,
  );

  const cbor = cryptoMultiAccounts.toCBOR();
  const type = cryptoMultiAccounts.getRegistryType().getType();
  return encodeToUR(type, cbor);
}
