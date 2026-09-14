import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '../assets/icons';
import { DashboardAction, FactoryResetSreenProps } from '../navigation/types';
import theme from '../theme';

import NFCBottomSheet from '../components/NFCBottomSheet';
import PrimaryButton from '../components/PrimaryButton';

import { useFactoryReset } from '../hooks/keycard/useFactoryReset';
import { useKeycardScreen } from '../hooks/useKeycardScreen';

export const dashboardEntry: DashboardAction = {
  label: 'Factory reset',
  icon: Icons.factoryReset,
  navigate: nav => nav.navigate('FactoryReset'),
};

export default function FactoryResetScreen({
  navigation,
}: FactoryResetSreenProps) {
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);

  const keycard = useFactoryReset();
  const { phase, start } = keycard;

  const { onCancel } = useKeycardScreen({
    keycard,
    navigation,
    title: 'Factory reset',
    done: { toast: 'Factory reset done' },
  });

  const handleStart = useCallback(() => {
    start();
  }, [start]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {phase === 'idle' && (
        <View style={styles.content}>
          <View style={styles.body}>
            <Text style={styles.description}>
              Factory reset will permanently erase the keypair on your Keycard.
            </Text>
            <Text style={styles.description}>
              Ensure that you have backed up your recovery phrase before
              proceeding.
            </Text>
          </View>

          <View style={styles.footer}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setChecked(v => !v)}
            >
              <View
                style={[styles.checkbox, checked && styles.checkboxChecked]}
              >
                {checked && <View style={styles.checkboxInner} />}
              </View>
              <Text style={styles.checkboxLabel}>
                I have a backup of the recovery phrase associated with this
                Keycard and would like to factory reset it.
              </Text>
            </Pressable>

            <PrimaryButton
              label="Factory reset Keycard"
              onPress={handleStart}
              icon={Icons.nfcActivate}
              disabled={!checked}
            />
          </View>
        </View>
      )}

      <NFCBottomSheet nfc={keycard} onCancel={onCancel} showOnDone />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  description: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    gap: 16,
    paddingBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.onSurfaceMuted,
    marginTop: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: theme.colors.onSurface,
  },
  checkboxLabel: {
    flex: 1,
    color: theme.colors.onSurfaceMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
