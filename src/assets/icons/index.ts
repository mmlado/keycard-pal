import React from 'react';
import MaterialDesignIcons, {
  type MaterialDesignIconsIconName,
} from '@react-native-vector-icons/material-design-icons';

import theme from '@/theme';

import KeycardPalIcon from './keycard-pal.svg';
import LayoutListIcon from './layout-list.svg';
import LayoutTilesIcon from './layout-tiles.svg';
import NfcDefault from './nfc/default.svg';
import NfcActivate from './nfc_activate.svg';
import QrIcon from './qr.svg';
import ScanIcon from './scan.svg';

export type IconProps = {
  width?: number;
  height?: number;
  color?: string;
  testID?: string;
};

export type IconComponent = React.ComponentType<IconProps>;

function mdi(name: MaterialDesignIconsIconName, defaultColor: string) {
  return function MdiIcon({
    width = 24,
    color = defaultColor,
    testID,
  }: IconProps) {
    return React.createElement(MaterialDesignIcons, {
      name,
      size: width,
      color,
      testID,
    });
  };
}

const onSurface = theme.colors.onSurface;

// Keys say what the icon stands for, so a glyph can be swapped without touching call sites.
export const Icons = {
  scan: ScanIcon,
  keycardPal: KeycardPalIcon,
  arrowLeft: mdi('arrow-left', onSurface),
  backspace: mdi('backspace-outline', onSurface),
  chevronRight: mdi('chevron-right', onSurface),
  close: mdi('close', onSurface),
  copy: mdi('content-copy', onSurface),
  openInBrowser: mdi('open-in-new', onSurface),
  qr: QrIcon,
  nfcActivate: NfcActivate,
  checkmark: mdi('check', theme.colors.secondary),
  exclamation: mdi('alert-circle', theme.colors.errorDark),
  nfc: {
    default: NfcDefault,
    success: mdi('check-circle-outline', theme.colors.secondary),
    failure: mdi('close-circle-outline', theme.colors.error),
  },

  // Dashboard tiles. qr.svg has a hardcoded fill, so Addresses gets its own glyph.
  connectWallet: mdi('link-variant', onSurface),
  addresses: mdi('qrcode', onSurface),
  keycard: mdi('credit-card-chip-outline', onSurface),
  settings: mdi('cog-outline', onSurface),
  info: mdi('information-outline', onSurface),

  // Keycard menu
  cardInit: mdi('credit-card-plus-outline', onSurface),
  key: mdi('key-outline', onSurface),
  cardName: mdi('tag-outline', onSurface),
  secrets: mdi('shield-lock-outline', onSurface),
  pairingSlots: mdi('cellphone-link', onSurface),
  factoryReset: mdi('restore', onSurface),

  // Key pair menu. The phrase icons mark length only.
  phraseShort: mdi('text-short', onSurface),
  phraseLong: mdi('text-long', onSurface),
  keyGenerate: mdi('key-plus', onSurface),
  keyImport: mdi('import', onSurface),
  keyVerify: mdi('check-decagram-outline', onSurface),
  sharesGenerate: mdi('call-split', onSurface),
  sharesImport: mdi('call-merge', onSurface),
  sharesVerify: mdi('checkbox-multiple-marked-outline', onSurface),

  // Secrets menu
  pin: mdi('dialpad', onSurface),
  puk: mdi('lock-reset', onSurface),
  pairingSecret: mdi('handshake-outline', onSurface),

  // Coins use the currency mark, not the brand logo.
  ethereum: mdi('currency-eth', onSurface),
  bitcoin: mdi('currency-btc', onSurface),

  // Export target that spans both chains and so has no single currency mark
  wallet: mdi('wallet-outline', onSurface),

  // Settings: a choice of several, where every other row is a single switch.
  checkboxOn: mdi('checkbox-marked', onSurface),
  checkboxOff: mdi('checkbox-blank-outline', onSurface),

  // Layout picker. Custom SVGs: MDI has no two-squares glyph.
  layoutTiles: LayoutTilesIcon,
  layoutList: LayoutListIcon,
};
