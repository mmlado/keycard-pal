import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { APP_NAME } from '@/constants/app';
import theme from '../theme';

import { Camera, type ReadCodeEvent } from './Camera';

type Props = {
  onReadCode: (event: ReadCodeEvent) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Camera preview with the scanning viewfinder, owning its own CAMERA
 * permission.
 *
 * The request lives here rather than in the screens so that every entry point
 * to the camera inherits it: the SeedQR overlay used to mount this component
 * directly and opened a blank viewfinder on any device that had not already
 * granted access through the transaction scanner.
 *
 * iOS requests the permission itself on first use, driven by
 * NSCameraUsageDescription, so only Android needs the explicit prompt.
 */
export default function CameraView({ onReadCode, style, children }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(
    Platform.OS === 'android' ? null : true,
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    let active = true;
    (async () => {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (active) {
          setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        }
      } catch {
        // Treat a failed request as denied: showing the recovery UI is better
        // than a viewfinder that will never receive frames.
        if (active) {
          setHasPermission(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (hasPermission === null) {
    return (
      <View style={[styles.centered, style]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={styles.centeredText}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.centered, style]}>
        <Icon
          source="camera-off"
          size={64}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant="headlineSmall" style={styles.centeredText}>
          Camera Permission Required
        </Text>
        <Text variant="bodyMedium" style={styles.centeredSubtext}>
          {`${APP_NAME} needs camera access to scan QR codes.`}
        </Text>
        <Button
          mode="contained"
          onPress={() => Linking.openSettings()}
          style={styles.permissionButton}
        >
          Open Settings
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Camera style={StyleSheet.absoluteFill} onReadCode={onReadCode} />
      <View style={styles.viewfinderContainer}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>
      {children}
    </View>
  );
}

const CORNER = 24;
const BORDER = 3;

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cameraBackground,
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  centeredText: {
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
  centeredSubtext: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 8,
  },
  viewfinderContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  viewfinder: {
    height: 250,
    width: 250,
  },
  corner: {
    height: CORNER,
    position: 'absolute',
    width: CORNER,
  },
  cornerTL: {
    borderColor: theme.colors.primary,
    borderLeftWidth: BORDER,
    borderTopLeftRadius: 8,
    borderTopWidth: BORDER,
    left: 0,
    top: 0,
  },
  cornerTR: {
    borderColor: theme.colors.primary,
    borderRightWidth: BORDER,
    borderTopRightRadius: 8,
    borderTopWidth: BORDER,
    right: 0,
    top: 0,
  },
  cornerBL: {
    bottom: 0,
    borderBottomLeftRadius: 8,
    borderBottomWidth: BORDER,
    borderColor: theme.colors.primary,
    borderLeftWidth: BORDER,
    left: 0,
  },
  cornerBR: {
    bottom: 0,
    borderBottomRightRadius: 8,
    borderBottomWidth: BORDER,
    borderColor: theme.colors.primary,
    borderRightWidth: BORDER,
    right: 0,
  },
});
