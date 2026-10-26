import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import theme from '@/theme';

import { Icons } from '@/assets/icons';
import BottomActionArea from '@/components/BottomActionArea';
import PrimaryButton from '@/components/PrimaryButton';

type Props = {
  matches: boolean;
  text: string;
  onDone: () => void;
};

/** What a verify tap found: a check mark for a match, an X for a mismatch. */
export default function VerifyResult({ matches, text, onDone }: Props) {
  const ResultIcon = matches ? Icons.verifyMatch : Icons.verifyMismatch;
  return (
    <View style={styles.container}>
      <View style={styles.result}>
        <ResultIcon
          width={96}
          height={96}
          testID={matches ? 'verify-match' : 'verify-mismatch'}
        />
        <Text variant="titleLarge" style={styles.text}>
          {text}
        </Text>
      </View>
      <BottomActionArea style={styles.buttonArea}>
        <PrimaryButton label="OK" onPress={onDone} />
      </BottomActionArea>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  result: {
    alignItems: 'center',
    flex: 1,
    gap: 24,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    color: theme.colors.onSurface,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonArea: {
    paddingHorizontal: 16,
  },
});
