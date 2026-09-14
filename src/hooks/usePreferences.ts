import { useContext } from 'react';

import {
  PreferencesContext,
  PreferencesContextValue,
} from '@/providers/preferences/context';

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return ctx;
}
