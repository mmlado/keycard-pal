import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import LoadingScreen from '@/components/LoadingScreen';

import {
  loadPreferences,
  Preferences,
  savePreference,
} from '@/storage/preferencesStorage';

import { PreferencesContext, PreferencesContextValue } from './context';

/**
 * Resolves every stored preference once, before anything below it mounts, and
 * shows the loading screen in the meantime. Children therefore never see a
 * default that a stored value later replaces. The loading screen stays
 * mounted above the children while it fades out, so the first screen is
 * already painted when it appears.
 *
 * Reads are local only: startup must never wait on the network, or the app
 * stalls offline and in airplane mode.
 */
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loadingMounted, setLoadingMounted] = useState(true);
  // Mirror of the state for the writer, which composes consecutive writes on
  // top of whatever is on screen at that moment.
  const currentRef = useRef<Preferences | null>(null);
  // What storage is known to hold. A rollback targets this rather than the
  // value the failed write replaced on screen: after two failed writes to one
  // key, that value is itself an optimistic one that never reached storage,
  // and restoring it would show something the user never chose.
  const confirmedRef = useRef<Preferences | null>(null);
  // Counts writes per preference so only the most recent one may roll back;
  // a slow failure must not undo a choice the user made after it.
  const writeSeqRef = useRef<Partial<Record<keyof Preferences, number>>>({});
  // One write to a key at a time. Android's AsyncStorage runs each write as
  // its own IO job, so two in flight can settle out of order: a failure
  // landing before an earlier success would roll the screen back past the
  // value that success went on to leave in storage.
  const writeChainRef = useRef<
    Partial<Record<keyof Preferences, Promise<void>>>
  >({});

  const commit = useCallback((next: Preferences) => {
    currentRef.current = next;
    setPreferences(next);
  }, []);

  useEffect(() => {
    let active = true;
    loadPreferences().then(loaded => {
      if (active) {
        confirmedRef.current = loaded;
        commit(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, [commit]);

  const setPreference = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      const current = currentRef.current;
      if (!current || current[key] === value) {
        return;
      }

      const seq = (writeSeqRef.current[key] ?? 0) + 1;
      writeSeqRef.current[key] = seq;
      commit({ ...current, [key]: value });

      // The stored link is the swallowed one, so a failed write still lets
      // the next write to that key run.
      const previous = writeChainRef.current[key] ?? Promise.resolve();
      const write = previous.then(() => savePreference(key, value));
      writeChainRef.current[key] = write.catch(() => {});

      try {
        await write;
        if (confirmedRef.current) {
          confirmedRef.current = { ...confirmedRef.current, [key]: value };
        }
      } catch {
        const confirmed = confirmedRef.current;
        if (
          writeSeqRef.current[key] === seq &&
          currentRef.current &&
          confirmed
        ) {
          commit({ ...currentRef.current, [key]: confirmed[key] });
        }
      }
    },
    [commit],
  );

  const value = useMemo<PreferencesContextValue | null>(
    () => preferences && { preferences, setPreference },
    [preferences, setPreference],
  );

  const unmountLoading = useCallback(() => setLoadingMounted(false), []);

  return (
    <>
      {value && (
        <PreferencesContext.Provider value={value}>
          {children}
        </PreferencesContext.Provider>
      )}
      {loadingMounted && (
        <LoadingScreen visible={!value} onHidden={unmountLoading} />
      )}
    </>
  );
}
