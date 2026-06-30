import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import IndexedAtRow from './IndexedAtRow';
import ImportRegistryButton from './ImportRegistryButton';

import { loadIndexedAt } from '@/storage/eip7730Index';

export default function Eip7730SettingsSection() {
  const [indexedAt, setIndexedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadIndexedAt()
      .then(v => {
        if (!cancelled) {
          setIndexedAt(v);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImported = useCallback((newIndexedAt: string) => {
    setIndexedAt(newIndexedAt);
  }, []);

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.header}>
        Clear Signing Descriptors
      </Text>
      <ImportRegistryButton onImported={handleImported} />
      <IndexedAtRow indexedAt={indexedAt} />
      <Text style={styles.helper}>
        Download the Ledger clear-signing registry zip on another device and
        import it here to update descriptor data.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  header: {
    color: theme.colors.onSurface,
  },
  helper: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 12,
  },
});
