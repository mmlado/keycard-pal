/**
 * Keycard Pal - Air-Gap Android wallet that works with Keycards
 *
 * @format
 */

import React from 'react';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={theme.colors.background}
        />
        <NavigationContainer ref={navigationRef}>
          <OnlineProviders>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.colors.background,
  },
});
