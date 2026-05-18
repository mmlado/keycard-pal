import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import theme from '@/theme';

import AddressText from '@/components/AddressText';
import { useWalletConnectSession } from '@/hooks/useWalletConnectSession.online';

export default function WalletConnectDashboardCard() {
  const { phase, disconnect } = useWalletConnectSession();

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  if (typeof phase !== 'object' || phase.kind !== 'active') {
    return null;
  }

  const { session } = phase;
  const { name, url } = session.peer.metadata;
  const accounts = session.namespaces.eip155?.accounts ?? [];
  const firstAddress = accounts[0]?.split(':')[2] ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text variant="labelLarge" style={styles.dAppName}>
            {name}
          </Text>
          {!!url && (
            <Text variant="bodySmall" style={styles.dAppUrl}>
              {url}
            </Text>
          )}
          {!!firstAddress && (
            <AddressText address={firstAddress} style={styles.address} />
          )}
        </View>
        <Button
          mode="outlined"
          compact
          onPress={handleDisconnect}
          textColor={theme.colors.error}
          style={styles.disconnectBtn}
        >
          Disconnect
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  dAppName: {
    color: theme.colors.onSurface,
    fontWeight: '600',
  },
  dAppUrl: {
    color: theme.colors.onSurfaceVariant,
  },
  address: {
    marginTop: 2,
  },
  disconnectBtn: {
    borderColor: theme.colors.error,
  },
});
