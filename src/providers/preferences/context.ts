import { createContext } from 'react';

import type { Preferences } from '@/storage/preferencesStorage';

export type PreferencesContextValue = {
  /** The stored preferences, resolved once at startup and kept current by
   * `setPreference`. */
  preferences: Preferences;
  /**
   * Writes one preference. Every consumer shows the new value at once; if the
   * write fails, the value rolls back to the one it replaced. Never rejects,
   * so callers need not catch.
   */
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => Promise<void>;
};

export const PreferencesContext = createContext<PreferencesContextValue | null>(
  null,
);
