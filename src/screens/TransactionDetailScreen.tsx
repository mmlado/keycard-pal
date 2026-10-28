import React, { useCallback } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import type { TransactionDetailScreenProps } from '@/navigation/types';
import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';
import SignRequestDetail from '@/components/SignRequestDetail';
import SimulationAddressProvider from '@/components/SignRequestDetail/SimulationAddressProvider';

import { useWalletConnectSession } from '@/hooks/useWalletConnectSession.online';

import { reviewWording } from '@/utils/reviewWording';
import { buildSignKeycardParams } from '@/utils/signNavigation';

export default function TransactionDetailScreen({
  route,
  navigation,
}: TransactionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { result, wcContext } = route.params;
  // Any other way out, the provider rejects the request itself.
  const { rejectRequest } = useWalletConnectSession();

  const { title, signLabel } = reviewWording(result);
  const keycardParams = buildSignKeycardParams(result, wcContext);

  const handleSign = useCallback(() => {
    if (!keycardParams) return;
    navigation.navigate('Keycard', keycardParams);
  }, [keycardParams, navigation]);

  const handleReject = useCallback(async () => {
    if (wcContext) {
      await rejectRequest(wcContext);
    }
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  }, [rejectRequest, navigation, wcContext]);

  return (
    <View style={styles.container}>
      <SimulationAddressProvider
        derivationPath={
          result.kind === 'eth-sign-request'
            ? result.request.derivationPath
            : undefined
        }
        title={title}
      >
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
              label={signLabel}
              onPress={handleSign}
              icon={Icons.nfcActivate}
            />
          </View>
        )}
      </SimulationAddressProvider>
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
