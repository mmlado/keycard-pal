import { renderHook } from '@testing-library/react-native';

import useTokenImagesEnabled from '../src/hooks/useTokenImagesEnabled.online';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

let mockEnabled = false;

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({ tokenImagesEnabled: mockEnabled }),
    setPreference: jest.fn(),
  }),
}));

describe('useTokenImagesEnabled', () => {
  beforeEach(() => {
    mockEnabled = false;
  });

  it('returns false when the preference is off (opt-in default)', () => {
    const { result } = renderHook(() => useTokenImagesEnabled());
    expect(result.current).toBe(false);
  });

  it('returns true when the preference is on', () => {
    mockEnabled = true;
    const { result } = renderHook(() => useTokenImagesEnabled());
    expect(result.current).toBe(true);
  });
});
