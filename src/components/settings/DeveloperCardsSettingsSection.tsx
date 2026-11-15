import { usePreferences } from '@/hooks/usePreferences';

import SettingsToggleRow from './SettingsToggleRow';

export default function DeveloperCardsSettingsSection() {
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsToggleRow
      label="Show developer card options"
      value={preferences.developerCardOptions === 'shown'}
      onValueChange={value =>
        setPreference('developerCardOptions', value ? 'shown' : 'hidden')
      }
    />
  );
}
