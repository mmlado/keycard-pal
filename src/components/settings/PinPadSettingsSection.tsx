import { useEffect, useState } from 'react';

import {
  loadPinPadScramble,
  savePinPadScramble,
} from '../../storage/preferencesStorage';

import SettingsToggleRow from './SettingsToggleRow';

export default function PinPadSettingsSection() {
  const [scramble, setScramble] = useState(false);

  useEffect(() => {
    loadPinPadScramble().then(setScramble);
  }, []);

  const handleToggle = (value: boolean) => {
    setScramble(value);
    savePinPadScramble(value).catch(() => setScramble(!value));
  };

  return (
    <SettingsToggleRow
      label="Scramble PIN pad"
      value={scramble}
      onValueChange={handleToggle}
    />
  );
}
