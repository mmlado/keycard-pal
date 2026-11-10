import { useSyncExternalStore } from 'react';

import {
  getCustomTokens,
  subscribeCustomTokens,
  type CustomToken,
} from '@/utils/customTokens';

export function useCustomTokens(): readonly CustomToken[] {
  return useSyncExternalStore(subscribeCustomTokens, getCustomTokens);
}
