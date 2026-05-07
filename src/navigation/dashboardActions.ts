import { DashboardAction } from './types';

import { dashboardEntry as aboutEntry } from '../screens/AboutScreen';
import { dashboardEntry as exportKeyEntry } from '../screens/ExportKeyScreen';
import { dashboardEntry as keycardMenuEntry } from '../screens/KeycardMenuScreen';
import { dashboardEntry as settingsEntry } from '../screens/SettingsScreen';
import { dashboardEntry as addressMenuEntry } from '../screens/address/AddressMenuScreen';

export const dashboardActions: DashboardAction[] = [
  exportKeyEntry,
  addressMenuEntry,
  keycardMenuEntry,
  settingsEntry,
  aboutEntry,
];
