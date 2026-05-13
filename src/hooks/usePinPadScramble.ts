import { useEffect, useState } from 'react';

import {
  loadBooleanPreference,
  preferenceKeys,
} from '../storage/preferencesStorage';

export function usePinPadScramble(): boolean {
  const [scramble, setScramble] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadBooleanPreference(preferenceKeys.pinPadScramble)
      .then(value => { if (mounted) setScramble(value); })
      .catch(() => { if (mounted) setScramble(false); });
    return () => { mounted = false; };
  }, []);

  return scramble;
}
