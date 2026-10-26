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

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));

function makeNavigation() {
  return {
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
}

function makeKeycard(phase: string, result: unknown = null) {
  return {
    phase: phase as any,
    status: '',
    cardPresence: 'waiting' as const,
    retry: jest.fn(),
    openNFCSettings: undefined,
    userCancels: 0,
    result,
    cancel: jest.fn(),
  };
}

// reset() and goBack() ask the beforeRemove listeners first, as React
// Navigation does; a bare jest.fn() cannot catch a screen vetoing its own
// departure. `left` records what went through.
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
  return jest.fn(() => true);
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

  it("toasts the operation's own success message when the screen names none", () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: { ...makeKeycard('done', 'ok'), successMessage: 'Card named' },
      navigation,
      title: 'T',
      done: {},
    });
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: 'Card named' } }],
    });
  });

  it("prefers the screen's toast to the operation's success message", () => {
    const navigation = makeNavigation();
    renderScreenHook({
      keycard: { ...makeKeycard('done', 'ok'), successMessage: 'Card named' },
      navigation,
      title: 'T',
      done: { toast: 'All set' },
    });
    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: [{ name: 'Dashboard', params: { toast: 'All set' } }],
      }),
    );
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

  it('leaves through leaveOnCancel instead of going back', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    const leaveOnCancel = jest.fn();
    const { result } = renderScreenHook({
      keycard,
      navigation,
      title: 'T',
      leaveOnCancel,
    });
    result.current.onCancel();
    expect(keycard.cancel).toHaveBeenCalled();
    expect(leaveOnCancel).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('stayOnCancel wins over leaveOnCancel', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    const leaveOnCancel = jest.fn();
    const { result } = renderScreenHook({
      keycard,
      navigation,
      title: 'T',
      stayOnCancel: true,
      leaveOnCancel,
    });
    result.current.onCancel();
    expect(keycard.cancel).toHaveBeenCalled();
    expect(leaveOnCancel).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  // Cancel on the error sheet: the tap is no longer busy, so only leavingRef keeps stepBack out.
  it("leaves from an error past the screen's step guard", () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const stepBack = stepGuard();
    const keycard = makeKeycard('error');
    const { result } = renderScreenHook({
      keycard,
      navigation,
      title: 'T',
      stepBack,
    });
    result.current.onCancel();
    expect(keycard.cancel).toHaveBeenCalled();
    expect(stepBack).not.toHaveBeenCalled();
    expect(left).toHaveBeenCalledTimes(1);
  });
});

describe('sheet', () => {
  it('takes the active hook, onCancel and the sheet options', () => {
    const navigation = makeNavigation();
    const activeKeycard = makeKeycard('nfc');
    const { result } = renderScreenHook({
      keycard: makeKeycard('idle'),
      activeKeycard,
      navigation,
      title: 'T',
      showOnDone: true,
      hideNoCardExit: true,
    });
    expect(result.current.sheet.props).toEqual({
      nfc: activeKeycard,
      onCancel: result.current.onCancel,
      showOnDone: true,
      hideNoCardExit: true,
    });
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

  it('hardware back during a tap stays with stayOnCancel', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('nfc');
    renderScreenHook({ keycard, navigation, title: 'T', stayOnCancel: true });

    expect(capturedBackHandler(backSpy)()).toBe(true);
    expect(keycard.cancel).toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('hardware back during a tap leaves through leaveOnCancel', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('pin_entry');
    const leaveOnCancel = jest.fn();
    renderScreenHook({ keycard, navigation, title: 'T', leaveOnCancel });

    expect(capturedBackHandler(backSpy)()).toBe(true);
    expect(keycard.cancel).toHaveBeenCalled();
    expect(leaveOnCancel).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('hardware back when idle steps the screen back', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const stepBack = jest.fn(() => true);
    renderScreenHook({ keycard, navigation, title: 'T', stepBack });

    expect(capturedBackHandler(backSpy)()).toBe(true);
    expect(stepBack).toHaveBeenCalled();
    expect(keycard.cancel).not.toHaveBeenCalled();
  });

  it('hardware back with nothing to step back lets the system go back', () => {
    const navigation = makeNavigation();
    const stepBack = jest.fn(() => false);
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      stepBack,
    });

    expect(capturedBackHandler(backSpy)()).toBe(false);
    expect(stepBack).toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('hardware back when idle without stepBack lets the system handle it', () => {
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
    const stepBack = jest.fn(() => true);
    renderScreenHook({ keycard, navigation, title: 'T', stepBack });

    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation)(e);

    expect(keycard.cancel).toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(stepBack).not.toHaveBeenCalled();
  });

  it('beforeRemove when idle stays when the screen steps back', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const stepBack = jest.fn(() => true);
    renderScreenHook({ keycard, navigation, title: 'T', stepBack });

    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation)(e);

    expect(stepBack).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(keycard.cancel).not.toHaveBeenCalled();
  });

  it('beforeRemove lets the screen go when nothing is left to step back', () => {
    const navigation = makeNavigation();
    const stepBack = jest.fn(() => false);
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      stepBack,
    });

    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation)(e);

    expect(stepBack).toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  // Hardware back on the first step: the system's goBack fires beforeRemove.
  it('one stepBack answers hardware back and the removal it leads to', () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    let onConfirmStep = true;
    const stepBack = jest.fn(() => {
      const stepped = onConfirmStep;
      onConfirmStep = false;
      return stepped;
    });
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      stepBack,
    });
    const back = capturedBackHandler(backSpy);

    expect(back()).toBe(true);
    expect(left).not.toHaveBeenCalled();

    expect(back()).toBe(false);
    navigation.goBack();
    expect(left).toHaveBeenCalledTimes(1);
  });
});

