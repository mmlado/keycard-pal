import {
  getLastTappedGeneration,
  noteTappedGeneration,
  resetLastTappedGeneration,
  subscribeLastTappedGeneration,
} from '../src/utils/lastTappedGeneration';

beforeEach(() => {
  resetLastTappedGeneration();
});

describe('lastTappedGeneration', () => {
  it('knows nothing until a card is tapped', () => {
    expect(getLastTappedGeneration()).toBeNull();
  });

  it('remembers the most recent tap only', () => {
    noteTappedGeneration('3.1');
    noteTappedGeneration('4.0');
    expect(getLastTappedGeneration()).toBe('4.0');
  });

  it('tells subscribers when the generation changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLastTappedGeneration(listener);
    noteTappedGeneration('3.1');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  // Most taps are the same card again; nothing changed, so nothing re-renders.
  it('stays quiet when the same generation is tapped again', () => {
    noteTappedGeneration('3.1');
    const listener = jest.fn();
    const unsubscribe = subscribeLastTappedGeneration(listener);
    noteTappedGeneration('3.1');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops telling a subscriber that left', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLastTappedGeneration(listener);
    unsubscribe();
    noteTappedGeneration('4.0');
    expect(listener).not.toHaveBeenCalled();
  });

  it('forgets on reset and says so', () => {
    noteTappedGeneration('4.0');
    const listener = jest.fn();
    const unsubscribe = subscribeLastTappedGeneration(listener);
    resetLastTappedGeneration();
    expect(getLastTappedGeneration()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stays quiet when there is nothing to forget', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLastTappedGeneration(listener);
    resetLastTappedGeneration();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
