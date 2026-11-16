import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import {
  ALREADY_LOCKED_TOAST,
  LOCK_INSTALLS_INTRO,
  LOCK_INSTALLS_POINTS,
  LOCK_INSTALLS_TITLE,
} from '@/constants/installLock';
import { LockInstallsScreenProps } from '@/navigation/types';
import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';

import {
  InstallLockResult,
  useLockInstalls,
} from '@/hooks/keycard/useInstallLock';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

export default function LockInstallsScreen({
  navigation,
}: LockInstallsScreenProps) {
  const insets = useSafeAreaInsets();
  const keycard = useLockInstalls();
  const { phase, start, successMessage } = keycard;

  const { sheet } = useKeycardScreen({
    keycard,
    navigation,
    title: LOCK_INSTALLS_TITLE,
    done: {
      toast: result =>
        (result as InstallLockResult | null)?.outcome === 'alreadyLocked'
          ? ALREADY_LOCKED_TOAST
          : successMessage,
    },
    showOnDone: true,
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {phase === 'idle' && (
        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.intro}>{LOCK_INSTALLS_INTRO}</Text>
            {LOCK_INSTALLS_POINTS.map(point => (
              <View
                key={point}
                accessible
                accessibilityLabel={point}
                style={styles.point}
              >
                <Text style={styles.bullet}>{'•'}</Text>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </ScrollView>
          <PrimaryButton
            label={LOCK_INSTALLS_TITLE}
            onPress={() => start({ action: 'lock' })}
            icon={Icons.nfcActivate}
            testID="lock-installs"
          />
        </View>
      )}

      {sheet}
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
    gap: 16,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 12,
  },
  intro: {
    color: theme.colors.onSurface,
    fontSize: 16,
    lineHeight: 24,
  },
  point: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  pointText: {
    flex: 1,
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
