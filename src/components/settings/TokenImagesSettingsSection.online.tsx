import { usePreferences } from '@/hooks/usePreferences';

import SettingsToggleRow from './SettingsToggleRow';

export default function TokenImagesSettingsSection(): React.JSX.Element | null {
  const { preferences, setPreference } = usePreferences();

  return (
    <SettingsToggleRow
      label="Load token images"
      value={preferences.tokenImagesEnabled}
      onValueChange={value => setPreference('tokenImagesEnabled', value)}
    />
  );
}
