import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icons } from '@/assets/icons';
import {
  KEYCARD_BUILD_GUIDE_LABEL,
  KEYCARD_BUILD_GUIDE_URL,
  NOT_LOCKED_HEADING,
  UNLOCK_INSTALLS_INTRO,
  UNLOCK_INSTALLS_TITLE,
  UNLOCK_KEY_CHOICES,
  UNLOCKED_HEADING,
  UPDATE_STEPS,
  UPDATE_STEPS_HEADING,
} from '@/constants/installLock';
import { UnlockInstallsScreenProps } from '@/navigation/types';
import theme from '@/theme';

import PrimaryButton from '@/components/PrimaryButton';

import { useUnlockInstalls } from '@/hooks/keycard/useInstallLock';
import { useExternalLink } from '@/hooks/useExternalLink';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';

import { PublishedCardManagerKey } from '@/utils/installLock';

const KEY_ORDER: PublishedCardManagerKey[] = [
  'gpDefault',
  'keycardDevelopment',
];

export default function UnlockInstallsScreen({
  navigation,
}: UnlockInstallsScreenProps) {
  const insets = useSafeAreaInsets();
  const [restore, setRestore] = useState<PublishedCardManagerKey | null>(null);
  const keycard = useUnlockInstalls();
  const { phase, result, start } = keycard;
  const { open, opensInBrowser } = useExternalLink({
    url: KEYCARD_BUILD_GUIDE_URL,
    title: KEYCARD_BUILD_GUIDE_LABEL,
  });

  const { sheet, leave } = useKeycardScreen({
    keycard,
    navigation,
    title: UNLOCK_INSTALLS_TITLE,
    hold: phase === 'done',
  });

  const LinkIcon = opensInBrowser ? Icons.openInBrowser : Icons.qr;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {phase === 'idle' && (
        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.intro}>{UNLOCK_INSTALLS_INTRO}</Text>
            {KEY_ORDER.map(key => {
              const { label, detail } = UNLOCK_KEY_CHOICES[key];
              const selected = restore === key;
              const Radio = selected ? Icons.radioOn : Icons.radioOff;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={styles.choice}
                  onPress={() => setRestore(key)}
                  testID={`restore-${key}`}
                >
                  <Radio width={24} height={24} />
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceLabel}>{label}</Text>
                    <Text style={styles.choiceDetail}>{detail}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <PrimaryButton
            label={UNLOCK_INSTALLS_TITLE}
            onPress={() => restore && start({ action: 'unlock', restore })}
            icon={Icons.nfcActivate}
            disabled={restore === null}
            testID="unlock-installs"
          />
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.content}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.heading}>
              {result === 'notLocked' ? NOT_LOCKED_HEADING : UNLOCKED_HEADING}
            </Text>
            <Text style={styles.intro}>{UPDATE_STEPS_HEADING}</Text>
            {UPDATE_STEPS.map((step, index) => (
              <View key={step} style={styles.point}>
                <Text style={styles.number}>{`${index + 1}.`}</Text>
                <Text style={styles.pointText}>{step}</Text>
              </View>
            ))}
            <Pressable
              accessibilityRole="link"
              style={styles.link}
              onPress={open}
              testID="keycard-build-guide"
            >
              <LinkIcon width={16} height={16} color={theme.colors.primary} />
              <Text variant="labelMedium" style={styles.linkText}>
                {KEYCARD_BUILD_GUIDE_LABEL}
              </Text>
            </Pressable>
          </ScrollView>
          <PrimaryButton label="Done" onPress={leave} testID="unlock-done" />
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
  choice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
  choiceLabel: {
    color: theme.colors.onSurface,
    fontSize: 16,
    lineHeight: 24,
  },
  choiceDetail: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  point: {
    flexDirection: 'row',
    gap: 8,
  },
  number: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
    minWidth: 18,
  },
  pointText: {
    flex: 1,
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  linkText: {
    color: theme.colors.primary,
  },
});
