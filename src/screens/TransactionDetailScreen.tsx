import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../assets/icons';
import type { TransactionDetailScreenProps } from '../navigation/types';
import theme from '../theme';

import SignRequestDetail from '../components/SignRequestDetail';
import PrimaryButton from '../components/PrimaryButton';
import { useWalletConnectSession } from '../hooks/useWalletConnectSession.online';
import { inspectBtcPsbt } from '../utils/btcPsbt';
import { buildSignKeycardParams } from '../utils/signNavigation';

export default function TransactionDetailScreen({
  route,
  navigation,
}: TransactionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { result, wcContext } = route.params;
  const { respondError } = useWalletConnectSession();

  const respondedRef = useRef(false);
  const navigatingToKeycardRef = useRef(false);

  const isBip322Message =
    result.kind === 'crypto-psbt' &&
    (() => {
      try {
        return (
          inspectBtcPsbt(result.request.psbtHex).requestType ===
          'bip322-message'
        );
      } catch {
        return false;
      }
    })();

  const keycardParams = buildSignKeycardParams(result);

  const rejectWC = useCallback(async () => {
    if (wcContext && !respondedRef.current) {
      respondedRef.current = true;
      try {
        await respondError(wcContext, 4001, 'User rejected');
      } catch {
        // ignore — relay may have already expired
      }
    }
  }, [wcContext, respondError]);

  // Reject WC request on back/swipe unless we navigated forward to Keycard
  useEffect(() => {
    if (!wcContext) return;
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!navigatingToKeycardRef.current) {
        rejectWC();
      }
    });
    return unsubscribe;
  }, [navigation, wcContext, rejectWC]);

  const handleSign = useCallback(() => {
    if (!keycardParams) return;
    navigatingToKeycardRef.current = true;
    navigation.navigate('Keycard', {
      ...keycardParams,
      ...(wcContext ? { wcContext } : {}),
    } as any);
  }, [keycardParams, navigation, wcContext]);

  const handleReject = useCallback(async () => {
    await rejectWC();
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [rejectWC, navigation]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <SignRequestDetail result={result} />
      </ScrollView>

      {keycardParams !== null && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          {wcContext && (
            <Button
              mode="outlined"
              onPress={handleReject}
              textColor={theme.colors.error}
            >
              Reject
            </Button>
          )}
          <PrimaryButton
            label={
              isBip322Message || result.kind === 'btc-sign-request'
                ? 'Sign message'
                : 'Sign transaction'
            }
            onPress={handleSign}
            icon={Icons.nfcActivate}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 24,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
    gap: 8,
  },
});
