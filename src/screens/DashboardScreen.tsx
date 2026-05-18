import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../assets/icons';
import { dashboardActions } from '../navigation/dashboardActions';
import { DashboardScreenProps } from '../navigation/types';
import theme from '../theme';

import DashboardKeycardNotice from '../components/DashboardKeycardNotice';
import WalletConnectDashboardCard from '../components/walletConnect/DashboardCard.online';
import Menu from '../components/Menu';
import PrimaryButton from '../components/PrimaryButton';

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
    onPress: () => action.navigate(navigation),
  }));

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Menu entries={entries} />

      <DashboardKeycardNotice />
      <WalletConnectDashboardCard />

      <View style={styles.actions}>
        <PrimaryButton label="Scan" onPress={handleSign} icon={Icons.scan} />
      </View>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={3000}
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
