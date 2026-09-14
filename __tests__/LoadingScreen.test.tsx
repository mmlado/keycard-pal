import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import LoadingScreen, {
  LOADING_FADE_MS,
} from '../src/components/LoadingScreen';
import { APP_VERSION } from '../src/constants/app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const onHidden = jest.fn();

function opacityOf(node: { props: { style: unknown } }): number {
  const flat = Object.assign({}, ...[node.props.style].flat(Infinity));
  const { opacity } = flat;
  // Animated.Value in the test renderer; a plain number once flattened.
  return typeof opacity === 'number' ? opacity : opacity.__getValue();
}

function loadingScreen() {
  return screen.getByTestId('loading-screen');
}

beforeEach(() => {
  onHidden.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoadingScreen', () => {
  it('shows the Keycard, the app name and the version', () => {
    render(<LoadingScreen visible onHidden={onHidden} />);
    expect(screen.getByLabelText('Keycard')).toBeTruthy();
    expect(screen.getByText('Keycard Pal')).toBeTruthy();
    expect(screen.getByText(`v${APP_VERSION}`)).toBeTruthy();
  });

  it('stays fully opaque and does not report while visible', () => {
    render(<LoadingScreen visible onHidden={onHidden} />);
    act(() => {
      jest.advanceTimersByTime(LOADING_FADE_MS * 2);
    });
    expect(opacityOf(loadingScreen())).toBe(1);
    expect(onHidden).not.toHaveBeenCalled();
  });

  // The fade reveals the screen painted underneath; the owner unmounts the
  // overlay only once it reports, so nothing pops. (Under Jest the native
  // driver mock finishes the animation on the next frame rather than in real
  // time, so only "not before the fade" and "once after it" are observable.)
  it('reports hidden once the fade has run, not before', () => {
    const { rerender } = render(<LoadingScreen visible onHidden={onHidden} />);
    rerender(<LoadingScreen visible={false} onHidden={onHidden} />);
    expect(onHidden).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(LOADING_FADE_MS * 2);
    });
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  // The screen underneath owns the touches from the first fading frame.
  it('lets touches through as soon as the fade starts', () => {
    const { rerender } = render(<LoadingScreen visible onHidden={onHidden} />);
    expect(loadingScreen().props.pointerEvents).toBe('auto');

    rerender(<LoadingScreen visible={false} onHidden={onHidden} />);
    expect(loadingScreen().props.pointerEvents).toBe('none');
  });

  it('calls the latest onHidden, not the one the fade started with', () => {
    const late = jest.fn();
    const { rerender } = render(<LoadingScreen visible onHidden={onHidden} />);
    rerender(<LoadingScreen visible={false} onHidden={onHidden} />);
    rerender(<LoadingScreen visible={false} onHidden={late} />);

    act(() => {
      jest.advanceTimersByTime(LOADING_FADE_MS * 2);
    });
    expect(late).toHaveBeenCalledTimes(1);
    expect(onHidden).not.toHaveBeenCalled();
  });

  it('does not report after being unmounted mid-fade', () => {
    const { rerender, unmount } = render(
      <LoadingScreen visible onHidden={onHidden} />,
    );
    rerender(<LoadingScreen visible={false} onHidden={onHidden} />);
    unmount();

    act(() => {
      jest.advanceTimersByTime(LOADING_FADE_MS * 2);
    });
    expect(onHidden).not.toHaveBeenCalled();
  });
});
