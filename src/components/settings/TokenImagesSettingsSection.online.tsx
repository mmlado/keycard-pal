import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadTokenImagesEnabled,
  saveTokenImagesEnabled,
} from '@/storage/preferencesStorage';

import SettingsToggleRow from './SettingsToggleRow';

export default function TokenImagesSettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const didInteractRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadTokenImagesEnabled().then(value => {
      if (active && !didInteractRef.current) {
        setEnabled(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = useCallback((value: boolean) => {
    didInteractRef.current = true;
    setEnabled(value);
    saveTokenImagesEnabled(value).catch(() => {
      setEnabled(current => (current === value ? !value : current));
    });
  }, []);

  return (
    <SettingsToggleRow
      label="Load token images"
      value={enabled}
      onValueChange={handleToggle}
    />
  );
}
