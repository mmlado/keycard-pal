import { useCallback, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';

import { navigationRef } from '@/navigation/navigationRef';

import {
  getNetworkConnected,
  isNetworkConnected,
  subscribeNetworkConnected,
} from '@/utils/connectivity.online';

export type ExternalLink = {
  url: string;
  /** Header of the QR screen when there is no network. */
  title?: string;
  /** Shown under the URL on the QR screen. */
  note?: string;
};

/**
 * The one way the app hands a URL to the outside world: the browser with a
 * network, a QR code to scan with another device without one, so a tap is
 * never a dead end. The offline build's connectivity stub always reports
 * disconnected, so it never calls Linking.openURL.
 *
 * `opensInBrowser` tracks the live network state for the matching icon.
 *
 * Navigation goes through the container ref rather than the caller's route:
 * the NFC sheet leaves its screen before this resolves, and a popped route's
 * navigation object is not a safe place to dispatch from.
 */
export function useExternalLink(link: ExternalLink): {
  open: () => Promise<void>;
  opensInBrowser: boolean;
} {
  const { url, title, note } = link;
  const opensInBrowser = useSyncExternalStore(
    subscribeNetworkConnected,
    getNetworkConnected,
  );

  const open = useCallback(async () => {
    if (await isNetworkConnected()) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // No app answers the URL. Fall through to the QR code.
      }
    }
    if (navigationRef.isReady()) {
      navigationRef.navigate('UrlQR', { url, title, note });
    }
  }, [url, title, note]);

  return { open, opensInBrowser };
}
