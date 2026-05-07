import { useEffect, useState } from 'react';

import {
  loadBooleanPreference,
  preferenceKeys,
  saveBooleanPreference,
} from '../../storage/preferencesStorage';

import SettingsToggleRow from './SettingsToggleRow';

export default function PinPadSettingsSection() {
  const [scramble, setScramble] = useState(false);

  useEffect(() => {
    loadBooleanPreference(preferenceKeys.pinPadScramble).then(setScramble);
  }, []);

  const handleToggle = (value: boolean) => {
    setScramble(value);
    saveBooleanPreference(preferenceKeys.pinPadScramble, value).catch(() =>
      setScramble(!value),
    );
  };

  return (
    <SettingsToggleRow
      label="Scramble PIN pad"
      value={scramble}
      onValueChange={handleToggle}
    />
  );
}
