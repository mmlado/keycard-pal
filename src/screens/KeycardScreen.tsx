import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KeycardScreenProps } from '../navigation/types';
import theme from '../theme';

import NFCBottomSheet from '../components/NFCBottomSheet';
import PrimaryButton from '../components/PrimaryButton';

import { useKeycardOperation } from '../hooks/keycard/useKeycardOperation';
import { useWalletConnectSession } from '../hooks/useWalletConnectSession.online';

import { prepareKeycardFlow, type KeycardFlowRun } from '../utils/keycardFlows';

export default function KeycardScreen({
  route,
  navigation,
}: KeycardScreenProps) {
  const params = route.params;
  const insets = useSafeAreaInsets();
  const flowRef = useRef<KeycardFlowRun | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  // respondSuccess/respondError are idempotent behind the provider's
  // interface — a second call for the same request is a no-op.
  const { respondSuccess, respondError } = useWalletConnectSession();

  const wcContext =
    params.operation === 'sign' && params.signMode === 'eth'
      ? params.wcContext
      : undefined;

  const keycard = useKeycardOperation<unknown>();
  const { phase, result, execute, cancel } = keycard;

  const resetToDashboard = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [navigation]);

  // Prepare the flow (all heavy local work, before NFC) and start the card
  // operation. A prepare failure — e.g. an unparseable PSBT — becomes a
  // visible error state instead of opening the PIN pad.
  useEffect(() => {
    try {
      const flowRun = prepareKeycardFlow(params);
      flowRef.current = flowRun;
      // Signing and key export do not mutate card state: safe to re-run the
      // flow from SELECT when the card is re-tapped after a mid-operation loss.
      execute((cmdSet, { setStatus }) => flowRun.cardOp(cmdSet, setStatus), {
        retryOnTagLoss: true,
      });
    } catch (e: any) {
      setFlowError(e?.message ?? 'Failed to prepare the operation.');
    }
  }, [execute, params]);

  useEffect(() => {
    if (phase !== 'done' || result == null || !flowRef.current) {
      return;
    }
    const flowRun = flowRef.current;

    const timer = setTimeout(() => {
      let outcome;
      try {
        outcome = flowRun.buildOutput(result);
      } catch (e: any) {
        setFlowError(
          `Failed to build the result: ${e?.message ?? 'unknown error'}`,
        );
        return;
      }

      if (outcome.kind === 'wc-signature') {
        respondSuccess(wcContext!, outcome.rawSig).finally(() =>
          resetToDashboard(),
        );
        return;
      }

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
  }, [phase, result, navigation, wcContext, respondSuccess, resetToDashboard]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Enter Keycard PIN' });
  }, [navigation]);

  // The PIN pad no longer covers the navigator header, so the real back button
  // and the iOS swipe-back gesture can leave this screen mid-session. Tear the
  // NFC session down on the way out; navigation itself is already happening, so
  // this deliberately does not call handleCancel's reset.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      cancel();
    });
    return unsubscribe;
  }, [navigation, cancel]);

  const handleCancel = useCallback(async () => {
    cancel();
    if (wcContext) {
      try {
        await respondError(wcContext, 4001, 'User rejected');
      } catch {
        // ignore — relay may have already expired
      }
    }
    resetToDashboard();
  }, [cancel, wcContext, respondError, resetToDashboard]);

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
        <NFCBottomSheet nfc={keycard} onCancel={handleCancel} showOnDone />
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
