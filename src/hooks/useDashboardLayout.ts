import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DashboardLayout,
  loadDashboardLayout,
  saveDashboardLayout,
} from '../storage/preferencesStorage';

type UseDashboardLayout = {
  layout: DashboardLayout;
  /** False until the stored value is in, so the caller can avoid a flash. */
  loaded: boolean;
};

/**
 * Every mounted consumer re-reads when the preference changes. Several screens
 * can be on the stack at once, so a change has to reach the ones the user is
 * not looking at rather than only the screen that made it.
 */
const listeners = new Set<() => void>();

/** Writes the preference and tells every mounted consumer to re-read. */
export async function setDashboardLayout(
  value: DashboardLayout,
): Promise<void> {
  await saveDashboardLayout(value);
  listeners.forEach(listener => listener());
}

export function useDashboardLayout(): UseDashboardLayout {
  const [layout, setLayout] = useState<DashboardLayout>('tiles');
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(true);

  const reload = useCallback(() => {
    loadDashboardLayout()
      .then(value => {
        if (!mountedRef.current) return;
        setLayout(value);
        setLoaded(true);
      })
      .catch(() => {
        if (mountedRef.current) setLoaded(true);
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    listeners.add(reload);
    return () => {
      mountedRef.current = false;
      listeners.delete(reload);
    };
  }, [reload]);

  return { layout, loaded };
}
