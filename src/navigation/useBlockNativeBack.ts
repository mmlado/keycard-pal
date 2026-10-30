import { useEffect, useId, useInsertionEffect } from 'react';
import { usePreventRemoveContext, useRoute } from '@react-navigation/native';

// iOS's back button and swipe dismiss natively unless the route is marked as prevented. usePreventRemove marks it but
// also vetoes every removal, the caller's own reset included, so this only marks it: the caller's beforeRemove decides.
export function useBlockNativeBack(block: boolean): void {
  const id = useId();
  const { key } = useRoute();
  const { setPreventRemove, notifyPreventRemove } = usePreventRemoveContext();

  useInsertionEffect(() => {
    setPreventRemove(id, key, block);
    return () => setPreventRemove(id, key, false);
  }, [setPreventRemove, id, key, block]);

  useEffect(() => {
    notifyPreventRemove();
    return () => notifyPreventRemove();
  }, [notifyPreventRemove, id, key, block]);
}
