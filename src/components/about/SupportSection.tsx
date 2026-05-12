import { StyleSheet, Text, View } from 'react-native';

import theme from '../../theme';

import SupportList from './SupportList';

type SupportSectionProps = {
  onShowQR: (label: string, address: string) => void;
};

export default function SupportSection({ onShowQR }: SupportSectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy me a coffee</Text>
      <Text style={styles.description}>
        If GapSign keeps your funds safe, you can send a coffee my way. It helps
        keep the project maintained and open-source.
      </Text>
      <SupportList onShowQR={onShowQR} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 18,
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
  description: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
