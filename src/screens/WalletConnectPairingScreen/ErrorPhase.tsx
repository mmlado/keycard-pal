import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { EdgeInsets } from 'react-native-safe-area-context';

import styles from './styles';

export default function ErrorPhase({
  message,
  insets,
  onBack,
}: {
  message: string;
  insets: EdgeInsets;
  onBack: () => void;
}) {
  return (
    <View
      style={[
        styles.centered,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Text style={styles.errorText}>{message}</Text>
      <Button onPress={onBack}>Go back to Dashboard</Button>
    </View>
  );
}
