import { act, renderHook } from '@testing-library/react-native';

import { useRegistryAnswer } from '../src/hooks/useRegistryAnswer';
import { setSavedIndex } from '../src/utils/eip7730/lookup';
import type { Eip7730DisplayFormat } from '../src/utils/eip7730/zip';

const SEND: Eip7730DisplayFormat = { intent: 'Send', fields: [] };
const OTHER: Eip7730DisplayFormat = { intent: 'Other', fields: [] };

function deferred() {
  let resolve: (format: Eip7730DisplayFormat | null) => void = () => {};
  const promise = new Promise<Eip7730DisplayFormat | null>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

afterEach(() => setSavedIndex(null));

describe('useRegistryAnswer', () => {
  it('uses an answer that is there at once, without a loading state', () => {
    const lookup = jest.fn(() => SEND);
    const { result } = renderHook(() => useRegistryAnswer(lookup));
    expect(result.current).toEqual({ answer: SEND, loading: false });
  });

  it('reports none at once when there is no descriptor', () => {
    const { result } = renderHook(() => useRegistryAnswer(() => null));
    expect(result.current).toEqual({ answer: null, loading: false });
  });

  it('is loading while a slice is read, then shows what it found', async () => {
    const read = deferred();
    const lookup = () => read.promise;
    const { result } = renderHook(() => useRegistryAnswer(lookup));
    expect(result.current).toEqual({ answer: null, loading: true });

    await act(async () => read.resolve(SEND));
    expect(result.current).toEqual({ answer: SEND, loading: false });
  });

  it('asks again when the source changes', () => {
    const lookup = jest.fn(() => SEND);
    renderHook(() => useRegistryAnswer(lookup));
    expect(lookup).toHaveBeenCalledTimes(1);

    act(() => setSavedIndex({ generatedAt: '2026-10-12T00:00:00.000Z' }));
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('ignores an answer for a lookup that was replaced', async () => {
    const first = deferred();
    const second = deferred();
    let current = first.promise;
    const { result, rerender } = renderHook(
      ({ lookup }: { lookup: () => Promise<Eip7730DisplayFormat | null> }) =>
        useRegistryAnswer(lookup),
      { initialProps: { lookup: () => current } },
    );
    current = second.promise;
    rerender({ lookup: () => current });

    await act(async () => first.resolve(OTHER));
    expect(result.current).toEqual({ answer: null, loading: true });

    await act(async () => second.resolve(SEND));
    expect(result.current).toEqual({ answer: SEND, loading: false });
  });
});
