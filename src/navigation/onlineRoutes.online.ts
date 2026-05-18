import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';

import type { RootStackParamList } from './types';
import WalletConnectPairingScreen from '../screens/WalletConnectPairingScreen';

type Route = {
  name: keyof RootStackParamList;
  component: React.ComponentType<any>;
  options?: NativeStackNavigationOptions;
};

export const onlineRoutes: Route[] = [
  { name: 'WalletConnectPairing', component: WalletConnectPairingScreen },
];
