import { NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { IconComponent } from '../assets/icons';
import type { WCContext } from '../constants/walletConnect';
import type { ScanResult } from '../types';
import type { ExportTargetId } from '../utils/exportTargets';

export type KeycardParams =
  | {
      operation: 'sign';
      signMode: 'eth';
      signData: string; // hex-encoded bytes to sign
      derivationPath: string;
      chainId?: number;
      requestId?: string;
      dataType?: number;
      wcContext?: WCContext;
    }
  | {
      operation: 'sign';
      signMode: 'btc';
      psbtHex: string;
    }
  | {
      operation: 'sign';
      signMode: 'btc-message';
      requestId: string;
      signDataHex: string;
      derivationPath: string;
      address?: string;
      origin?: string;
    }
  | {
      operation: 'export_key';
      target: ExportTargetId;
    };
// Future: | { operation: 'change_pin' } | { operation: 'generate_key' }

export type SecretType = 'pin' | 'puk' | 'pairing';

export type RootStackParamList = {
  Welcome: undefined;
  Dashboard: { toast?: string } | undefined;
  WalletConnectPairing: { uri: string };
  KeycardMenu: undefined;
  SetCardName: undefined;
  InitCard: undefined;
  SecretsMenu: undefined;
  ChangeSecret: { secretType: SecretType };
  QRScanner: undefined;
  TransactionDetail: { result: ScanResult; wcContext?: WCContext };
  Keycard: KeycardParams;
  ExportKey: undefined;
  KeyPairMenu: undefined;
  KeySize: undefined;
  GenerateKey: { size: 12 | 24; passphrase?: boolean };
  ConfirmKey: { words: string[]; passphrase?: string };
  Mnemonic: { mode?: 'import' | 'verify' } | undefined;
  Slip39: { mode: 'generate' | 'import' | 'verify' };
  FactoryReset: undefined;
  PairingSlots: undefined;
  AddressMenu: undefined;
  AddressList: { coin: 'btc' | 'eth' };
  AddressDetail: { address: string; derivationPath?: string; title?: string };
  QRResult: {
    urString: string; // fully encoded UR string, ready for QR display
    title: string;
    description?: string; // explanatory copy rendered above the QR code
  };
  About: undefined;
  LicenseDetail: {
    packageName: string;
    licenseType: string;
  };
  UrlQR: {
    url: string;
    title?: string;
    /** Shown under the URL. Carries the affiliate disclosure when the QR is
     *  the affiliate link, which is the whole commercial surface offline, and
     *  nothing on a build whose link earns no commission. */
    note?: string;
  };
  Settings: undefined;
};

export type WelcomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Welcome'
>;

export type DashboardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Dashboard'
>;

export type InitCardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'InitCard'
>;

export type KeycardMenuScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'KeycardMenu'
>;

export type SetCardNameScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SetCardName'
>;

export type QRScannerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'QRScanner'
>;

export type TransactionDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'TransactionDetail'
>;

export type KeycardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Keycard'
>;

export type QRResultScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'QRResult'
>;

export type ExportKeyScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ExportKey'
>;

export type MnemonicScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Mnemonic'
>;

export type Slip39ScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Slip39'
>;

export type FactoryResetSreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FactoryReset'
>;

export type PairingSlotsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PairingSlots'
>;

export type KeyPairMenuScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'KeyPairMenu'
>;

export type KeySizeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'KeySize'
>;

export type ConfirmKeySreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ConfirmKey'
>;

export type GenerateKeyScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'GenerateKey'
>;

export type AddressMenuScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AddressMenu'
>;

export type AddressListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AddressList'
>;

export type AddressDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AddressDetail'
>;

export type SecretsMenuScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SecretsMenu'
>;

export type ChangeSecretScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChangeSecret'
>;

export type AboutScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'About'
>;

export type LicenseDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'LicenseDetail'
>;

export type UrlQRScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'UrlQR'
>;

export type SettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Settings'
>;

export type WalletConnectPairingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'WalletConnectPairing'
>;

export type DashboardAction = {
  label: string;
  /** Shown only when the entry renders as the full-width hero tile. */
  detail?: string;
  icon: IconComponent;
  navigate: (navigation: NavigationProp<RootStackParamList>) => void;
};
