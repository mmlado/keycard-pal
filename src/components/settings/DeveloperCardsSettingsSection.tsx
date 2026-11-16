import { usePreferences } from '@/hooks/usePreferences';

import { INSTALL_LOCK_SUPPORTED } from '@/utils/installLockSupport';
import SettingsToggleRow from './SettingsToggleRow';

export default function DeveloperCardsSettingsSection() {
  const { preferences, setPreference } = usePreferences();

  if (!INSTALL_LOCK_SUPPORTED) {
    return null;
  }

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
