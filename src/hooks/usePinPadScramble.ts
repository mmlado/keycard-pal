import { useEffect, useState } from 'react';

import { loadPinPadScramble } from '../storage/preferencesStorage';

export function usePinPadScramble(): boolean {
  const [scramble, setScramble] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadPinPadScramble()
      .then(value => {
        if (mounted) setScramble(value);
      })
      .catch(() => {
        if (mounted) setScramble(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return scramble;
}
