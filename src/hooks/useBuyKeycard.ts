import {
  BUY_KEYCARD_LABEL,
  KEYCARD_PURCHASE_URL,
} from '@/constants/purchaseLink';

import { useExternalLink } from '@/hooks/useExternalLink';

export function useBuyKeycard(): {
  buyKeycard: () => Promise<void>;
  opensInBrowser: boolean;
} {
  const { open, opensInBrowser } = useExternalLink({
    url: KEYCARD_PURCHASE_URL,
    title: BUY_KEYCARD_LABEL,
  });

  return { buyKeycard: open, opensInBrowser };
}
