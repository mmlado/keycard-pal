import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../../theme';

import TextInputSetting from '../TextInputSetting';
import SettingsToggleRow from '../SettingsToggleRow';

import { clearEnsNameCache } from '../../../hooks/ens/useEnsName.online';
import { validateRpcUrl } from '../../../utils/ens/client.online';
import {
  DEFAULT_ENS_RPC_URL,
  loadEnsSettings,
  saveEnsEnabled,
  saveEnsRpcUrl,
} from '../../../storage/ensSettings.online';

export default function EnsSettingsSection() {
  const [input, setInput] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEnsSettings()
      .then(settings => {
        if (!cancelled) {
          setEnabled(settings.enabled);
          setSavedUrl(settings.rpcUrl);
          setInput(settings.rpcUrl);
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
      setError(null);
      if (value && !savedUrl) {
        setSavedUrl(DEFAULT_ENS_RPC_URL);
        setInput(DEFAULT_ENS_RPC_URL);
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

  const dirty = loaded && input !== savedUrl;

  const handleRevert = useCallback(() => {
    setInput(savedUrl);
    setError(null);
  }, [savedUrl]);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      await saveEnsRpcUrl('');
      setSavedUrl('');
      setError(null);
      return;
    }

    setValidating(true);
    setError(null);

    const result = await validateRpcUrl(trimmed);
    setValidating(false);

    if (result === 'ok') {
      await saveEnsRpcUrl(trimmed);
      setSavedUrl(trimmed);
      setError(null);
    } else if (result === 'non-mainnet') {
      setError('Not an Ethereum mainnet endpoint.');
    } else {
      setError('Could not reach RPC endpoint — URL not saved.');
    }
  }, [input]);

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
          value={input}
          dirty={dirty}
          saving={validating}
          error={error}
          placeholder={DEFAULT_ENS_RPC_URL}
          keyboardType="url"
          onChangeText={value => {
            setInput(value);
            setError(null);
          }}
          onRevert={handleRevert}
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
