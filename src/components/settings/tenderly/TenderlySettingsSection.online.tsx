import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import SettingsToggleRow from '@/components/settings/SettingsToggleRow';
import TextInputSetting from '@/components/settings/TextInputSetting';

import {
  loadTenderlyConfig,
  saveTenderlyCredentials,
  saveTenderlyEnabled,
  type TenderlyCredentials,
} from '@/storage/tenderly.online';

const TENDERLY_REGISTER_URL = 'https://dashboard.tenderly.co/register';

export default function TenderlySettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<TenderlyCredentials>({
    accountSlug: '',
    projectSlug: '',
    apiKey: '',
  });
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    let cancelled = false;
    loadTenderlyConfig()
      .then(config => {
        if (cancelled) return;
        setEnabled(config.enabled);
        setSaved(config.credentials);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(async (value: boolean) => {
    setEnabled(value);
    try {
      await saveTenderlyEnabled(value);
    } catch {
      setEnabled(!value);
    }
  }, []);

  // Each field saves all three, so a second save keeps what the first one stored.
  const saveCredentials = useCallback(
    async (patch: Partial<TenderlyCredentials>) => {
      const creds = { ...savedRef.current, ...patch };
      await saveTenderlyCredentials(creds);
      setSaved(creds);
    },
    [],
  );

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <SettingsToggleRow
        label="Transaction simulation"
        value={enabled}
        onValueChange={handleToggle}
      />
      {enabled && (
        <>
          <TextInputSetting
            label="Account slug"
            value={saved.accountSlug}
            placeholder="my-account"
            required
            onSave={accountSlug => saveCredentials({ accountSlug })}
          />
          <TextInputSetting
            label="Project slug"
            value={saved.projectSlug}
            placeholder="my-project"
            required
            onSave={projectSlug => saveCredentials({ projectSlug })}
          />
          <TextInputSetting
            label="API key"
            value={saved.apiKey}
            placeholder="Enter API key"
            required
            onSave={apiKey => saveCredentials({ apiKey })}
          />
          <Text
            style={styles.link}
            onPress={() =>
              Linking.openURL(TENDERLY_REGISTER_URL).catch(() => {})
            }
          >
            Create a free Tenderly account →
          </Text>
        </>
      )}
      <Text style={styles.privacy}>
        When simulation is active, transaction data (addresses, value, calldata,
        chain ID) is sent to Tenderly. Your signing key is never transmitted.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  link: {
    color: theme.colors.primary,
    fontSize: 13,
  },
  privacy: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 12,
  },
});
