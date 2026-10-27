import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // Negative while the keyboard is up, and all of it: the provider treats the bars as translucent.
  const { height } = useReanimatedKeyboardAnimation();
  const rest = insets.bottom + REST_GAP;
  const padding = useAnimatedStyle(() => {
    const overlap = -height.value;
    return {
      paddingBottom:
        overlap > 0 ? Math.max(rest, overlap + KEYBOARD_GAP) : rest,
    };
  });

  return (
    <Animated.View testID={testID} style={[style, padding]}>
      {children}
    </Animated.View>
  );
}
