import { useEffect, useState } from 'react';

import {
  loadTenderlyConfig,
  type TenderlyCredentials,
} from '@/storage/tenderly.online';

export type { TenderlyCredentials };

export function useTenderlyConfig(): {
  credentials: TenderlyCredentials | null;
} {
  const [credentials, setCredentials] = useState<TenderlyCredentials | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    loadTenderlyConfig()
      .then(config => {
        if (cancelled) return;
        const { enabled, credentials: creds } = config;
        setCredentials(
          enabled && creds.accountSlug && creds.projectSlug && creds.apiKey
            ? creds
            : null,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { credentials };
}
