import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';

const REST_GAP = 16;
const KEYBOARD_GAP = 24;

export default function BottomActionArea({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const overlap = useKeyboardOverlap();
  return (
    <View
      testID={testID}
      style={[
        style,
        {
          paddingBottom: Math.max(
            insets.bottom + REST_GAP,
            overlap + KEYBOARD_GAP,
          ),
        },
      ]}
    >
      {children}
    </View>
  );
}
