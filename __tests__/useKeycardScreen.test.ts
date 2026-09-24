import { renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import {
  useKeycardScreen,
  type UseKeycardScreenOptions,
} from '../src/hooks/useKeycardScreen';

jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return {
    // Run the focus effect like a focused screen would.
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(cb, [cb]);
    },
  };
});

function makeNavigation() {
  return {
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
}

function makeKeycard(phase: string, result: unknown = null) {
  return { phase: phase as any, result, cancel: jest.fn() };
}

// React Navigation asks the screen that is about to go first: both reset() and
// goBack() fire its beforeRemove listeners, and a listener that calls
// preventDefault cancels the navigation. A bare jest.fn() never does that,
// which is how a screen whose own back guard vetoed its own departure went
// unnoticed. `left` records the navigations that survived.
function makeNavigationThatAsksFirst() {
  const listeners: ((e: { preventDefault: () => void }) => void)[] = [];
  const left = jest.fn();
  const ask = (state?: unknown) => {
    let prevented = false;
    const e = {
      preventDefault: () => {
        prevented = true;
      },
    };
    listeners.forEach(listener => listener(e));
    if (!prevented) {
      left(state);
    }
  };
  const navigation = {
    goBack: jest.fn(() => ask()),
    setOptions: jest.fn(),
    addListener: jest.fn((_type: string, listener: (e: any) => void) => {
      listeners.push(listener);
      return jest.fn();
    }),
    reset: jest.fn(ask),
  };
  return { navigation, left };
}

/** A step machine like InitCardScreen's: back steps the form, never leaves. */
function stepGuard() {
  return jest.fn((e: { preventDefault: () => void }) => e.preventDefault());
}

function renderScreenHook(options: UseKeycardScreenOptions) {
  return renderHook(
    (props: UseKeycardScreenOptions) => useKeycardScreen(props),
    {
      initialProps: options,
    },
  );
}

function capturedBackHandler(spy: jest.SpyInstance): () => boolean {
  const call = spy.mock.calls.at(-1);
  return call![1] as () => boolean;
}

function capturedBeforeRemove(navigation: ReturnType<typeof makeNavigation>) {
  const call = navigation.addListener.mock.calls.at(-1) as unknown as [
    string,
    (e: { preventDefault: () => void }) => void,
  ];
  expect(call[0]).toBe('beforeRemove');
  return call[1];
}

let backSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  backSpy = jest.spyOn(BackHandler, 'addEventListener');
});

afterEach(() => {
  backSpy.mockRestore();
});

describe('done navigation', () => {
  it('resets to Dashboard with the toast when phase is done', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('done', 'ok'),
      navigation,
      title: 'T',
      done: { toast: 'All set' },
    });
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: 'All set' } }],
    });
  });

  it('computes the toast from the result', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('done', 'match'),
      navigation,
      title: 'T',
      done: {
        toast: r => (r === 'match' ? 'Matches' : 'Does not match'),
      },
    });
    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: [{ name: 'Dashboard', params: { toast: 'Matches' } }],
      }),
    );
  });

  it('requireResult blocks navigation while result is null', () => {
    const navigation = makeNavigation();
    const { rerender } = renderScreenHook({
      keycard: makeKeycard('done', null),
      navigation,
      title: 'T',
      done: { toast: 'Done', requireResult: true },
    });
    expect(navigation.reset).not.toHaveBeenCalled();

    rerender({
      keycard: makeKeycard('done', 'puk'),
      navigation,
      title: 'T',
      done: { toast: 'Done', requireResult: true },
    });
    expect(navigation.reset).toHaveBeenCalledTimes(1);
  });

  it('does nothing on done without a done option', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('done', 'x'),
      navigation,
      title: 'T',
    });
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('does not navigate before done', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('nfc'),
      navigation,
      title: 'T',
      done: { toast: 'Done' },
    });
    expect(navigation.reset).not.toHaveBeenCalled();
  });
});

describe('header title', () => {
  it('uses the base title outside PIN entry', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'Factory reset',
    });
    expect(navigation.setOptions).toHaveBeenCalledWith({
      title: 'Factory reset',
    });
  });

  it("defaults to 'Enter Keycard PIN' during PIN entry", () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('pin_entry'),
      navigation,
      title: 'Factory reset',
    });
    expect(navigation.setOptions).toHaveBeenCalledWith({
      title: 'Enter Keycard PIN',
    });
  });

  it('uses pinEntryTitle during PIN entry when provided', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('pin_entry'),
      navigation,
      title: 'Enter new PIN',
      pinEntryTitle: 'Enter current PIN',
    });
    expect(navigation.setOptions).toHaveBeenCalledWith({
      title: 'Enter current PIN',
    });
  });
});

