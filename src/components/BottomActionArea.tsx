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
  const rest = insets.bottom + REST_GAP;
  return (
    <View
      testID={testID}
      style={[
        style,
        {
          paddingBottom:
            overlap > 0 ? Math.max(rest, overlap + KEYBOARD_GAP) : rest,
        },
      ]}
    >
      {children}
    </View>
  );
}
