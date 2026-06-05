import { Image, StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/constants/app';
import theme from '../../theme';

import { version as APP_VERSION } from '../../../package.json';

export default function AppIdentityHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.appIdentity}>
        <Image
          source={require('../../../fastlane/metadata/android/en-US/images/icon.png')}
          style={styles.appIcon}
          accessibilityLabel={`${APP_NAME} app icon`}
        />
        <Text style={styles.appName}>{APP_NAME}</Text>
      </View>
      <Text style={styles.version}>v{APP_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 4,
  },
  appIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  appName: {
    fontFamily: 'Inter_18pt-SemiBold',
    fontSize: 28,
    lineHeight: 34,
    color: theme.colors.onSurface,
  },
  appIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  version: {
    fontSize: 14,
    color: theme.colors.onSurfaceMuted,
  },
});
