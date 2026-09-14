import {
  CryptoCoinInfoNetwork,
  CryptoCoinInfoType,
} from '@keystonehq/bc-ur-registry';

import { Icons, type IconComponent } from '@/assets/icons';

import {
  buildCryptoAccountUR,
  type BitcoinAccountDescriptor,
} from './cryptoAccount';
import { buildCryptoHdKeyUR } from './cryptoHdKey';
import { buildCryptoMultiAccountsUR } from './cryptoMultiAccounts';
import type {
  ExportedKey,
  ExportKeysResult,
  ExportPlanEntry,
} from './keycardExport';

// Coin type 60 for Ethereum — not exported by bc-ur-registry's CryptoCoinInfoType
const COIN_TYPE_ETHEREUM = 60;

export type ExportTargetId =
  | 'ethereum'
  | 'bitcoin'
  | 'bitcoin-multisig'
  | 'bitcoin-testnet'
  | 'bitget'
  | 'ledger-live'
  | 'ledger-legacy';

/**
 * One wallet a key can be exported to: the menu label and row icon, the exact
 * BIP32 paths to export (with the parent paths their fingerprints come from),
 * and the pure UR builder for the exported keys. Adding a wallet target is one
 * entry here — the card-session executor (exportKeysForTarget) and the Keycard
 * screen are generic.
 *
 * The plan entries drive both the export order and the build: the executor
 * embeds each entry in its ExportedKey, so per-key metadata (script type,
 * coin info, EIP-4527 source) travels with the key instead of being matched
 * up by array position.
 */
export type ExportTarget = {
  id: ExportTargetId;
  label: string;
  /** Leading icon for the row: the chain's currency mark where it has one. */
  icon: IconComponent;
  keys: readonly ExportPlanEntry[];
  buildUr: (result: ExportKeysResult) => string;
};

function ethereumTarget(
  id: ExportTargetId,
  label: string,
  source: string,
): ExportTarget {
  return {
    id,
    label,
    icon: Icons.ethereum,
    keys: [{ derivationPath: "m/44'/60'/0'", parentPath: "m/44'/60'" }],
    buildUr: ({ masterFingerprint, keys: [key] }) =>
      buildCryptoHdKeyUR(
        key.exportRespData,
        key.entry.derivationPath,
        masterFingerprint,
        key.parentFingerprint,
        source,
      ),
  };
}

type BitcoinEntry = ExportPlanEntry & {
  scriptType: BitcoinAccountDescriptor['scriptType'];
};

function bitcoinTarget(
  id: ExportTargetId,
  label: string,
  keys: readonly BitcoinEntry[],
): ExportTarget {
  return {
    id,
    label,
    icon: Icons.bitcoin,
    keys,
    buildUr: result =>
      buildCryptoAccountUR({
        masterFingerprint: result.masterFingerprint,
        // The executor exported this target's own entries, so each key
        // carries a BitcoinEntry.
        descriptors: (result.keys as ExportedKey<BitcoinEntry>[]).map(key => ({
          derivationPath: key.entry.derivationPath,
          exportRespData: key.exportRespData,
          parentFingerprint: key.parentFingerprint,
          scriptType: key.entry.scriptType,
        })),
      }),
  };
}

type BitgetEntry = ExportPlanEntry & {
  coinType: number;
  network: number;
  source?: string;
};

const BITGET_KEYS: readonly BitgetEntry[] = [
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
    source: 'account.standard',
  },
];

const BITGET_TARGET: ExportTarget = {
  id: 'bitget',
  label: 'Bitget',
  // Exports Bitcoin and Ethereum keys together, so no one currency mark fits.
  icon: Icons.wallet,
  keys: BITGET_KEYS,
  buildUr: result =>
    buildCryptoMultiAccountsUR(
      result.masterFingerprint,
      (result.keys as ExportedKey<BitgetEntry>[]).map(key => ({
        derivationPath: key.entry.derivationPath,
        exportRespData: key.exportRespData,
        parentFingerprint: key.parentFingerprint,
        coinType: key.entry.coinType,
        network: key.entry.network,
        source: key.entry.source,
      })),
    ),
};

export const EXPORT_TARGETS: readonly ExportTarget[] = [
  ethereumTarget('ethereum', 'Ethereum', 'account.standard'),
  bitcoinTarget('bitcoin', 'Bitcoin', [
    {
      derivationPath: "m/84'/0'/0'",
      parentPath: "m/84'/0'",
      scriptType: 'wpkh',
    },
    {
      derivationPath: "m/49'/0'/0'",
      parentPath: "m/49'/0'",
      scriptType: 'sh-wpkh',
    },
    {
      derivationPath: "m/44'/0'/0'",
      parentPath: "m/44'/0'",
      scriptType: 'pkh',
    },
  ]),
  bitcoinTarget('bitcoin-multisig', 'Bitcoin Multisig', [
    {
      derivationPath: "m/48'/0'/0'/2'",
      parentPath: "m/48'/0'/0'",
      scriptType: 'wsh',
    },
    {
      derivationPath: "m/48'/0'/0'/1'",
      parentPath: "m/48'/0'/0'",
      scriptType: 'sh-wsh',
    },
    { derivationPath: "m/45'", parentPath: 'm', scriptType: 'sh' },
  ]),
  bitcoinTarget('bitcoin-testnet', 'Bitcoin Testnet', [
    {
      derivationPath: "m/84'/1'/0'",
      parentPath: "m/84'/1'",
      scriptType: 'wpkh',
    },
    {
      derivationPath: "m/49'/1'/0'",
      parentPath: "m/49'/1'",
      scriptType: 'sh-wpkh',
    },
    {
      derivationPath: "m/44'/1'/0'",
      parentPath: "m/44'/1'",
      scriptType: 'pkh',
    },
  ]),
  BITGET_TARGET,
  ethereumTarget('ledger-live', 'Ledger Live', 'account.ledger_live'),
  ethereumTarget('ledger-legacy', 'Ledger Legacy', 'account.ledger_legacy'),
];

export function getExportTarget(id: ExportTargetId): ExportTarget {
  const target = EXPORT_TARGETS.find(t => t.id === id);
  if (!target) {
    throw new Error(`Unknown export target: ${id}`);
  }
  return target;
}
