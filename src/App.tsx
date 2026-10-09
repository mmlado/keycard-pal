/**
 * Keycard Pal - Air-Gap Android wallet that works with Keycards
 *
 * @format
 */

import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import theme from './theme';
import type { RootStackParamList } from './navigation/types';
import { navigationRef } from './navigation/navigationRef';
import { routes } from './navigation/routes';
import { OnlineProviders } from './providers/onlineProviders.online';
import { PreferencesProvider } from './providers/preferences/Provider';

import { usePreferences } from './hooks/usePreferences';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <PaperProvider theme={theme}>
        <StatusBar barStyle="light-content" />
        <PreferencesProvider>
          <Navigator />
        </PreferencesProvider>
      </PaperProvider>
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
