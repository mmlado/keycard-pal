import { useEffect, useSyncExternalStore } from 'react';

import { usePreferences } from '@/hooks/usePreferences';

import { loadApprovedCardKeys } from '@/storage/approvedCardsStorage';
import {
  clearUnverifiedCardApproval,
  isUnverifiedCardApprovalPending,
  noteUnverifiedCardApproved,
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

  // An approval kept before this switch existed counts too.
  useEffect(() => {
    if (choice !== 'unset') {
      return;
    }
    loadApprovedCardKeys()
      .then(keys => {
        if (keys.length > 0) {
          noteUnverifiedCardApproved();
        }
      })
      .catch(() => {});
  }, [choice]);

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
