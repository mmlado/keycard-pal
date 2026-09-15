import { StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';

import {
  AFFILIATE_DISCLOSURE,
  AFFILIATE_DISCLOSURE_SHORT,
} from '@/constants/keycard';
import theme from '@/theme';

type AffiliateDisclosureProps = {
  /** Compact wording for rows and sheets where the full sentence does not fit. */
  short?: boolean;
  style?: StyleProp<TextStyle>;
};

/**
 * The label that makes a Buy a Keycard placement an identified advertisement.
 *
 * Every surface rendering KEYCARD_PURCHASE_URL must show one, so this is the
 * only place the copy lives. A label, not a control: no Pressable, and never
 * behind a tap, tooltip or collapsed region, which would not count as a
 * disclosure at all.
 */
export default function AffiliateDisclosure({
  short,
  style,
}: AffiliateDisclosureProps) {
  return (
    <Text
      variant="bodySmall"
      style={[styles.text, style]}
      testID="affiliate-disclosure"
    >
      {short ? AFFILIATE_DISCLOSURE_SHORT : AFFILIATE_DISCLOSURE}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: theme.colors.onSurfaceMuted,
  },
});
