import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KeycardScreenProps } from '@/navigation/types';
import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';

import { useKeycardOperation } from '@/hooks/keycard/useKeycardOperation';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';
import { useWalletConnectSession } from '@/hooks/useWalletConnectSession.online';

import {
  prepareKeycardFlow,
  type FlowOutcome,
  type KeycardFlowRun,
} from '@/utils/keycardFlows';

export default function KeycardScreen({
  route,
  navigation,
}: KeycardScreenProps) {
  const params = route.params;
  const insets = useSafeAreaInsets();
  const flowRef = useRef<KeycardFlowRun | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const { respondSuccess } = useWalletConnectSession();

  const keycard = useKeycardOperation<unknown>();
  const { phase, result, execute } = keycard;

  const resetToDashboard = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [navigation]);

  // A WalletConnect request left this way is rejected by the provider.
  const { sheet } = useKeycardScreen({
    keycard,
    navigation,
    title: '',
    leaveOnCancel: resetToDashboard,
    showOnDone: true,
  });

  // Heavy local work runs before NFC; a failure shows an error, not the PIN pad.
  useEffect(() => {
    try {
      const flowRun = prepareKeycardFlow(params);
      flowRef.current = flowRun;
      // Read-only on the card, so a re-tap may run it again.
      execute((cmdSet, { setStatus }) => flowRun.cardOp(cmdSet, setStatus), {
        retryOnTagLoss: true,
        successMessage: flowRun.successMessage,
      });
    } catch (e: any) {
      setFlowError(e?.message ?? 'Failed to prepare the operation.');
    }
  }, [execute, params]);

  useEffect(() => {
    if (phase !== 'done' || result == null || !flowRef.current) {
      return;
    }
    let outcome: FlowOutcome;
    try {
      outcome = flowRef.current.buildOutput(result);
    } catch (e: any) {
      setFlowError(
        `Failed to build the result: ${e?.message ?? 'unknown error'}`,
      );
      return;
    }

    if (outcome.kind === 'wc-signature') {
      // Sent at once: back on the success sheet must not turn it into a rejection.
      const answered = respondSuccess(outcome.wcContext, outcome.rawSig);
      const timer = setTimeout(() => answered.finally(resetToDashboard), 800);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (outcome.doneNavigation === 'export') {
        navigation.reset({
          index: 2,
          routes: [
            { name: 'Dashboard' },
            { name: 'ExportKey' },
            {
              name: 'QRResult',
              params: {
                urString: outcome.urString,
                title: outcome.title,
                description: outcome.description,
              },
            },
          ],
        });
        return;
      }

      navigation.reset({
        index: 1,
        routes: [
          { name: 'QRScanner' },
          {
            name: 'QRResult',
            params: { urString: outcome.urString, title: outcome.title },
          },
        ],
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [phase, result, navigation, respondSuccess, resetToDashboard]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {flowError !== null ? (
        <View style={styles.errorContainer}>
          <Text variant="titleMedium" style={styles.errorTitle}>
            Unable to prepare
          </Text>
          <Text variant="bodyMedium" style={styles.errorMessage}>
            {flowError}
          </Text>
          <View style={styles.errorAction}>
            <PrimaryButton
              label="Go back"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      ) : (
        sheet
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: theme.colors.error,
    textAlign: 'center',
  },
  errorMessage: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  errorAction: {
    marginTop: 24,
  },
});
