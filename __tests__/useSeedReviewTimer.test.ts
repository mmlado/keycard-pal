import { act, renderHook } from '@testing-library/react-native';

import { SEED_REVIEW_SECONDS } from '../src/constants/backup';
import { useSeedReviewTimer } from '../src/hooks/useSeedReviewTimer';

jest.useFakeTimers();

describe('useSeedReviewTimer', () => {
  it('starts with full time and not done', () => {
    const { result } = renderHook(() => useSeedReviewTimer());
    expect(result.current.timeLeft).toBe(SEED_REVIEW_SECONDS);
    expect(result.current.done).toBe(false);
  });

  it('counts down each second after start()', () => {
    const { result } = renderHook(() => useSeedReviewTimer());
    act(() => {
      result.current.start();
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.timeLeft).toBe(SEED_REVIEW_SECONDS - 1);
    expect(result.current.done).toBe(false);
  });

  it('sets done=true when timer expires', () => {
    const { result } = renderHook(() => useSeedReviewTimer());
    act(() => {
      result.current.start();
    });
    act(() => {
      jest.advanceTimersByTime(SEED_REVIEW_SECONDS * 1000);
    });
    expect(result.current.timeLeft).toBe(0);
    expect(result.current.done).toBe(true);
  });

  it('resets and restarts when start() is called again', () => {
    const { result } = renderHook(() => useSeedReviewTimer());
    act(() => {
      result.current.start();
    });
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    act(() => {
      result.current.start();
    });
    expect(result.current.timeLeft).toBe(SEED_REVIEW_SECONDS);
    expect(result.current.done).toBe(false);
  });
});
