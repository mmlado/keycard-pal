import { usePreventRemove } from '@react-navigation/native';

// iOS's back button and swipe dismiss natively, and only usePreventRemove holds them; the caller's beforeRemove listener decides what back does.
export function useBlockNativeBack(block: boolean): void {
  usePreventRemove(block, () => {});
}
