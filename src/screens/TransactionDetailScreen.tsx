import React, { useCallback } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icons } from '../assets/icons';
import type { TransactionDetailScreenProps } from '../navigation/types';
import theme from '../theme';
import SignRequestDetail from '../components/SignRequestDetail';
import PrimaryButton from '../components/PrimaryButton';
import { inspectBtcPsbt } from '../utils/btcPsbt';
import { buildSignKeycardParams } from '../utils/signNavigation';

export default function TransactionDetailScreen({
  route,
  navigation,
}: TransactionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { result } = route.params;
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

  const handleSign = useCallback(() => {
    if (keycardParams) {
      navigation.navigate('Keycard', keycardParams);
    }
  }, [keycardParams, navigation]);

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
  },
});
