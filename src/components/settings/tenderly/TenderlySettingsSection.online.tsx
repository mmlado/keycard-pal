import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../../theme';

import SettingsToggleRow from '../SettingsToggleRow';
import TextInputSetting from '../TextInputSetting';

import {
  loadTenderlyConfig,
  saveTenderlyCredentials,
  saveTenderlyEnabled,
  type TenderlyCredentials,
} from '../../../storage/tenderly.online';

const TENDERLY_REGISTER_URL = 'https://dashboard.tenderly.co/register';

export default function TenderlySettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [accountSlug, setAccountSlug] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [apiKey, setApiKey] = useState('');
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
        setAccountSlug(config.credentials.accountSlug);
        setProjectSlug(config.credentials.projectSlug);
        setApiKey(config.credentials.apiKey);
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

  const saveCredentials = useCallback(
    async (patch: Partial<TenderlyCredentials>) => {
      const creds = { ...savedRef.current, ...patch };
      try {
        await saveTenderlyCredentials(creds);
        setSaved(creds);
      } catch {
        // leave UI state as-is; user can retry
      }
    },
    [],
  );

  const accountSlugDirty = loaded && accountSlug !== saved.accountSlug;
  const projectSlugDirty = loaded && projectSlug !== saved.projectSlug;
  const apiKeyDirty = loaded && apiKey !== saved.apiKey;

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
            value={accountSlug}
            dirty={accountSlugDirty}
            placeholder="my-account"
            disableSave={accountSlug.trim() === ''}
            onChangeText={setAccountSlug}
            onRevert={
              saved.accountSlug
                ? () => setAccountSlug(saved.accountSlug)
                : undefined
            }
            onSave={() => {
              const v = accountSlug.trim();
              setAccountSlug(v);
              saveCredentials({ accountSlug: v });
            }}
          />
          <TextInputSetting
            label="Project slug"
            value={projectSlug}
            dirty={projectSlugDirty}
            placeholder="my-project"
            disableSave={projectSlug.trim() === ''}
            onChangeText={setProjectSlug}
            onRevert={
              saved.projectSlug
                ? () => setProjectSlug(saved.projectSlug)
                : undefined
            }
            onSave={() => {
              const v = projectSlug.trim();
              setProjectSlug(v);
              saveCredentials({ projectSlug: v });
            }}
          />
          <TextInputSetting
            label="API key"
            value={apiKey}
            dirty={apiKeyDirty}
            placeholder="Enter API key"
            disableSave={apiKey.trim() === ''}
            onChangeText={setApiKey}
            onRevert={saved.apiKey ? () => setApiKey(saved.apiKey) : undefined}
            onSave={() => {
              const v = apiKey.trim();
              setApiKey(v);
              saveCredentials({ apiKey: v });
            }}
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