describe('onCancel', () => {
  it('cancels and goes back by default', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    const { result } = renderScreenHook({
      keycard,
      navigation,
      title: 'T',
    });
    result.current.onCancel();
    expect(keycard.cancel).toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('only cancels with stayOnCancel', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    const { result } = renderScreenHook({
      keycard,
      navigation,
      title: 'T',
      stayOnCancel: true,
    });
    result.current.onCancel();
    expect(keycard.cancel).toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

describe('back guard', () => {
  it('hardware back during an active tap cancels the session and pops', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    renderScreenHook({ keycard, navigation, title: 'T' });

    const handled = capturedBackHandler(backSpy)();

    expect(handled).toBe(true);
    expect(keycard.cancel).toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('hardware back during PIN entry cancels too', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('pin_entry');
    renderScreenHook({ keycard, navigation, title: 'T' });

    expect(capturedBackHandler(backSpy)()).toBe(true);
    expect(keycard.cancel).toHaveBeenCalled();
  });

  it('hardware back when idle defers to the screen fallback', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const onHardwareBack = jest.fn(() => true);
    renderScreenHook({ keycard, navigation, title: 'T', onHardwareBack });

    expect(capturedBackHandler(backSpy)()).toBe(true);
    expect(onHardwareBack).toHaveBeenCalled();
    expect(keycard.cancel).not.toHaveBeenCalled();
  });

  it('hardware back when idle without a fallback lets the system handle it', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
    });
    expect(capturedBackHandler(backSpy)()).toBe(false);
  });

  it('beforeRemove during an active tap cancels without preventing removal', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    const onBeforeRemove = jest.fn();
    renderScreenHook({ keycard, navigation, title: 'T', onBeforeRemove });

    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation)(e);

    expect(keycard.cancel).toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(onBeforeRemove).not.toHaveBeenCalled();
  });

  it('beforeRemove when idle defers to the screen fallback', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const onBeforeRemove = jest.fn(e => e.preventDefault());
    renderScreenHook({ keycard, navigation, title: 'T', onBeforeRemove });

    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation)(e);

    expect(onBeforeRemove).toHaveBeenCalledWith(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(keycard.cancel).not.toHaveBeenCalled();
  });
});

describe('done navigation against a screen with its own back guard', () => {
  // Mounted mid-operation and then finished, the way a real screen gets there:
  // the back guard is long registered by the time the operation is done.
  it('leaves when the operation is done, whatever step the form is on', () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const onBeforeRemove = stepGuard();
    const options = {
      navigation,
      title: 'T',
      done: { toast: 'Card initialized', requireResult: true },
      onBeforeRemove,
    };
    const { rerender } = renderScreenHook({
      ...options,
      keycard: makeKeycard('nfc'),
    });
    expect(left).not.toHaveBeenCalled();

    rerender({ ...options, keycard: makeKeycard('done', '123456123456') });

    expect(left).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: 'Card initialized' } }],
    });
    // The form is not stepped back either: nothing is left to go back to.
    expect(onBeforeRemove).not.toHaveBeenCalled();
  });

  it('still lets the screen veto a real back press before the operation', () => {
    const { navigation } = makeNavigationThatAsksFirst();
    const onBeforeRemove = stepGuard();
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      done: { toast: 'Card initialized' },
      onBeforeRemove,
    });

    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation as any)(e);
    expect(onBeforeRemove).toHaveBeenCalledWith(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('leaves once the operation finishes, after earlier back presses were vetoed', () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const onBeforeRemove = stepGuard();
    const { rerender } = renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      done: { toast: 'PIN changed' },
      onBeforeRemove,
    });
    capturedBeforeRemove(navigation as any)({ preventDefault: jest.fn() });
    expect(left).not.toHaveBeenCalled();

    rerender({
      keycard: makeKeycard('done'),
      navigation,
      title: 'T',
      done: { toast: 'PIN changed' },
      onBeforeRemove,
    });
    expect(left).toHaveBeenCalledTimes(1);
  });
});

