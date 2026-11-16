import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import {
  ALREADY_LOCKED_TOAST,
  LOCK_INSTALLS_INTRO,
  LOCK_INSTALLS_POINTS,
  LOCK_INSTALLS_TITLE,
  lockFindingLines,
  lockFindingsHeading,
} from '@/constants/installLock';
import { LockInstallsScreenProps } from '@/navigation/types';
import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';

import {
  InstallLockResult,
  useLockInstalls,
} from '@/hooks/keycard/useInstallLock';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

function unconfirmedLock(
  result: InstallLockResult | null,
): { heading: string; lines: string[] } | null {
  return result?.outcome === 'unconfirmed'
    ? {
        heading: lockFindingsHeading(result.findings),
        lines: lockFindingLines(result.findings),
      }
    : null;
}

export default function LockInstallsScreen({
  navigation,
}: LockInstallsScreenProps) {
  const insets = useSafeAreaInsets();
  const keycard = useLockInstalls();
  const { phase, start, successMessage } = keycard;
  const result = keycard.result as InstallLockResult | null;
  const unconfirmed = phase === 'done' ? unconfirmedLock(result) : null;

  const { sheet, leave } = useKeycardScreen({
    keycard,
    navigation,
    title: LOCK_INSTALLS_TITLE,
    done: {
      toast: done => {
        const lock = done as InstallLockResult | null;
        if (lock?.outcome === 'alreadyLocked') {
          return ALREADY_LOCKED_TOAST;
        }
        return unconfirmedLock(lock)?.heading ?? successMessage;
      },
      requireResult: true,
    },
    hold: unconfirmed !== null,
    // The success mark would sit over a lock the card does not confirm.
    showOnDone: unconfirmed === null,
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

      {unconfirmed && (
        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text accessibilityRole="header" style={styles.heading}>
              {unconfirmed.heading}
            </Text>
            {unconfirmed.lines.map(line => (
              <View
                key={line}
                accessible
                accessibilityLabel={line}
                style={styles.point}
              >
                <Text style={styles.bullet}>{'•'}</Text>
                <Text style={styles.finding}>{line}</Text>
              </View>
            ))}
          </ScrollView>
          <PrimaryButton label="Done" onPress={leave} testID="lock-done" />
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
  heading: {
    color: theme.colors.onSurface,
    fontSize: 20,
    lineHeight: 28,
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
  finding: {
    flex: 1,
    color: theme.colors.onSurface,
    fontSize: 16,
    lineHeight: 24,
  },
});
