import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import theme from '@/theme';

export default function SheetOverlay({
  children,
  testID,
}: {
  children: ReactNode;
  testID: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      // The Modal is statusBarTranslucent, so it starts under the status bar.
      style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
  },
});
