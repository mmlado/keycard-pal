import { act, renderHook } from '@testing-library/react-native';

import useTokenImagesEnabled from '../src/hooks/useTokenImagesEnabled.online';

const mockLoad = jest.fn();

jest.mock('../src/storage/preferencesStorage', () => ({
  loadTokenImagesEnabled: (...args: any[]) => mockLoad(...args),
}));

describe('useTokenImagesEnabled', () => {
  beforeEach(() => {
    mockLoad.mockReset();
    mockLoad.mockResolvedValue(false);
  });

  it('returns false before storage resolves', () => {
    mockLoad.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTokenImagesEnabled());
    expect(result.current).toBe(false);
  });

  it('returns false when storage resolves false', async () => {
    mockLoad.mockResolvedValue(false);
    const { result } = renderHook(() => useTokenImagesEnabled());
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('returns true when storage resolves true', async () => {
    mockLoad.mockResolvedValue(true);
    const { result } = renderHook(() => useTokenImagesEnabled());
    await act(async () => {});
    expect(result.current).toBe(true);
  });
});
