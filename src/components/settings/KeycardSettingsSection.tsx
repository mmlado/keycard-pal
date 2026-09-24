import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import { BUY_KEYCARD_LABEL } from '@/constants/purchaseLink';
import theme from '@/theme';

import AffiliateDisclosure from '@/components/AffiliateDisclosure';

import { useBuyKeycard } from '@/hooks/useBuyKeycard';

/**
 * The permanent, discoverable home of the buy-a-Keycard link (Status Legacy
 * keeps it under Settings → Keycard). Shared by both builds: the hook picks
 * browser or QR code.
 */
export default function KeycardSettingsSection() {
  const { buyKeycard, opensInBrowser } = useBuyKeycard();
  const Icon = opensInBrowser ? Icons.openInBrowser : Icons.qr;

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.row}
        onPress={buyKeycard}
        accessibilityRole="link"
        accessibilityLabel={BUY_KEYCARD_LABEL}
        testID="settings-buy-keycard"
      >
        <Text variant="bodyMedium" style={styles.label}>
          {BUY_KEYCARD_LABEL}
        </Text>
        <Icon width={20} height={20} color={theme.colors.onSurfaceMuted} />
      </Pressable>
      {/* Outside the Pressable on purpose: a disclosure is a label, and
          tapping it must not open the shop it is disclosing. */}
      <AffiliateDisclosure short />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    // Matches the height of the Switch in SettingsToggleRow.
    minHeight: 31,
  },
  label: {
    color: theme.colors.onSurface,
  },
});