describe('done navigation against a screen with its own back guard', () => {
  // Mounted mid-operation and then finished, the way a real screen gets there:
  // the back guard is long registered by the time the operation is done.
  it('leaves when the operation is done, whatever step the form is on', () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const stepBack = stepGuard();
    const options = {
      navigation,
      title: 'T',
      done: { toast: 'Card initialized', requireResult: true },
      stepBack,
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
    expect(stepBack).not.toHaveBeenCalled();
  });

  it('still lets the screen veto a real back press before the operation', () => {
    const { navigation } = makeNavigationThatAsksFirst();
    const stepBack = stepGuard();
    renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      done: { toast: 'Card initialized' },
      stepBack,
    });

    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation as any)(e);
    expect(stepBack).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('leaves once the operation finishes, after earlier back presses were vetoed', () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const stepBack = stepGuard();
    const { rerender } = renderScreenHook({
      keycard: makeKeycard('idle'),
      navigation,
      title: 'T',
      done: { toast: 'PIN changed' },
      stepBack,
    });
    capturedBeforeRemove(navigation as any)({ preventDefault: jest.fn() });
    expect(left).not.toHaveBeenCalled();

    rerender({
      keycard: makeKeycard('done'),
      navigation,
      title: 'T',
      done: { toast: 'PIN changed' },
      stepBack,
    });
    expect(left).toHaveBeenCalledTimes(1);
  });
});

