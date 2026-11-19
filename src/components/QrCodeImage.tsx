import { StyleSheet, View, type ViewProps } from 'react-native';
import QRCode, { type QRCodeProps } from 'react-native-qrcode-svg';

// Four modules of the smallest code (21x21), so every code gets the four QR requires.
export const QUIET_ZONE = 4 / 21;

type Props = Pick<QRCodeProps, 'value' | 'ecl' | 'testID'> &
  Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel'> & {
    size: number;
  };

/** A black on white code `size` wide, its light margin drawn in the SVG: a system dark mode recolors views, not the SVG. */
export default function QrCodeImage({
  value,
  size,
  ecl,
  testID,
  ...accessibility
}: Props) {
  return (
    <View style={styles.clip} {...accessibility}>
      <QRCode
        value={value}
        size={size}
        ecl={ecl}
        quietZone={size * QUIET_ZONE}
        color="#000000"
        backgroundColor="#ffffff"
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});
