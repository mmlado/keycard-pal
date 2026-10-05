import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PukReview, {
  PUK_EXPLAINER,
  formatPUK,
} from '../src/components/PukReview';
import { PUK_REVIEW_SECONDS } from '../src/constants/backup';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../src/hooks/useSeedReviewTimer', () => ({
  useSeedReviewTimer: jest.fn(),
}));
const useSeedReviewTimerMock = require('../src/hooks/useSeedReviewTimer')
  .useSeedReviewTimer as jest.Mock;

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('@react-native-community/blur', () => ({
  BlurView: 'BlurView',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PUK = '123456789012';
const onDone = jest.fn();

type Timer = { timeLeft: number; done: boolean; start: jest.Mock };

function renderReview(
  timer: Timer = { timeLeft: 0, done: true, start: jest.fn() },
) {
  useSeedReviewTimerMock.mockReturnValue(timer);
  return render(<PukReview puk={PUK} onDone={onDone} />);
}

async function reveal() {
  await act(async () => {
    fireEvent.press(screen.getByText('Reveal PUK'));
  });
}

function primaryButton() {
  return screen.getByTestId('primary-button');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatPUK', () => {
  it('groups the digits in fours', () => {
    expect(formatPUK(PUK)).toBe('1234 5678 9012');
  });
});

describe('PukReview', () => {
  beforeEach(() => {
    onDone.mockClear();
    useSeedReviewTimerMock.mockClear();
  });

  it('says what the PUK is for', () => {
    renderReview();
    expect(screen.getByText(PUK_EXPLAINER)).toBeTruthy();
  });

  it('shows the digits in fours, blurred until revealed', async () => {
    renderReview();
    expect(screen.getByText('1234 5678 9012')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(1);
    await reveal();
    expect(screen.UNSAFE_queryAllByType('BlurView' as any)).toHaveLength(0);
  });

  // Twelve digits, not twelve words: a shorter wait than the phrase's.
  it('asks for a 10-second review', () => {
    renderReview();
    expect(PUK_REVIEW_SECONDS).toBe(10);
    expect(useSeedReviewTimerMock).toHaveBeenCalledWith(PUK_REVIEW_SECONDS);
  });

  it('starts the review timer on reveal, not before', async () => {
    const timer = { timeLeft: 10, done: false, start: jest.fn() };
    renderReview(timer);
    expect(timer.start).not.toHaveBeenCalled();
    await reveal();
    expect(timer.start).toHaveBeenCalledTimes(1);
  });

  it('counts down on a disabled button while the timer runs', async () => {
    renderReview({ timeLeft: 7, done: false, start: jest.fn() });
    await reveal();
    expect(screen.getByText('Write down your PUK (7s)')).toBeTruthy();
    expect(primaryButton().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(primaryButton());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('acknowledges only once the timer is done', async () => {
    renderReview();
    await reveal();
    expect(onDone).not.toHaveBeenCalled();
    expect(primaryButton().props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByText("I've written it down"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
