import { usePreferences } from '../../hooks/usePreferences';

import SettingsToggleRow from './SettingsToggleRow';

export default function PinPadSettingsSection() {
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsToggleRow
      label="Scramble PIN pad"
      value={preferences.pinPadScramble}
      onValueChange={value => setPreference('pinPadScramble', value)}
    />
  );
}
