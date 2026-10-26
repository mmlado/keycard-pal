import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Icons } from '@/assets/icons';
import {
  everyCardInUseHasRoute,
  routeAbsence,
} from '@/navigation/generationBoundRoutes';
import { Bip85ScreenProps } from '@/navigation/types';
import theme from '@/theme';

import Bip85Review from '@/components/Bip85Review';
import BottomActionArea from '@/components/BottomActionArea';
import PrimaryButton from '@/components/PrimaryButton';

import { useDeriveBip85 } from '@/hooks/keycard/useDeriveBip85';
import { useKeycardScreen } from '@/hooks/useKeycardScreen';
import { usePreferences } from '@/hooks/usePreferences';

import { BIP85_MAX_INDEX, bip85Format } from '@/utils/bip85';

export const BIP85_INDEX_EXPLAINER =
  'Each index gives a different, unrelated result. The same index always ' +
  'gives the same one, so you can derive it again later.';

export const BIP85_INDEX_TOO_HIGH = `The highest index is ${BIP85_MAX_INDEX}.`;

export default function Bip85Screen({ navigation, route }: Bip85ScreenProps) {
  const { format } = route.params;
  const { preferences } = usePreferences();
  const [index, setIndex] = useState('0');
  // The field stays editable until the PIN pad opens; the result shows this one.
  const [derivedIndex, setDerivedIndex] = useState<number | null>(null);
  const keycard = useDeriveBip85();
  const { phase, result, start, reset } = keycard;

  // Back to the form at the next index: indexes are usually derived in a row.
  const showForm = useCallback(() => {
    reset();
    if (derivedIndex !== null && derivedIndex < BIP85_MAX_INDEX) {
      setIndex(String(derivedIndex + 1));
    }
    setDerivedIndex(null);
  }, [derivedIndex, reset]);

  const { sheet } = useKeycardScreen({
    keycard,
    navigation,
    title: bip85Format(format).title,
    stepBack: () => {
      if (phase !== 'done') {
        return false;
      }
      showForm();
      return true;
    },
  });

  // With a 3.x card ticked, say so before a PIN is typed for it.
  const mayLackBip85 = !everyCardInUseHasRoute(
    'Bip85',
    preferences.generationsInUse,
  );

  const tooHigh = Number(index) > BIP85_MAX_INDEX;

  const handleDerive = useCallback(() => {
    const requested = Number(index);
    setDerivedIndex(requested);
    start({ format, index: requested });
  }, [format, index, start]);

  return (
    <View style={styles.container}>
      {phase === 'idle' && (
        <View style={styles.content}>
          <View style={styles.body}>
            <Text style={styles.description}>
              {mayLackBip85
                ? `${BIP85_INDEX_EXPLAINER} ${routeAbsence('Bip85').detail}`
                : BIP85_INDEX_EXPLAINER}
            </Text>
            <Text style={styles.label}>Index</Text>
            <TextInput
              style={styles.input}
              value={index}
              // Never cut: a cut index above the highest can become a valid, different one.
              onChangeText={value => setIndex(value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder={`0-${BIP85_MAX_INDEX}`}
              placeholderTextColor={theme.colors.onSurfaceDisabled}
            />
            <Text style={[styles.error, !tooHigh && styles.errorHidden]}>
              {tooHigh ? BIP85_INDEX_TOO_HIGH : ''}
            </Text>
          </View>

          <BottomActionArea>
            <PrimaryButton
              label="Derive"
              onPress={handleDerive}
              icon={Icons.nfcActivate}
              disabled={index === '' || tooHigh}
            />
          </BottomActionArea>
        </View>
      )}

      {phase === 'done' && result && derivedIndex !== null && (
        <Bip85Review
          format={format}
          index={derivedIndex}
          entropy={result}
          onDone={showForm}
        />
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
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  description: {
    color: theme.colors.onSurfaceMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  label: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surfaceVariant,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.onSurface,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    color: theme.colors.onSurface,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  error: {
    color: theme.colors.errorDark,
    fontSize: 12,
    height: 20,
    lineHeight: 16,
    paddingTop: 4,
  },
  errorHidden: {
    opacity: 0,
  },
});
