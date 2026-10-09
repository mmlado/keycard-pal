import { usePreferences } from '@/hooks/usePreferences';

export default function useTokenImagesEnabled(): boolean {
  const { preferences } = usePreferences();
  return preferences.tokenImagesEnabled;
}
