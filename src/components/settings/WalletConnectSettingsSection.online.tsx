import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import TextInputSetting from '@/components/settings/TextInputSetting';

import { loadWCProjectId, saveWCProjectId } from '@/storage/walletConnect';
import { wcClient } from '@/utils/walletConnect/client.online';

export default function WalletConnectSettingsSection() {
  const [saved, setSaved] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadWCProjectId()
      .then(setSaved)
      .finally(() => setLoaded(true));
  }, []);

  const handleSave = useCallback(async (projectId: string) => {
    await saveWCProjectId(projectId);
    setSaved(projectId);
    wcClient.resetClient();
  }, []);

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <Text variant="labelLarge" style={styles.title}>
        WalletConnect
      </Text>
      <TextInputSetting
        label="Project ID"
        value={saved}
        placeholder="Enter WalletConnect Project ID"
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
