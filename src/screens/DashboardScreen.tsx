import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../assets/icons';
import { dashboardActions } from '../navigation/dashboardActions';
import { DashboardScreenProps } from '../navigation/types';
import theme from '../theme';

import EntryList from '../components/EntryList';
import PrimaryButton from '../components/PrimaryButton';
import WalletConnectDashboardCard from '../components/walletConnect/DashboardCard.online';

/**
 * How long the confirmation toast stays up on iOS.
 *
 * A finished Keycard operation lands here while Apple's system NFC sheet still
 * covers the bottom of the screen — the same band the Snackbar uses — and that
 * sheet outlives the default 3 s. Measured on device (iPhone 11 / iOS 26.5, 3
 * rounds): the sheet cleared 3168/3575/3517 ms after the session was
 * invalidated, so a 3 s toast was gone, or nearly, before anything was visible.
 *
 * The toast is therefore shown immediately and simply outlasts the sheet — it
 * is already in place as the sheet slides away, revealed rather than animated
 * in. Gating it on AppState 'active' instead was tried and reverted: iOS posts
 * that only once the dismissal animation has finished, which left a visible
 * dead beat and then a toast that jumped up into an empty screen.
 */
const IOS_TOAST_DURATION_MS = 7000;
const TOAST_DURATION_MS = 3000;

export default function DashboardScreen({
  navigation,
  route,
}: DashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      const toast = route.params?.toast;
      if (toast) {
        setSnackMessage(toast);
        setSnackVisible(true);
        navigation.setParams({ toast: undefined });
      }
    }, [route.params?.toast, navigation]),
  );

  const handleSign = useCallback(() => {
    navigation.navigate('QRScanner');
  }, [navigation]);

  const entries = dashboardActions.map(action => ({
    label: action.label,
    detail: action.detail,
    icon: action.icon,
    onPress: () => action.navigate(navigation),
  }));

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <EntryList entries={entries} footer={<WalletConnectDashboardCard />} />

      <View style={styles.actions}>
        <PrimaryButton label="Scan" onPress={handleSign} icon={Icons.scan} />
      </View>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={
          Platform.OS === 'ios' ? IOS_TOAST_DURATION_MS : TOAST_DURATION_MS
        }
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
  },
});
