import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import { dashboardActions } from '@/navigation/dashboardActions';
import { DashboardScreenProps } from '@/navigation/types';
import theme from '@/theme';

import EntryList from '@/components/EntryList';
import PrimaryButton from '@/components/PrimaryButton';
import UnselectedKeycardReminder from '@/components/UnselectedKeycardReminder';
import WalletConnectDashboardCard from '@/components/walletConnect/DashboardCard.online';

/** Apple's NFC sheet covers the toast for about 3.5 s after a tap (measured), so the toast outlasts it. */
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
      {/* Above the grid, not in its footer: it follows a tap the user just
          made, and below the tiles it would sit off screen on a small phone. */}
      <UnselectedKeycardReminder />
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
