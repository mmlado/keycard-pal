import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';

import theme from '@/theme';

import ActiveIndex from './ActiveIndex';
import ImportRegistryButton from './ImportRegistryButton';
import SettingsButton from './SettingsButton';
import SettingsToggleRow from '@/components/settings/SettingsToggleRow';
import TextInputSetting from '@/components/settings/TextInputSetting';

import { useEip7730Download } from '@/hooks/useEip7730Download.online';

import {
  DEFAULT_EIP7730_REGISTRY_URL,
  type Eip7730DescriptorSource,
  clearEtag,
  clearLastModified,
  loadDescriptorSource,
  loadDescriptorUrl,
  loadWifiOnly,
  saveDescriptorSource,
  saveDescriptorUrl,
  saveWifiOnly,
} from '@/storage/eip7730Settings.online';

export default function Eip7730SettingsSection() {
  const download = useEip7730Download();

  const [loaded, setLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [source, setSource] = useState<Eip7730DescriptorSource>('manual');
  const [wifiOnly, setWifiOnly] = useState(false);
  const [savedUrl, setSavedUrl] = useState(DEFAULT_EIP7730_REGISTRY_URL);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadDescriptorSource(), loadDescriptorUrl(), loadWifiOnly()])
      .then(([s, u, w]) => {
        if (cancelled) return;
        setSource(s);
        setSavedUrl(u);
        setWifiOnly(w);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSourceChange = useCallback(
    async (value: string) => {
      const next: Eip7730DescriptorSource =
        value === 'auto' ? 'auto' : 'manual';
      if (next === source || importing) return;
      setSource(next);
      await saveDescriptorSource(next);
      // The validators describe the last download; an import or a reset may have replaced it since.
      if (next === 'auto') {
        await clearEtag();
        await clearLastModified();
      }
    },
    [source, importing],
  );

  const handleWifiToggle = useCallback(async (value: boolean) => {
    setWifiOnly(value);
    await saveWifiOnly(value);
  }, []);

  // The validators go first, so a failed save leaves the old URL and a Save to retry.
  const handleUrlSave = useCallback(async (url: string) => {
    const next = url || DEFAULT_EIP7730_REGISTRY_URL;
    await clearEtag();
    await clearLastModified();
    await saveDescriptorUrl(next);
    setSavedUrl(next);
  }, []);

  const handleReverted = useCallback(async () => {
    setSource('manual');
    await saveDescriptorSource('manual');
  }, []);

  const downloadInProgress =
    download.phase === 'checking' ||
    download.phase === 'downloading' ||
    download.phase === 'processing';

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.header}>
        Clear Signing Descriptors
      </Text>
      <SegmentedButtons
        value={source}
        onValueChange={handleSourceChange}
        buttons={[
          { value: 'manual', label: 'Manual', disabled: importing },
          { value: 'auto', label: 'Auto-download', disabled: importing },
        ]}
      />
      {source === 'manual' ? (
        <ImportRegistryButton
          disabled={downloadInProgress}
          onBusyChange={setImporting}
        />
      ) : (
        <View style={styles.autoBlock}>
          <TextInputSetting
            label="Registry zip URL"
            value={savedUrl}
            placeholder={DEFAULT_EIP7730_REGISTRY_URL}
            keyboardType="url"
            onSave={handleUrlSave}
          />
          <SettingsToggleRow
            label="Download on Wi-Fi only"
            value={wifiOnly}
            onValueChange={handleWifiToggle}
          />
          <SettingsButton
            label="Download now"
            onPress={download.triggerDownload}
            busy={downloadInProgress}
            testID="eip7730-download-now"
          />
          {download.phase === 'error' && download.error && (
            <Text style={styles.error}>{download.error}</Text>
          )}
        </View>
      )}
      <ActiveIndex
        onReverted={handleReverted}
        disabled={downloadInProgress || importing}
      />
      <Text style={styles.helper}>
        Descriptors enrich review screens with human-readable intents and
        formatted values. Auto-download contacts the configured server on app
        start.
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
  autoBlock: {
    gap: 8,
  },
  error: {
    color: theme.colors.error,
    fontSize: 12,
  },
  helper: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 12,
  },
});
