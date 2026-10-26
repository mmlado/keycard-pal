import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import { Icons } from '@/assets/icons';
import BottomActionArea from '@/components/BottomActionArea';
import PrimaryButton from '@/components/PrimaryButton';

import SheetOverlay from './SheetOverlay';

type Props = {
  onCancel: () => void;
  onProceed?: () => void;
};

export default function GenuineWarning({ onCancel, onProceed }: Props) {
  return (
    <SheetOverlay testID="genuine-warning">
      <View style={styles.content}>
        <Icons.exclamation width={64} height={64} color={theme.colors.error} />
        <Text variant="headlineSmall" style={styles.title}>
          Unverified Keycard
        </Text>
        <Text variant="bodyMedium" style={styles.body}>
          This card could not be verified as an authentic Keycard. It may be
          counterfeit. Proceeding is not recommended unless you trust the
          source.
        </Text>
      </View>

      <BottomActionArea testID="genuine-warning-actions" style={styles.buttons}>
        <PrimaryButton
          testID="cancel-button"
          label="Cancel"
          onPress={onCancel}
        />
        <Pressable
          testID="proceed-button"
          style={styles.proceedButton}
          android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
          onPress={onProceed}
        >
          <Text variant="labelLarge" style={styles.proceedText}>
            Proceed Anyway
          </Text>
        </Pressable>
      </BottomActionArea>
    </SheetOverlay>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    color: theme.colors.onSurface,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttons: {
    gap: 8,
  },
  proceedButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  proceedText: {
    color: theme.colors.onSurfaceDisabled,
  },
});
