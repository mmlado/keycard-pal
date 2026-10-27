import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { navigationRef } from '@/navigation/navigationRef';
import { routes } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/types';
import { OnlineProviders } from '@/providers/onlineProviders.online';
import { PreferencesProvider } from '@/providers/preferences/Provider';
import theme from '@/theme';

import { usePreferences } from '@/hooks/usePreferences';

import { restorePersistedIndex } from '@/utils/eip7730/restore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    restorePersistedIndex();
  }, []);

  return (
    <SafeAreaProvider style={styles.root}>
      {/* No preload: it shows the keyboard for a moment at launch. */}
      <KeyboardProvider
        statusBarTranslucent
        navigationBarTranslucent
        preserveEdgeToEdge
        preload={false}
      >
        <PaperProvider theme={theme}>
          <StatusBar barStyle="light-content" />
          <PreferencesProvider>
            <Navigator />
          </PreferencesProvider>
        </PaperProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

/**
 * Mounts only once the preferences are in, so the first route can be Welcome
 * without ever flashing the Dashboard.
 */
function Navigator() {
  const { preferences } = usePreferences();
  // Read once: the initial route only matters at mount, and Get started
  // flipping the flag afterwards must not change anything here.
  const [initialRouteName] = useState<'Welcome' | 'Dashboard'>(() =>
    preferences.welcomeSeen ? 'Dashboard' : 'Welcome',
  );

  return (
    <NavigationContainer ref={navigationRef}>
      <OnlineProviders>
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{ headerShown: false }}
        >
          {routes.map(r => (
            <Stack.Screen
              key={r.name}
              name={r.name}
              component={r.component}
              options={r.options}
            />
          ))}
        </Stack.Navigator>
      </OnlineProviders>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.colors.background,
  },
});
