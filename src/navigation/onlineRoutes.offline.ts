import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

type Route = {
  name: keyof RootStackParamList;
  component: React.ComponentType<any>;
  options?: NativeStackNavigationOptions;
};

export const onlineRoutes: Route[] = [];

import type { SatisfiesOnline } from '@/utils/onlineParity';

// tsc drift guard: this stub must stay interface-compatible with its online twin.
export type _OnlineParity = SatisfiesOnline<
  typeof import('./onlineRoutes.online'),
  typeof import('./onlineRoutes.offline')
>;
