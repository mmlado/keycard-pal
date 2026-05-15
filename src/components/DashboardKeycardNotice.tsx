import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import type { RootStackParamList } from '../navigation/types';
import {
  loadDashboardKeycardNoticeDismissed,
  saveDashboardKeycardNoticeDismissed,
} from '../storage/preferencesStorage';

import KeycardPurchaseCard from './KeycardPurchaseCard';

import { KEYCARD_PURCHASE_URL } from '../constants/keycard';

export default function DashboardKeycardNotice() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [visible, setVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadDashboardKeycardNoticeDismissed()
      .then(dismissed => {
        if (isMounted) setVisible(!dismissed);
      })
      .catch(() => {
        if (isMounted) setVisible(false);
      })
      .finally(() => {
        if (isMounted) setIsReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    saveDashboardKeycardNoticeDismissed(true).catch(() => {});
  }, []);

  if (!isReady || !visible) {
    return null;
  }

  return (
    <View style={styles.noticeWrapper}>
      <KeycardPurchaseCard
        onClose={handleClose}
        onShowQR={() =>
          navigation.navigate('UrlQR', {
            url: KEYCARD_PURCHASE_URL,
            title: 'Buy a Keycard',
          })
        }
        buttonTestID="dashboard-keycard-purchase-link"
        closeButtonTestID="dashboard-keycard-notice-close"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  noticeWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