// hold: the screen stays on done; every way off it is the Dashboard reset.
describe('held screen', () => {
  const options = {
    title: 'T',
    done: { toast: 'Card initialized' },
    hold: true,
  };
  const dashboard = {
    index: 0,
    routes: [{ name: 'Dashboard', params: { toast: 'Card initialized' } }],
  };

  it('does not navigate on done', () => {
    const navigation = makeNavigation();
    renderScreenHook({ ...options, keycard: makeKeycard('done'), navigation });
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('leave() resets to Dashboard with the toast, past the screen guard', () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const stepBack = stepGuard();
    const { result } = renderScreenHook({
      ...options,
      keycard: makeKeycard('done'),
      navigation,
      stepBack,
    });
    result.current.leave();
    expect(left).toHaveBeenCalledWith(dashboard);
    expect(stepBack).not.toHaveBeenCalled();
  });

  it('leave() computes the toast from the result', () => {
    const navigation = makeNavigation();
    const { result } = renderScreenHook({
      keycard: makeKeycard('done', 'match'),
      navigation,
      title: 'T',
      done: { toast: r => (r === 'match' ? 'Matches' : 'No') },
      hold: true,
    });
    result.current.leave();
    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: [{ name: 'Dashboard', params: { toast: 'Matches' } }],
      }),
    );
  });

  // A verify result: nothing follows it on the Dashboard.
  it('leave() without done sends no toast, whatever the operation says', () => {
    const navigation = makeNavigation();
    const { result } = renderScreenHook({
      keycard: { ...makeKeycard('done', 'match'), successMessage: 'Compared' },
      navigation,
      title: 'T',
      hold: true,
    });
    expect(navigation.reset).not.toHaveBeenCalled();
    result.current.leave();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: undefined } }],
    });
  });

  // InitCardScreen: no "Card initialized" over a PUK the card may not hold.
  it('leave() sends no toast when the toast function returns none', () => {
    const navigation = makeNavigation();
    const { result } = renderScreenHook({
      keycard: makeKeycard('error'),
      navigation,
      title: 'T',
      done: { toast: () => undefined },
      hold: true,
    });
    result.current.leave();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: undefined } }],
    });
  });

  it('hardware back on the held screen leaves, not the screen fallback', () => {
    const navigation = makeNavigation();
    const stepBack = jest.fn(() => true);
    renderScreenHook({
      ...options,
      keycard: makeKeycard('done'),
      navigation,
      stepBack,
    });
    expect(capturedBackHandler(backSpy)()).toBe(true);
    expect(navigation.reset).toHaveBeenCalledWith(dashboard);
    expect(stepBack).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('a back gesture on the held screen is turned into the Dashboard reset', () => {
    const { navigation, left } = makeNavigationThatAsksFirst();
    const stepBack = stepGuard();
    renderScreenHook({
      ...options,
      keycard: makeKeycard('done'),
      navigation,
      stepBack,
    });
    // goBack asks the listeners like a swipe would; the hold answers with reset.
    navigation.goBack();
    expect(left).toHaveBeenCalledTimes(1);
    expect(left).toHaveBeenCalledWith(dashboard);
    expect(stepBack).not.toHaveBeenCalled();
  });

  // The screen scopes the hold; a back press outside it still reaches the screen.
  it('follows the hold as it changes', () => {
    const navigation = makeNavigation();
    const stepBack = jest.fn(() => false);
    const base = {
      ...options,
      keycard: makeKeycard('idle'),
      navigation,
      stepBack,
    };
    const { rerender } = renderScreenHook({ ...base, hold: false });
    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation)(e);
    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(navigation.reset).not.toHaveBeenCalled();

    rerender({ ...base, hold: true });
    capturedBeforeRemove(navigation)(e);
    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(navigation.reset).toHaveBeenCalledWith(dashboard);
  });

  it('navigates on done when the screen is not holding', () => {
    const navigation = makeNavigation();
    renderScreenHook({
      ...options,
      hold: false,
      keycard: makeKeycard('done'),
      navigation,
    });
    expect(navigation.reset).toHaveBeenCalledWith(dashboard);
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

  it('leaves through leaveOnCancel', () => {
    const navigation = makeNavigation();
    const keycard = makeKeycard('idle');
    const leaveOnCancel = jest.fn();
    const options = { keycard, navigation, title: 'T', leaveOnCancel };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });

    expect(keycard.cancel).toHaveBeenCalledTimes(1);
    expect(leaveOnCancel).toHaveBeenCalledTimes(1);
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
    const stepBack = stepGuard();
    const keycard = makeKeycard('idle');
    const options = { keycard, navigation, title: 'T', stepBack };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });

    expect(keycard.cancel).toHaveBeenCalled();
    expect(stepBack).not.toHaveBeenCalled();
    expect(left).toHaveBeenCalled();
  });

  it('still lets the screen veto a real back press afterwards', () => {
    const { navigation } = makeNavigationThatAsksFirst();
    const stepBack = stepGuard();
    const keycard = makeKeycard('idle');
    const options = {
      keycard,
      navigation,
      title: 'T',
      stepBack,
      stayOnCancel: true,
    };
    const { rerender } = renderScreenHook(options);

    rerender({ ...options, keycard: { ...keycard, userCancels: 1 } });
    const e = { preventDefault: jest.fn() };
    capturedBeforeRemove(navigation as any)(e);

    expect(stepBack).toHaveBeenCalled();
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

    // Done keys on keycard (idle): the active hook finishing must not navigate.
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

  // PairingSlotsScreen hands the read and the unpair back and forth.
  it('does not read a hook handed back with its old count as a cancel', () => {
    const navigation = makeNavigation();
    const read = makeKeycard('idle');
    const unpair = makeKeycard('idle');
    const options = {
      keycard: read,
      navigation,
      title: 'T',
      stayOnCancel: true,
    };
    const { rerender } = renderScreenHook({
      ...options,
      activeKeycard: { ...unpair, userCancels: 0 },
    });
    rerender({ ...options, activeKeycard: { ...unpair, userCancels: 1 } });
    expect(unpair.cancel).toHaveBeenCalledTimes(1);

    rerender({ ...options, activeKeycard: { ...read, userCancels: 0 } });
    rerender({ ...options, activeKeycard: { ...unpair, userCancels: 1 } });
    expect(unpair.cancel).toHaveBeenCalledTimes(1);
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
