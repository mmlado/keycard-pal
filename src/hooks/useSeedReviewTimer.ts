import { useCallback, useEffect, useRef, useState } from 'react';

import { SEED_REVIEW_SECONDS } from '../constants/backup';

export interface SeedReviewTimer {
  timeLeft: number;
  done: boolean;
  start: () => void;
}

export function useSeedReviewTimer(
  seconds: number = SEED_REVIEW_SECONDS,
): SeedReviewTimer {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeLeft(seconds);
    setDone(false);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [seconds]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { timeLeft, done, start };
}
