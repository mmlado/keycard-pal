import {
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
  PURCHASE_QR_NOTE,
} from '@/constants/purchaseLink';

import { useExternalLink } from '@/hooks/useExternalLink';

/**
 * The one buy-a-Keycard action, shared by every surface that offers it.
 *
 * Which URL, and whether the QR screen carries a disclosure at all, belongs
 * to `constants/purchaseLink` and its `.ios` twin. Nothing here asks what
 * platform it is on: offline that screen is the whole placement, and a caller
 * cannot be trusted to remember the label, so the route carries it.
 */
export function useBuyKeycard(): {
  buyKeycard: () => Promise<void>;
  opensInBrowser: boolean;
} {
  const { open, opensInBrowser } = useExternalLink({
    url: KEYCARD_PURCHASE_URL,
    title: BUY_KEYCARD_LABEL,
    note: PURCHASE_QR_NOTE,
  });

  return { buyKeycard: open, opensInBrowser };
}
