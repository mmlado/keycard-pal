import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '../assets/icons';
import { APP_NAME } from '@/constants/app';
import {
  KEYCARD_PURCHASE_COUPON_CODE,
  KEYCARD_PURCHASE_COUPON_MINIMUM,
  KEYCARD_PURCHASE_URL,
} from '../constants/keycard';
import theme from '../theme';

import PrimaryButton from './PrimaryButton';

type KeycardPurchaseCardProps = {
  buttonTestID?: string;
  closeButtonTestID?: string;
  qrButtonTestID?: string;
  onClose?: () => void;
  onShowQR?: () => void;
};

const keycardPurchaseTitle = 'Keycard required';
const keycardPurchaseDescription = `${APP_NAME} requires a Keycard hardware wallet to initialize, export keys, view addresses, and sign with NFC. Keycard is an open-source, PIN-protected JavaCard applet that stores keys securely in hardware.`;

export default function KeycardPurchaseCard({
  buttonTestID,
  closeButtonTestID,
  qrButtonTestID,
  onClose,
  onShowQR,
}: KeycardPurchaseCardProps) {
  const handlePressPurchase = useCallback(() => {
    Linking.openURL(KEYCARD_PURCHASE_URL);
  }, []);

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

      {KEYCARD_PURCHASE_COUPON_CODE ? (
        <Text style={styles.coupon}>
          Use code {KEYCARD_PURCHASE_COUPON_CODE} on purchases over{' '}
          {KEYCARD_PURCHASE_COUPON_MINIMUM}.
        </Text>
      ) : null}

      <View style={styles.button}>
        <PrimaryButton
          label="Buy a Keycard"
          onPress={handlePressPurchase}
          icon={Icons.openInBrowser}
          testID={buttonTestID}
        />
        {onShowQR ? (
          <Pressable
            style={styles.qrIconButton}
            onPress={onShowQR}
            testID={qrButtonTestID}
          >
            <Icons.qr
              width={22}
              height={22}
              color={theme.colors.onSurfaceMuted}
            />
          </Pressable>
        ) : null}
      </View>
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
  coupon: {
    color: theme.colors.primary,
    fontFamily: 'Inter_18pt-SemiBold',
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
  qrIconButton: {
    padding: 8,
  },
});
