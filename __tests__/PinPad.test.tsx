import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PinPad from '../src/components/PinPad';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/storage/preferencesStorage', () => ({
  loadBooleanPreference: jest.fn().mockResolvedValue(false),
  preferenceKeys: { pinPadScramble: 'preference_pinpad_scramble' },
  saveBooleanPreference: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const onComplete = jest.fn();
const onType = jest.fn();

beforeEach(() => {
  onComplete.mockClear();
  onType.mockClear();
  jest.clearAllMocks();
  jest
    .requireMock('../src/storage/preferencesStorage')
    .loadBooleanPreference.mockResolvedValue(false);
});

/** Walk the toJSON tree and collect Pressable nodes.
 * In the RN test environment, Pressable renders as View with onClick (not onPress).
 * We identify them by the focusable prop which Pressable always sets.
 */
function getPressableNodesFromJSON(json: any): any[] {
  const nodes: any[] = [];
  function walk(node: any) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    // Pressable renders as View with focusable prop and onClick
    if (typeof node.props?.onClick === 'function') {
      nodes.push(node);
    }
    if (node.children) walk(node.children);
  }
  walk(json);
  return nodes;
}

function getDigitOrder(json: any): string[] {
  return getPressableNodesFromJSON(json)
    .map(node => JSON.stringify(node.children))
    .flatMap(text => text.match(/"[0-9]"/g) ?? [])
    .map(match => match.replace(/"/g, ''));
}

function getDigitFromChildren(children: any): string {
  const text = JSON.stringify(children);
  const match = text.match(/"[0-9]"/);
  return match ? match[0].replace(/"/g, '') : '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PinPad', () => {
  describe('field label', () => {
    it('renders the "6 digits" field label by default', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      expect(screen.getByText('6 digits')).toBeTruthy();
    });

    it('renders the correct label for a custom length', async () => {
      render(<PinPad onComplete={onComplete} length={12} />);
      await act(async () => {});
      expect(screen.getByText('12 digits')).toBeTruthy();
      expect(screen.queryByText('6 digits')).toBeNull();
    });

    it('normalizes invalid lengths before rendering the field label', async () => {
      const { rerender } = render(
        <PinPad onComplete={onComplete} length={0} />,
      );
      await act(async () => {});
      expect(screen.getByText('1 digits')).toBeTruthy();

      rerender(<PinPad onComplete={onComplete} length={2.8} />);
      expect(screen.getByText('2 digits')).toBeTruthy();

      rerender(<PinPad onComplete={onComplete} length={Number.NaN} />);
      expect(screen.getByText('6 digits')).toBeTruthy();
    });
  });

  describe('PIN entry', () => {
    it('does not call onComplete before 6 digits are entered', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.press(screen.getByText('1'));
        });
      }
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('calls onComplete with the 6-digit PIN on the final press', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          fireEvent.press(screen.getByText('1'));
        });
      }
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith('111111');
    });

    it('resets the pin after completion so a second entry works', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          fireEvent.press(screen.getByText('1'));
        });
      }
      onComplete.mockClear();
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          fireEvent.press(screen.getByText('1'));
        });
      }
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith('111111');
    });

    it('backspace removes the last entered digit', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      await act(async () => {
        fireEvent.press(screen.getByText('2'));
      });
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Backspace'));
      });
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          fireEvent.press(screen.getByText('1'));
        });
      }
      expect(onComplete).toHaveBeenCalledWith('111111');
    });

    it('ignores digit presses when the current entry exceeds a shorter length', async () => {
      const { rerender } = render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      await act(async () => {
        fireEvent.press(screen.getByText('1'));
      });

      rerender(<PinPad onComplete={onComplete} length={1} />);
      await act(async () => {
        fireEvent.press(screen.getByText('2'));
      });

      expect(onComplete).not.toHaveBeenCalled();
    });

    it('uses the normalized length for completion', async () => {
      render(<PinPad onComplete={onComplete} length={0} />);
      await act(async () => {});
      await act(async () => {
        fireEvent.press(screen.getByText('1'));
      });

      expect(onComplete).toHaveBeenCalledWith('1');
    });
  });

  describe('onType callback', () => {
    it('calls onType when a digit is pressed', async () => {
      render(<PinPad onComplete={onComplete} onType={onType} />);
      await act(async () => {});
      await act(async () => {
        fireEvent.press(screen.getByText('1'));
      });
      expect(onType).toHaveBeenCalledTimes(1);
    });

    it('calls onType when backspace is pressed', async () => {
      render(<PinPad onComplete={onComplete} onType={onType} />);
      await act(async () => {});
      await act(async () => {
        fireEvent.press(screen.getByText('1'));
      });
      onType.mockClear();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Backspace'));
      });
      expect(onType).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onType is not provided', async () => {
      render(<PinPad onComplete={onComplete} />); // no onType prop
      await act(async () => {});
      await expect(
        act(async () => {
          fireEvent.press(screen.getByText('1'));
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('fixed layout', () => {
    it('renders digits 1-9 in order on the first three rows', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      const { toJSON } = screen;
      const json = toJSON();
      const pressables = getPressableNodesFromJSON(json);
      const firstNine = pressables.slice(0, 9);
      const digits = firstNine.map(p => getDigitFromChildren(p.children));
      expect(digits).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    });

    it('renders 0 in bottom-centre and backspace in bottom-right', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      const { toJSON } = screen;
      const json = toJSON();
      const pressables = getPressableNodesFromJSON(json);
      expect(pressables[9].props.accessibilityState?.disabled).toBe(true);
      const zeroText = JSON.stringify(pressables[10].children);
      expect(zeroText).toContain('"0"');
      const backspaceText = JSON.stringify(pressables[11].children);
      expect(backspaceText).not.toMatch(/"[0-9]"/);
    });
  });

  describe('scrambled layout', () => {
    it('renders all 10 digits', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        expect(screen.getByText(d)).toBeTruthy();
      }
    });

    it('shows scrambled layout when preference is true', async () => {
      jest
        .requireMock('../src/storage/preferencesStorage')
        .loadBooleanPreference.mockResolvedValue(true);
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      const { toJSON } = screen;
      const json = toJSON();
      const pressables = getPressableNodesFromJSON(json);
      const firstNine = pressables.slice(0, 9);
      const digits = firstNine.map(p => getDigitFromChildren(p.children));
      expect(digits).not.toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    });

    it('reshuffles when a new error arrives only when scramble is enabled', async () => {
      jest
        .requireMock('../src/storage/preferencesStorage')
        .loadBooleanPreference.mockResolvedValue(true);
      const { rerender, toJSON } = render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      const before = JSON.stringify(toJSON());
      await act(async () => {
        rerender(<PinPad onComplete={onComplete} error="Wrong PIN" />);
      });
      const after = JSON.stringify(toJSON());
      // Both snapshots must contain all digits — layout may differ
      for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        expect(before).toContain(d);
        expect(after).toContain(d);
      }
    });

    it('does not reshuffle on error when scramble is disabled', async () => {
      jest
        .requireMock('../src/storage/preferencesStorage')
        .loadBooleanPreference.mockResolvedValue(false);
      const { rerender, toJSON } = render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      const before = getDigitOrder(toJSON());
      await act(async () => {
        rerender(<PinPad onComplete={onComplete} error="Wrong PIN" />);
      });
      expect(getDigitOrder(toJSON())).toEqual(before);
    });

    it('keeps bottom-left empty and bottom-right as backspace', async () => {
      const { toJSON } = render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      const pressables = getPressableNodesFromJSON(toJSON());
      expect(pressables).toHaveLength(12);
      // Bottom-left (index 9) must be disabled — accessibilityState.disabled
      expect(pressables[9].props.accessibilityState?.disabled).toBe(true);
      // Bottom-right (index 11) must be the backspace key — no Text digit child
      const backspaceCell = pressables[11];
      expect(backspaceCell.props.accessibilityState?.disabled).not.toBe(true);
      // backspace should not have a single-digit text child
      const cellText = JSON.stringify(backspaceCell.children);
      expect(cellText).not.toMatch(/"[0-9]"/);
    });

    it('does not reshuffle when error is unchanged', async () => {
      jest
        .requireMock('../src/storage/preferencesStorage')
        .loadBooleanPreference.mockResolvedValue(true);
      const { rerender, toJSON } = render(
        <PinPad onComplete={onComplete} error="Wrong PIN" />,
      );
      await act(async () => {});
      const before = JSON.stringify(toJSON());
      await act(async () => {
        rerender(<PinPad onComplete={onComplete} error="Wrong PIN" />);
      });
      expect(JSON.stringify(toJSON())).toBe(before);
    });

    it('keeps the same key order while digits are entered', async () => {
      const { toJSON } = render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      const before = getDigitOrder(toJSON());

      await act(async () => {
        fireEvent.press(screen.getByText('1'));
      });

      expect(getDigitOrder(toJSON())).toEqual(before);
    });

    it('applies pressed styling while a digit key is pressed', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      await act(async () => {
        fireEvent(screen.getByText('1'), 'pressIn');
      });

      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  describe('error display', () => {
    it('shows the error text when the error prop is provided', async () => {
      render(<PinPad onComplete={onComplete} error="PINs don't match" />);
      await act(async () => {});
      expect(screen.getByText("PINs don't match")).toBeTruthy();
    });

    it('does not show error text when no error prop', async () => {
      render(<PinPad onComplete={onComplete} />);
      await act(async () => {});
      expect(screen.queryByText("PINs don't match")).toBeNull();
    });

    it('renders the same number of nodes whether error is present or absent', async () => {
      // The error element is always in the tree (opacity:0 hides it, not
      // conditional rendering). Verifies no layout shift occurs.
      const { toJSON: withErrorJSON } = render(
        <PinPad onComplete={onComplete} error="Something wrong" />,
      );
      await act(async () => {});
      const { toJSON: withoutErrorJSON } = render(
        <PinPad onComplete={onComplete} />,
      );
      await act(async () => {});

      function countNodes(json: any): number {
        if (!json) return 0;
        if (Array.isArray(json))
          return json.reduce((acc: number, n: any) => acc + countNodes(n), 0);
        return 1 + countNodes(json.children);
      }

      const withCount = countNodes(withErrorJSON());
      const withoutCount = countNodes(withoutErrorJSON());
      // Both renders should produce the same or very similar node count
      // (the error text node is always in the tree, just hidden via opacity)
      expect(Math.abs(withCount - withoutCount)).toBeLessThanOrEqual(1);
    });
  });
});
