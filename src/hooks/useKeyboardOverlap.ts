import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onKeyboardFrame } from '@/utils/keyboardFrame';

/** How far the keyboard covers the screen from its bottom edge; 0 while it is down. */
export function useKeyboardOverlap(): number {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  useEffect(() => onKeyboardFrame(frame => setHeight(frame?.height ?? 0)), []);

  // Android reports the height with the navigation bar inset already taken off.
  return height > 0 && Platform.OS === 'android'
    ? height + insets.bottom
    : height;
}
