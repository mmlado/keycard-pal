import React from 'react';
import MaterialDesignIcons, {
  type MaterialDesignIconsIconName,
} from '@react-native-vector-icons/material-design-icons';

import theme from '../../theme';

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

// Keys are semantic (what the icon stands for in the app), not glyph names,
// so a glyph can be swapped without touching every call site.
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

  // Dashboard tiles. Addresses gets its own glyph rather than the static
  // qr.svg, whose hardcoded white fill ignores the tint a tile applies.
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

  // Key pair menu. The phrase icons mark length; the label says whether a
  // passphrase is added, so the 12- and 24-word pairs share their glyph.
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

  // Coins: the currency mark rather than the brand logo, so every place a coin
  // is named (Addresses, wallet export, donation rows) reads as one set.
  ethereum: mdi('currency-eth', onSurface),
  bitcoin: mdi('currency-btc', onSurface),

  // Export target that spans both chains and so has no single currency mark
  wallet: mdi('wallet-outline', onSurface),

  // Layout picker: two squares side by side vs two stacked rows.
  // Custom SVGs because MDI has the stacked pair but no two-squares glyph.
  layoutTiles: LayoutTilesIcon,
  layoutList: LayoutListIcon,
};
