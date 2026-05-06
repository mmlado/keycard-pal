/**
 * GapSign - Air-Gap Android wallet that works with Keycards
 *
 * @format
 */

import React from 'react';
import { StatusBar, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import theme from './theme';
import type { RootStackParamList } from './navigation/types';
import { routes } from './navigation/routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#121212"
        />
        <NavigationContainer>
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
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#121212',
  },
});
