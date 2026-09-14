import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../assets/icons';
import { DashboardAction, ExportKeyScreenProps } from '../navigation/types';
import theme from '../theme';

import EntryList from '../components/EntryList';

import { XPUB_EXPLAINER } from '../constants/exportKey';
import {
  loadXpubNoticeDismissed,
  saveXpubNoticeDismissed,
} from '../storage/preferencesStorage';
import { EXPORT_TARGETS } from '../utils/exportTargets';

export const dashboardEntry: DashboardAction = {
  label: 'Connect software wallet',
  detail: 'Export a public key by QR',
  icon: Icons.connectWallet,
  navigate: nav => nav.navigate('ExportKey'),
};

export default function ExportKeyScreen({ navigation }: ExportKeyScreenProps) {
  const insets = useSafeAreaInsets();
  const [noticeVisible, setNoticeVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadXpubNoticeDismissed()
      .then(dismissed => {
        if (isMounted) setNoticeVisible(!dismissed);
      })
      .catch(() => {
        if (isMounted) setNoticeVisible(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismissNotice = useCallback(() => {
    setNoticeVisible(false);
    saveXpubNoticeDismissed(true).catch(() => {});
  }, []);

  const entries = EXPORT_TARGETS.map(target => ({
    label: target.label,
    icon: target.icon,
    requiresNfc: true,
    onPress: () =>
      navigation.navigate('Keycard', {
        operation: 'export_key',
        target: target.id,
      }),
  }));

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {noticeVisible ? (
        <View style={styles.notice}>
          <Text style={styles.description}>{XPUB_EXPLAINER}</Text>
          <Pressable
            style={styles.noticeClose}
            onPress={handleDismissNotice}
            hitSlop={8}
            testID="xpub-notice-close"
            accessibilityRole="button"
            accessibilityLabel="Close the extended public key notice"
          >
            <Icons.close
              width={18}
              height={18}
              color={theme.colors.onSurfaceMuted}
            />
          </Pressable>
        </View>
      ) : null}
      <EntryList entries={entries} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingLeft: 24,
    paddingRight: 16,
    paddingTop: 16,
  },
  description: {
    flex: 1,
    color: theme.colors.onSurfaceMuted,
    fontSize: 13,
    lineHeight: 13 * 1.45,
  },
  noticeClose: {
    paddingTop: 2,
  },
});
