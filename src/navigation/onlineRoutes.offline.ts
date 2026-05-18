import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

type Route = {
  name: keyof RootStackParamList;
  component: React.ComponentType<any>;
  options?: NativeStackNavigationOptions;
};

export const onlineRoutes: Route[] = [];
