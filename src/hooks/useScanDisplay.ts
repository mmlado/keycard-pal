import { useEffect } from 'react';
import { AppState } from 'react-native';

import { raiseScanDisplay, restoreScanDisplay } from '@/utils/scanDisplay';

interface FocusSource {
  isFocused(): boolean;
  addListener(event: 'focus' | 'blur', listener: () => void): () => void;
}

export function useScanDisplay(
  navigation: FocusSource,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const sync = () => {
      if (navigation.isFocused() && AppState.currentState === 'active') {
        raiseScanDisplay();
      } else {
        restoreScanDisplay();
      }
    };
    sync();
    // The stack keeps the screen mounted under one pushed above it.
    const offFocus = navigation.addListener('focus', sync);
    const offBlur = navigation.addListener('blur', sync);
    // iOS brightness is system-wide, so it goes back while the app is away.
    const subscription = AppState.addEventListener('change', sync);
    return () => {
      offFocus();
      offBlur();
      subscription.remove();
      restoreScanDisplay();
    };
  }, [navigation, enabled]);
}
