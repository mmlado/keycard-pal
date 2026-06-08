import { useCallback, useRef, useState } from 'react';
import { Commandset } from 'keycard-sdk/dist/commandset';

import { checkGenuine } from '@/utils/genuineCheck';

export function useGenuineCheck() {
  const [showGenuineWarning, setShowGenuineWarning] = useState(false);
  const approvedNonGenuineUidsRef = useRef<Set<string>>(new Set());
  const pendingUidRef = useRef<string | null>(null);

  // Returns true if the operation should proceed, false if interrupted for user decision.
  const checkOrSkipGenuine = useCallback(
    async (
      cmdSet: Commandset,
      uid: string,
      hasExistingPairing: boolean,
      setStatus: (s: string) => void,
    ): Promise<boolean> => {
      if (hasExistingPairing || approvedNonGenuineUidsRef.current.has(uid)) {
        return true;
      }
      setStatus('Verifying card...');
      const isGenuine = await checkGenuine(cmdSet);
      if (!isGenuine) {
        console.log('[Keycard] Genuine check failed — showing warning');
        pendingUidRef.current = uid;
        setShowGenuineWarning(true);
        return false;
      }
      console.log('[Keycard] Genuine check passed');
      return true;
    },
    [],
  );

  // Approves the pending UID and calls onRestart to retry the NFC operation.
  const proceedWithNonGenuine = useCallback((onRestart: () => void) => {
    const uid = pendingUidRef.current;
    if (uid) {
      approvedNonGenuineUidsRef.current.add(uid);
      pendingUidRef.current = null;
    }
    setShowGenuineWarning(false);
    onRestart();
  }, []);

  const resetGenuineState = useCallback(() => {
    setShowGenuineWarning(false);
    pendingUidRef.current = null;
  }, []);

  return { showGenuineWarning, checkOrSkipGenuine, proceedWithNonGenuine, resetGenuineState };
}
