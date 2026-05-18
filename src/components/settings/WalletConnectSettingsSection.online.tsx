import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '../../theme';

import TextInputSetting from './TextInputSetting';

import { loadWCProjectId, saveWCProjectId } from '../../storage/walletConnect';
import { wcClient } from '../../utils/walletConnect/client.online';

export default function WalletConnectSettingsSection() {
  const [input, setInput] = useState('');
  const [saved, setSaved] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadWCProjectId()
      .then(id => {
        setInput(id);
        setSaved(id);
      })
      .finally(() => setLoaded(true));
  }, []);

  const dirty = loaded && input !== saved;

  const handleRevert = useCallback(() => {
    setInput(saved);
  }, [saved]);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    await saveWCProjectId(trimmed);
    setSaved(trimmed);
    wcClient.resetClient();
  }, [input]);

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <Text variant="labelLarge" style={styles.title}>
        WalletConnect
      </Text>
      <TextInputSetting
        label="Project ID"
        value={input}
        dirty={dirty}
        placeholder="Enter WalletConnect Project ID"
        onChangeText={setInput}
        onRevert={handleRevert}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  title: {
    color: theme.colors.onSurface,
  },
});
