import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import { APP_NAME } from '@/constants/app';
import { BUY_KEYCARD_LABEL } from '@/constants/purchaseLink';
import theme from '@/theme';

import PrimaryButton from './PrimaryButton';

import { useBuyKeycard } from '@/hooks/useBuyKeycard';

export type WelcomeActionsProps = {
  onGetStarted: () => void;
};

// One primary button only: a second one pointing at a shop reads as an offer
// rather than a prerequisite.
export default function WelcomeActions({ onGetStarted }: WelcomeActionsProps) {
  // Not lifted to the screen: that would put the purchase link in a file the
  // coverage guard would then need an allowlist entry for.
  const { buyKeycard, opensInBrowser } = useBuyKeycard();

  const LinkIcon = opensInBrowser ? Icons.openInBrowser : Icons.qr;

  return (
    <View style={styles.actions}>
      <PrimaryButton
        label="Get started"
        onPress={onGetStarted}
        testID="welcome-get-started"
      />

      <Text style={styles.requirement}>
        {APP_NAME} needs a Keycard to work.
      </Text>

      <Pressable
        style={styles.link}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={BUY_KEYCARD_LABEL}
        onPress={buyKeycard}
        testID="welcome-buy-keycard"
      >
        <Text style={styles.linkText}>{BUY_KEYCARD_LABEL}</Text>
        <LinkIcon width={16} height={16} color={theme.colors.onSurfaceMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
    gap: 8,
  },
  requirement: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  linkText: {
    color: theme.colors.onSurface,
    fontSize: 14,
    lineHeight: 20,
  },
});
