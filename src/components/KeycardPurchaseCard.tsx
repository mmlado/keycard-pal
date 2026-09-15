import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '../assets/icons';
import { APP_NAME } from '@/constants/app';
import { BUY_KEYCARD_LABEL } from '../constants/keycard';
import theme from '../theme';

import AffiliateDisclosure from './AffiliateDisclosure';
import PrimaryButton from './PrimaryButton';

import { useBuyKeycard } from '@/hooks/useBuyKeycard';

type KeycardPurchaseCardProps = {
  buttonTestID?: string;
  closeButtonTestID?: string;
  onClose?: () => void;
};

const keycardPurchaseTitle = 'Keycard required';
const keycardPurchaseDescription = `${APP_NAME} requires a Keycard hardware wallet to initialize, export keys, view addresses, and sign with NFC. Keycard is an open-source, PIN-protected JavaCard applet that stores keys securely in hardware.`;

export default function KeycardPurchaseCard({
  buttonTestID,
  closeButtonTestID,
  onClose,
}: KeycardPurchaseCardProps) {
  // Through the hook, never Linking directly. openURL fires an external
  // intent and needs no INTERNET permission of its own, so calling it here
  // sent the offline build to a browser, which is what that flavour exists
  // to avoid. The hook routes to the QR screen instead.
  const { buyKeycard, opensInBrowser } = useBuyKeycard();

  return (
    <View style={styles.card}>
      {onClose ? (
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          testID={closeButtonTestID}
        >
          <Icons.close
            width={20}
            height={20}
            color={theme.colors.onSurfaceMuted}
          />
        </Pressable>
      ) : null}

      <Text style={[styles.title, onClose && styles.dismissibleTitle]}>
        {keycardPurchaseTitle}
      </Text>
      <Text style={styles.description}>{keycardPurchaseDescription}</Text>

      <View style={styles.button}>
        <PrimaryButton
          label={BUY_KEYCARD_LABEL}
          onPress={buyKeycard}
          icon={opensInBrowser ? Icons.openInBrowser : Icons.qr}
          testID={buttonTestID}
        />
      </View>
      <AffiliateDisclosure style={styles.disclosure} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  title: {
    color: theme.colors.onSurface,
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  dismissibleTitle: {
    paddingRight: 28,
  },
  description: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  disclosure: {
    textAlign: 'center',
  },
});
