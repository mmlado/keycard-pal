import { useCallback, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';

import { BUY_KEYCARD_LABEL, KEYCARD_PURCHASE_URL } from '@/constants/keycard';
import { navigationRef } from '@/navigation/navigationRef';

import {
  getNetworkConnected,
  isNetworkConnected,
  subscribeNetworkConnected,
} from '@/utils/connectivity.online';

/**
 * The one buy-a-Keycard action, shared by every surface that offers it.
 *
 * With a network connection the affiliate link opens in the browser.
 * Without one the link is shown as a QR code to scan with another device,
 * so the tap is never a dead end. The offline build's connectivity stub
 * always reports disconnected, so it never calls Linking.openURL.
 * `opensInBrowser` tracks the live network state for the matching icon.
 *
 * Navigation goes through the container ref rather than the caller's route:
 * the NFC sheet leaves its screen before this resolves, and a popped route's
 * navigation object is not a safe place to dispatch from.
 */
export function useBuyKeycard(): {
  buyKeycard: () => Promise<void>;
  opensInBrowser: boolean;
} {
  const opensInBrowser = useSyncExternalStore(
    subscribeNetworkConnected,
    getNetworkConnected,
  );

  const buyKeycard = useCallback(async () => {
    if (await isNetworkConnected()) {
      Linking.openURL(KEYCARD_PURCHASE_URL);
      return;
    }
    if (navigationRef.isReady()) {
      navigationRef.navigate('UrlQR', {
        url: KEYCARD_PURCHASE_URL,
        title: BUY_KEYCARD_LABEL,
      });
    }
  }, []);

  return { buyKeycard, opensInBrowser };
}
