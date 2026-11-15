import { useEffect, useSyncExternalStore } from 'react';

import { usePreferences } from '@/hooks/usePreferences';
import {
  clearUnverifiedCardApproval,
  isUnverifiedCardApprovalPending,
  subscribeUnverifiedCardApproval,
} from '@/utils/unverifiedCardApproval';

/** A kept approval of an unverified card shows the developer card options, unless the user chose. */
export function useDeveloperCardOptionsAutoOn(): void {
  const { preferences, setPreference } = usePreferences();
  const pending = useSyncExternalStore(
    subscribeUnverifiedCardApproval,
    isUnverifiedCardApprovalPending,
  );
  const choice = preferences.developerCardOptions;

  useEffect(() => {
    if (!pending) {
      return;
    }
    clearUnverifiedCardApproval();
    if (choice === 'unset') {
      setPreference('developerCardOptions', 'shown');
    }
  }, [pending, choice, setPreference]);
}
