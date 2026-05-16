import { useEffect, useState } from 'react';

import { loadTokenImagesEnabled } from '@/storage/preferencesStorage';

export default function useTokenImagesEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    loadTokenImagesEnabled().then(setEnabled);
  }, []);

  return enabled;
}
