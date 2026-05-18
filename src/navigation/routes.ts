import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';

import theme from '../theme';
import type { RootStackParamList } from './types';
import { onlineRoutes } from './onlineRoutes.online';

// Top-level screens
import AboutScreen from '../screens/AboutScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ExportKeyScreen from '../screens/ExportKeyScreen';
import FactoryResetScreen from '../screens/FactoryResetScreen';
import InitCardScreen from '../screens/InitCardScreen';
import KeycardMenuScreen from '../screens/KeycardMenuScreen';
import KeycardScreen from '../screens/KeycardScreen';
import LicenseDetailScreen from '../screens/LicenseDetailScreen';
import PairingSlotsScreen from '../screens/PairingSlotsScreen';
import QRResultScreen from '../screens/QRResultScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import SetCardNameScreen from '../screens/SetCardNameScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import UrlQRScreen from '../screens/UrlQRScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Address screens
import AddressDetailScreen from '../screens/address/AddressDetailScreen';
import AddressListScreen from '../screens/address/AddressListScreen';
import AddressesMenuScreen from '../screens/address/AddressMenuScreen';

// Key pair screens
import ConfirmKeyScreen from '../screens/keypair/ConfirmKeyScreen';
import GenerateKeyScreen from '../screens/keypair/GenerateKeyScreen';
import KeyPairMenuScreen from '../screens/keypair/KeyPairMenuScreen';
import KeySizeScreen from '../screens/keypair/KeySizeScreen';
import MnemonicScreen from '../screens/keypair/MnemonicScreen';
import Slip39Screen from '../screens/keypair/Slip39Screen';

// Secrets screens
import ChangeSecretScreen from '../screens/secrets/ChangeSecretScreen';
import SecretsMenuScreen from '../screens/secrets/SecretsMenuScreen';

const headerStyle = { backgroundColor: theme.colors.background };
const headerTitleStyle = { fontWeight: '600' as const };
const defaultHeaderOptions: NativeStackNavigationOptions = {
  headerShown: true,
  title: '',
  headerStyle,
  headerTintColor: theme.colors.onSurface,
  headerTitleStyle,
  headerTitleAlign: 'center',
  headerShadowVisible: false,
};

type Route = {
  name: keyof RootStackParamList;
  component: React.ComponentType<any>;
  options?: NativeStackNavigationOptions;
};

export const routes: Route[] = [
  { name: 'Dashboard', component: DashboardScreen },

  // Keycard operations
  {
    name: 'KeycardMenu',
    component: KeycardMenuScreen,
    options: { ...defaultHeaderOptions, title: 'Keycard' },
  },
  {
    name: 'InitCard',
    component: InitCardScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'SetCardName',
    component: SetCardNameScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'FactoryReset',
    component: FactoryResetScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'PairingSlots',
    component: PairingSlotsScreen,
    options: { ...defaultHeaderOptions, title: 'Pairing slots' },
  },
  {
    name: 'ExportKey',
    component: ExportKeyScreen,
    options: { ...defaultHeaderOptions, title: 'Connect software wallet' },
  },

  // Key pair flow
  {
    name: 'KeyPairMenu',
    component: KeyPairMenuScreen,
    options: { ...defaultHeaderOptions, title: 'Add keypair' },
  },
  {
    name: 'KeySize',
    component: KeySizeScreen,
    options: { ...defaultHeaderOptions, title: 'Generate BIP39 key pair' },
  },
  {
    name: 'GenerateKey',
    component: GenerateKeyScreen,
    options: { ...defaultHeaderOptions, title: 'Backup recovery phrase' },
  },
  {
    name: 'ConfirmKey',
    component: ConfirmKeyScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'Mnemonic',
    component: MnemonicScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'Slip39',
    component: Slip39Screen,
    options: defaultHeaderOptions,
  },

  // Secrets flow
  {
    name: 'SecretsMenu',
    component: SecretsMenuScreen,
    options: { ...defaultHeaderOptions, title: 'Secrets' },
  },
  {
    name: 'ChangeSecret',
    component: ChangeSecretScreen,
    options: defaultHeaderOptions,
  },

  // Address flow
  {
    name: 'AddressMenu',
    component: AddressesMenuScreen,
    options: { ...defaultHeaderOptions, title: 'Addresses' },
  },
  {
    name: 'AddressList',
    component: AddressListScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'AddressDetail',
    component: AddressDetailScreen,
    options: defaultHeaderOptions,
  },

  // QR / signing flow
  {
    name: 'QRScanner',
    component: QRScannerScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'TransactionDetail',
    component: TransactionDetailScreen,
    options: { ...defaultHeaderOptions, title: 'Review transaction' },
  },
  { name: 'Keycard', component: KeycardScreen, options: defaultHeaderOptions },
  {
    name: 'QRResult',
    component: QRResultScreen,
    options: defaultHeaderOptions,
  },

  // About
  {
    name: 'About',
    component: AboutScreen,
    options: { ...defaultHeaderOptions, title: 'About' },
  },
  {
    name: 'LicenseDetail',
    component: LicenseDetailScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'UrlQR',
    component: UrlQRScreen,
    options: defaultHeaderOptions,
  },
  {
    name: 'Settings',
    component: SettingsScreen,
    options: { ...defaultHeaderOptions, title: 'Settings' },
  },

  ...onlineRoutes,
];
