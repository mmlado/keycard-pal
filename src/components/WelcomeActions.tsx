import { StyleSheet, View } from 'react-native';

import { Icons } from '@/assets/icons';
import { BUY_KEYCARD_LABEL } from '@/constants/purchaseLink';
import theme from '@/theme';

import AffiliateDisclosure from './AffiliateDisclosure';
import PrimaryButton from './PrimaryButton';

import { useBuyKeycard } from '@/hooks/useBuyKeycard';

export type WelcomeActionsProps = {
  onGetStarted: () => void;
};

export default function WelcomeActions({ onGetStarted }: WelcomeActionsProps) {
  // Not lifted to the screen: that would put the purchase link in a file the
  // coverage guard would then need an allowlist entry for.
  const { buyKeycard, opensInBrowser } = useBuyKeycard();

  return (
    <View style={styles.actions}>
      <PrimaryButton
        label={BUY_KEYCARD_LABEL}
        onPress={buyKeycard}
        icon={opensInBrowser ? Icons.openInBrowser : Icons.qr}
        testID="welcome-buy-keycard"
      />
      <AffiliateDisclosure style={styles.disclosure} />
      <PrimaryButton
        label="Get started"
        onPress={onGetStarted}
        testID="welcome-get-started"
      />
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
  disclosure: {
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