// Apple's sheet closes the session itself, so every case below runs with the
// phase already back to 'idle'.
describe("cancel from Apple's NFC sheet", () => {
  it('cancels the tap and leaves the screen', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const options = { keycard, navigation, title: 'T' };
    const { rerender } = renderScreenHook(options);
    expect(keycard.cancel).not.toHaveBeenCalled();

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });

    expect(keycard.cancel).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('only cancels with stayOnCancel', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const options = { keycard, navigation, title: 'T', stayOnCancel: true };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });

    expect(keycard.cancel).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('cancels again when a re-tap is cancelled too', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const options = { keycard, navigation, title: 'T', stayOnCancel: true };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });
    rerender({ ...options, keycard: { ...keycard, userCancels: 2 } });

    expect(keycard.cancel).toHaveBeenCalledTimes(2);
  });

  it('does nothing while the count holds', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    const options = { keycard, navigation, title: 'T' };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 0 } });
    rerender({ ...options, keycard: { ...keycard, phase: 'done' as any } });

    expect(keycard.cancel).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('does not replay a count that is already up at mount', () => {
    const navigation = makeNavigation();
    const keycard = { ...makeKeycard('idle'), userCancels: 3 };
    renderScreenHook({ keycard, navigation, title: 'T' });

    expect(keycard.cancel).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("leaves instead of stepping the screen's own form back", () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const onBeforeRemove = stepGuard();
    const keycard = makeKeycard('idle');
    const options = { keycard, navigation, title: 'T', onBeforeRemove };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });

    expect(keycard.cancel).toHaveBeenCalled();
    expect(onBeforeRemove).not.toHaveBeenCalled();
    expect(left).toHaveBeenCalled();
  });

  it('still lets the screen veto a real back press afterwards', () => {
    const { navigation } = makeNavigationThatAsksFirst();
    const onBeforeRemove = stepGuard();
    const keycard = makeKeycard('idle');
    const options = {
      keycard,
      navigation,
      title: 'T',
      onBeforeRemove,
      stayOnCancel: true,
    };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });
    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation as any)(e);

    expect(onBeforeRemove).toHaveBeenCalledWith(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });
});

describe('activeKeycard override', () => {
  it('guard, title, and cancel key on activeKeycard; done keys on keycard', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const activeKeycard = makeKeycard('nfc');
    const { result } = renderScreenHook({
      keycard,
      navigation,
      title: 'T',
      done: { toast: 'Done' },
      activeKeycard,
    });

    // Guard cancels the ACTIVE hook's tap.
    expect(capturedBackHandler(backSpy)()).toBe(true);
    expect(activeKeycard.cancel).toHaveBeenCalled();
    expect(keycard.cancel).not.toHaveBeenCalled();

    // onCancel also targets the active hook.
    result.current.onCancel();
    expect(activeKeycard.cancel).toHaveBeenCalledTimes(2);

    // Done keyed on keycard (idle) — the active hook finishing must not navigate.
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it("the active hook reaching 'done' does not trigger done-navigation", () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      done: { toast: 'Done' },
      activeKeycard: makeKeycard('done', 'shares'),
    });
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it("Apple's cancel keys on the active hook", () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const activeKeycard = makeKeycard('idle');
    const options = { keycard, navigation, title: 'T', activeKeycard };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });
    expect(navigation.goBack).not.toHaveBeenCalled();

    rerender({
      ...options,
      keycard: { ...keycard, userCancels: 1 },
      activeKeycard: { ...activeKeycard, userCancels: 1 },
    });
    expect(activeKeycard.cancel).toHaveBeenCalledTimes(1);
    expect(keycard.cancel).not.toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  // Slip39Screen hands over from the generate hook to the load hook mid-screen.
  it('does not read a hand-over between hooks as a cancel', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const generate = makeKeycard('idle');
    const options = {
      keycard,
      navigation,
      title: 'T',
      stayOnCancel: true,
    };
    const { rerender } = renderScreenHook({
      ...options,
      activeKeycard: { ...generate, userCancels: 1 },
    });

    rerender({ ...options, activeKeycard: { ...keycard, userCancels: 0 } });
    expect(keycard.cancel).not.toHaveBeenCalled();

    rerender({ ...options, activeKeycard: { ...keycard, userCancels: 1 } });
    expect(keycard.cancel).toHaveBeenCalledTimes(1);
  });

  it("PIN-entry title keys on the active hook's phase", () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'Generate SLIP39 shares',
      activeKeycard: makeKeycard('pin_entry'),
    });
    expect(navigation.setOptions).toHaveBeenCalledWith({
      title: 'Enter Keycard PIN',
    });
  });
});
