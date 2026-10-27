import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import SettingsToggleRow from '@/components/settings/SettingsToggleRow';
import TextInputSetting from '@/components/settings/TextInputSetting';

import { clearEnsNameCache } from '@/hooks/ens/useEnsName.online';

import {
  DEFAULT_ENS_RPC_URL,
  loadEnsSettings,
  saveEnsEnabled,
  saveEnsRpcUrl,
} from '@/storage/ensSettings.online';
import { validateRpcUrl } from '@/utils/ens/client.online';

export default function EnsSettingsSection() {
  const [savedUrl, setSavedUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadEnsSettings()
      .then(settings => {
        if (!cancelled) {
          setEnabled(settings.enabled);
          setSavedUrl(settings.rpcUrl);
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

  const handleToggle = useCallback(
    async (value: boolean) => {
      setEnabled(value);
      if (value && !savedUrl) {
        setSavedUrl(DEFAULT_ENS_RPC_URL);
        await Promise.all([
          saveEnsEnabled(true),
          saveEnsRpcUrl(DEFAULT_ENS_RPC_URL),
        ]);
      } else {
        if (!value) clearEnsNameCache();
        await saveEnsEnabled(value);
      }
    },
    [savedUrl],
  );

  const handleSave = useCallback(async (url: string) => {
    if (url) {
      const result = await validateRpcUrl(url);
      if (result === 'non-mainnet') {
        return 'Not an Ethereum mainnet endpoint.';
      }
      if (result !== 'ok') {
        return 'Could not reach RPC endpoint — URL not saved.';
      }
    }
    await saveEnsRpcUrl(url);
    setSavedUrl(url);
  }, []);

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <SettingsToggleRow
        label="ENS resolution"
        value={enabled}
        onValueChange={handleToggle}
      />
      {enabled && (
        <TextInputSetting
          label="RPC URL"
          value={savedUrl}
          placeholder={DEFAULT_ENS_RPC_URL}
          keyboardType="url"
          onSave={handleSave}
        />
      )}
      <Text style={styles.privacy}>
        ENS lookups send reviewed Ethereum addresses to the configured RPC
        provider.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  privacy: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 12,
  },
});
