import { Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';

import type {
  AssetChange,
  SimulationResult,
} from '@/utils/tenderly/client.online';

export type SimulationState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'result'; data: SimulationResult }
  | { phase: 'error'; message: string };

function AssetChangeRow({ change }: { change: AssetChange }) {
  return (
    <View style={styles.assetRow}>
      <Text style={styles.assetSymbol}>{change.tokenSymbol}</Text>
      <Text style={styles.assetAmount}>{change.amount}</Text>
      <Text style={styles.assetAddresses} numberOfLines={1}>
        {change.from.slice(0, 6)}…{change.from.slice(-4)} →{' '}
        {change.to.slice(0, 6)}…{change.to.slice(-4)}
      </Text>
    </View>
  );
}

export default function SimulationPanel({
  state,
  onSimulate,
}: {
  state: SimulationState;
  onSimulate: () => void;
}) {
  if (state.phase === 'idle') {
    return (
      <View style={styles.centered}>
        <PrimaryButton label="Simulate" onPress={onSimulate} />
      </View>
    );
  }

  if (state.phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Simulating…</Text>
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{state.message}</Text>
        <PrimaryButton label="Retry" onPress={onSimulate} />
      </View>
    );
  }

  const { data } = state;
  const reverted = data.status === 'reverted';

  return (
    <View style={styles.result}>
      <View
        style={[
          styles.chip,
          reverted ? styles.chipReverted : styles.chipSuccess,
        ]}
      >
        <Text
          style={[
            styles.chipText,
            reverted ? styles.chipTextReverted : styles.chipTextSuccess,
          ]}
        >
          {reverted ? 'Reverted' : 'Success'}
        </Text>
      </View>

      {reverted && data.revertReason ? (
        <Text style={styles.revertReason}>{data.revertReason}</Text>
      ) : null}

      {data.assetChanges.length > 0 && (
        <View style={styles.assetSection}>
          <Text style={styles.sectionLabel}>Asset changes</Text>
          {data.assetChanges.map((c, i) => (
            <AssetChangeRow key={i} change={c} />
          ))}
        </View>
      )}

      {data.traceUrl ? (
        <Text
          style={styles.traceLink}
          onPress={() => Linking.openURL(data.traceUrl).catch(() => {})}
        >
          View trace →
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  loadingText: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  result: {
    gap: 12,
    paddingVertical: 8,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipSuccess: {
    backgroundColor: theme.colors.success + '33',
  },
  chipReverted: {
    backgroundColor: theme.colors.error + '33',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSuccess: {
    color: theme.colors.success,
  },
  chipTextReverted: {
    color: theme.colors.error,
  },
  revertReason: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 13,
  },
  assetSection: {
    gap: 6,
  },
  sectionLabel: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 12,
  },
  assetRow: {
    gap: 2,
  },
  assetSymbol: {
    color: theme.colors.onSurface,
    fontSize: 13,
    fontWeight: '500',
  },
  assetAmount: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 13,
  },
  assetAddresses: {
    color: theme.colors.onSurfaceSubtle,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  traceLink: {
    color: theme.colors.primary,
    fontSize: 13,
  },
});
