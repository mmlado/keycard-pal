import {
  clearUnverifiedCardApproval,
  isUnverifiedCardApprovalPending,
  noteUnverifiedCardApproved,
  subscribeUnverifiedCardApproval,
} from '../src/utils/unverifiedCardApproval';

afterEach(() => {
  clearUnverifiedCardApproval();
});

describe('unverifiedCardApproval', () => {
  it('starts with nothing pending', () => {
    expect(isUnverifiedCardApprovalPending()).toBe(false);
  });

  it('is pending after an approval and clears', () => {
    noteUnverifiedCardApproved();
    expect(isUnverifiedCardApprovalPending()).toBe(true);
    clearUnverifiedCardApproval();
    expect(isUnverifiedCardApprovalPending()).toBe(false);
  });

  it('tells listeners only when the value changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeUnverifiedCardApproval(listener);
    noteUnverifiedCardApproved();
    noteUnverifiedCardApproved();
    clearUnverifiedCardApproval();
    clearUnverifiedCardApproval();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    noteUnverifiedCardApproved();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
