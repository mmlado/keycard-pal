import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';

import theme from '@/theme';

import IndexedAtRow from './IndexedAtRow';
import ImportRegistryButton from './ImportRegistryButton';

import TextInputSetting from '../TextInputSetting';
import SettingsToggleRow from '../SettingsToggleRow';

import { useEip7730Download } from '@/hooks/useEip7730Download.online';

import { loadIndexedAt } from '@/storage/eip7730Index';
import {
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

import { DEFAULT_EIP7730_REGISTRY_URL } from '@/constants/eip7730';

export default function Eip7730SettingsSection() {
  const download = useEip7730Download();

  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<Eip7730DescriptorSource>('manual');
  const [indexedAt, setIndexedAt] = useState<string | null>(null);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [savedUrl, setSavedUrl] = useState(DEFAULT_EIP7730_REGISTRY_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_EIP7730_REGISTRY_URL);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadDescriptorSource(),
      loadDescriptorUrl(),
      loadWifiOnly(),
      loadIndexedAt(),
    ])
      .then(([s, u, w, at]) => {
        if (cancelled) return;
        setSource(s);
        setSavedUrl(u);
        setUrlInput(u);
        setWifiOnly(w);
        setIndexedAt(at);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSourceChange = useCallback(async (value: string) => {
    const next: Eip7730DescriptorSource = value === 'auto' ? 'auto' : 'manual';
    setSource(next);
    await saveDescriptorSource(next);
  }, []);

  const handleWifiToggle = useCallback(async (value: boolean) => {
    setWifiOnly(value);
    await saveWifiOnly(value);
  }, []);

  const dirty = loaded && urlInput.trim() !== savedUrl;

  const handleUrlRevert = useCallback(() => {
    setUrlInput(savedUrl);
  }, [savedUrl]);

  const handleUrlSave = useCallback(async () => {
    const trimmed = urlInput.trim() || DEFAULT_EIP7730_REGISTRY_URL;
    await saveDescriptorUrl(trimmed);
    setSavedUrl(trimmed);
    setUrlInput(trimmed);
    await clearEtag();
    await clearLastModified();
  }, [urlInput]);

  const handleImported = useCallback((newIndexedAt: string) => {
    setIndexedAt(newIndexedAt);
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
          { value: 'manual', label: 'Manual' },
          { value: 'auto', label: 'Auto-download' },
        ]}
      />
      {source === 'manual' ? (
        <ImportRegistryButton onImported={handleImported} />
      ) : (
        <View style={styles.autoBlock}>
          <TextInputSetting
            label="Registry zip URL"
            value={urlInput}
            dirty={dirty}
            placeholder={DEFAULT_EIP7730_REGISTRY_URL}
            keyboardType="url"
            onChangeText={setUrlInput}
            onRevert={handleUrlRevert}
            onSave={handleUrlSave}
          />
          <SettingsToggleRow
            label="Download on Wi-Fi only"
            value={wifiOnly}
            onValueChange={handleWifiToggle}
          />
          <Pressable
            style={[
              styles.downloadButton,
              downloadInProgress && styles.downloadButtonDisabled,
            ]}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            onPress={
              downloadInProgress ? undefined : () => download.triggerDownload()
            }
            disabled={downloadInProgress}
            testID="eip7730-download-now"
          >
            {downloadInProgress ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text variant="labelLarge" style={styles.downloadLabel}>
                Download now
              </Text>
            )}
          </Pressable>
          {download.phase === 'error' && download.error && (
            <Text style={styles.error}>{download.error}</Text>
          )}
        </View>
      )}
      <IndexedAtRow indexedAt={indexedAt} />
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
  downloadButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.4,
  },
  downloadLabel: {
    color: theme.colors.primary,
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
