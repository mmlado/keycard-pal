import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import { navigationRef } from '@/navigation/navigationRef';
import theme from '@/theme';

import type { TokenPlace } from '@/utils/eip7730/format';

export const ADD_TOKEN_LABEL = 'Add token';

// Through the ref: review rows render without a navigator in tests.
function addToken({ chainId, address }: TokenPlace) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('CustomToken', { mode: 'add', chainId, address });
  }
}

/** A token contract row with the button that adds it to the user's list beside it. */
export default function WithAddToken({
  place,
  children,
}: {
  place: TokenPlace | undefined;
  children: ReactNode;
}) {
  if (!place) return <>{children}</>;
  return (
    <View style={styles.row}>
      <View style={styles.content}>{children}</View>
      <Pressable
        style={styles.button}
        onPress={() => addToken(place)}
        accessibilityRole="button"
        accessibilityLabel={ADD_TOKEN_LABEL}
        hitSlop={8}
        testID="add-token"
      >
        <Icons.addToken width={18} height={18} color={theme.colors.primary} />
        <Text variant="labelMedium" style={styles.label}>
          {ADD_TOKEN_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  label: {
    color: theme.colors.primary,
  },
});
