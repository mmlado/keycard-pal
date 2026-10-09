import React, { act } from 'react';
import { TextInput } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import NFCBottomSheet from '../src/components/NFCBottomSheet';
import Slip39Screen from '../src/screens/keypair/Slip39Screen';

const SHARE_1 =
  'very graduate academic acid best smith recall exclude apart company amount junior alive believe withdraw alien company hospital payroll lend';
const SHARE_2 =
  'very graduate academic agency dish traveler veteran facility hormone camera kind hearing debut carve either demand valuable diminish triumph treat';
const INVALID_SHARE =
  'very graduate academic acid best smith recall exclude apart company amount junior alive believe withdraw alien company hospital payroll nope';
const { generateSlip39SharesFromKeycardEntropy: realGenerateSlip39Shares } =
  jest.requireActual(
    '../src/utils/slip39',
  ) as typeof import('../src/utils/slip39');
const SINGLE_SHARE = realGenerateSlip39Shares(new Uint8Array([9, 8, 7, 6]), {
  shareCount: 1,
  threshold: 1,
})[0];

const mockStartLoad = jest.fn();
const mockStartGenerate = jest.fn();
const mockStartVerify = jest.fn();
const mockCancel = jest.fn();
const mockResetGenerate = jest.fn();
const mockUseGenerateSlip39Shares = jest.fn();
const mockUseLoadKey = jest.fn();
const mockUseVerifyFingerprint = jest.fn();
const mockGenerateSlip39SharesFromKeycardEntropy = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('../src/hooks/useSeedReviewTimer', () => ({
  useSeedReviewTimer: () => ({ timeLeft: 0, done: true, start: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/components/NFCBottomSheet', () => jest.fn(() => null));
const MockNFCBottomSheet = NFCBottomSheet as jest.MockedFunction<
  typeof NFCBottomSheet
>;

jest.mock('../src/hooks/keycard/useGenerateSlip39Shares', () => ({
  useGenerateSlip39Shares: (...args: any[]) =>
    mockUseGenerateSlip39Shares(...args),
}));

jest.mock('../src/hooks/keycard/useLoadKey', () => ({
  useLoadKey: (...args: any[]) => mockUseLoadKey(...args),
}));

jest.mock('../src/hooks/keycard/useVerifyFingerprint', () => ({
  useVerifyFingerprint: (...args: any[]) => mockUseVerifyFingerprint(...args),
}));

jest.mock('../src/utils/slip39', () => {
  const actual = jest.requireActual('../src/utils/slip39');
  return {
    ...actual,
    generateSlip39SharesFromKeycardEntropy: (...args: any[]) =>
      mockGenerateSlip39SharesFromKeycardEntropy(...args),
  };
});

const navigation = {
  addListener: jest.fn(() => jest.fn()),
  navigate: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
} as any;

function hookMock(start = mockStartLoad, phase = 'idle', result: any = null) {
  return {
    phase,
    result,
    status: '',
    pinError: null,
    start,
    cancel: mockCancel,
    submitPin: jest.fn(),
  };
}

function route(mode: 'generate' | 'import' | 'verify') {
  return { key: 'Slip39', name: 'Slip39', params: { mode } } as any;
}

function renderScreen(
  mode: 'generate' | 'import' | 'verify' = 'import',
  phase = 'idle',
  result: string | null = null,
  generatePhase = 'idle',
  generateResult: Uint8Array | null = null,
) {
  mockUseGenerateSlip39Shares.mockReturnValue({
    ...hookMock(mockStartGenerate, generatePhase, generateResult as any),
    reset: mockResetGenerate,
  });
  mockUseLoadKey.mockReturnValue(hookMock(mockStartLoad, phase, result));
  mockUseVerifyFingerprint.mockReturnValue(
    hookMock(mockStartVerify, phase, result),
  );
  return render(<Slip39Screen navigation={navigation} route={route(mode)} />);
}

async function flushTimers() {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
}

function getTextInputs() {
  return screen.UNSAFE_getAllByType(TextInput);
}

function getPressableByText(text: string) {
  let node: any = screen.getByText(text);
  while (node) {
    if (typeof node.props?.onPress === 'function') {
      return node;
    }
    node = node.parent;
  }
  throw new Error(`No pressable found for ${text}`);
}

describe('Slip39Screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    navigation.navigate.mockClear();
    navigation.reset.mockClear();
    navigation.setOptions.mockClear();
    mockStartLoad.mockClear();
    mockStartGenerate.mockClear();
    mockStartVerify.mockClear();
    mockCancel.mockClear();
    mockResetGenerate.mockClear();
    mockGenerateSlip39SharesFromKeycardEntropy.mockReset();
    mockGenerateSlip39SharesFromKeycardEntropy.mockReturnValue([
      SHARE_1,
      SHARE_2,
    ]);
    MockNFCBottomSheet.mockClear();
    mockUseGenerateSlip39Shares.mockReturnValue(hookMock(mockStartGenerate));
    mockUseLoadKey.mockReturnValue(hookMock());
    mockUseVerifyFingerprint.mockReturnValue(hookMock(mockStartVerify));
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    (Math.random as jest.Mock).mockRestore();
    jest.useRealTimers();
  });

  it('adds shares until the SLIP39 threshold is reached', async () => {
    renderScreen('import');

    expect(screen.getByText(/Enter share 1\./)).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('SLIP39 passphrase (optional)'),
    ).toBeNull();
    await act(async () => {
      fireEvent.changeText(getTextInputs()[0], SHARE_1);
    });
    expect(screen.getByText('20/20 words')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Next share'));
    });
    expect(screen.getByText(/Enter share 2 of 2\./)).toBeTruthy();
    expect(screen.queryByText(SHARE_1)).toBeNull();
    expect(getTextInputs()).toHaveLength(2);
    expect(getTextInputs()[0].props.value).toBe('');
    await act(async () => {
      fireEvent.changeText(getTextInputs()[0], SHARE_2);
    });
    expect(getPressableByText('Import to Keycard')).toBeDefined();

    await act(async () => {
      fireEvent.press(screen.getByText('Import to Keycard'));
    });
    await flushTimers();

    expect(mockStartLoad).toHaveBeenCalledTimes(1);
  });

  it('enables Next share for a complete valid share', async () => {
    renderScreen('import');

    await act(async () => {
      fireEvent.changeText(getTextInputs()[0], SHARE_1);
    });

    expect(screen.getByText('20/20 words')).toBeTruthy();
    expect(getPressableByText('Next share').props.disabled).toBe(false);
  });

  it('shows an error for invalid completed SLIP39 words', async () => {
    renderScreen('import');

    await act(async () => {
      fireEvent.changeText(getTextInputs()[0], INVALID_SHARE);
    });

    expect(screen.getByText('"nope" is not a valid SLIP39 word')).toBeTruthy();
    expect(getPressableByText('Next share').props.disabled).toBe(true);
  });

  it('shows the passphrase field after four words when preview metadata indicates 1/1', async () => {
    renderScreen('import');

    await act(async () => {
      fireEvent.changeText(
        getTextInputs()[0],
        SINGLE_SHARE.split(' ').slice(0, 4).join(' '),
      );
    });

    expect(screen.getByText(/Enter share 1 of 1\./)).toBeTruthy();
    expect(getTextInputs()).toHaveLength(2);
    expect(getPressableByText('Import to Keycard')).toBeDefined();
  });

  it('uses verify hook and reset toast in verify mode', async () => {
    await renderScreen('verify', 'done', 'match');

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Dashboard', params: { toast: 'SLIP39 shares match' } }],
    });
  });

  it('starts Keycard entropy generation before showing generated shares', async () => {
    renderScreen('generate');

    await act(async () => {
      fireEvent.press(screen.getByText('Generate SLIP39 shares'));
    });

    expect(mockStartGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows generated shares before loading them to the card', async () => {
    const entropy = new Uint8Array([1, 2, 3]);
    renderScreen('generate', 'idle', null, 'done', entropy);
    expect(screen.getByText('Creating SLIP39 shares...')).toBeTruthy();
    await flushTimers();

    expect(mockGenerateSlip39SharesFromKeycardEntropy).toHaveBeenCalledWith(
      entropy,
      { shareCount: 3, threshold: 2 },
    );
    expect(entropy).toEqual(new Uint8Array([0, 0, 0]));

    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.queryByText('2/2')).toBeNull();
    expect(screen.getByText('very')).toBeTruthy();
    expect(screen.getByText('lend')).toBeTruthy();
    expect(screen.getByText('2 shares generated, threshold 2')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('I saved this share'));
    });
    expect(
      screen.getByText('Confirm word positions in your backup share.'),
    ).toBeTruthy();
    expect(screen.queryByText('very')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('academic'));
    });
    expect(screen.getAllByText('____').length).toBeGreaterThan(0);

    for (const word of ['graduate', 'academic', 'acid', 'best']) {
      await act(async () => {
        fireEvent.press(screen.getByText(word));
      });
    }
    expect(screen.getByText('2/2')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('I saved the last share'));
    });
    for (const word of ['graduate', 'academic', 'agency', 'dish']) {
      await act(async () => {
        fireEvent.press(screen.getByText(word));
      });
    }
    expect(screen.getByText(/All shares saved/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Load to Keycard'));
    });
    expect(screen.getByText('Preparing key material...')).toBeTruthy();
    expect(screen.queryByText(/All shares are saved/)).toBeNull();
    await flushTimers();
    expect(mockStartLoad).toHaveBeenCalledTimes(1);
    expect(mockResetGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows error when adding share with invalid word', async () => {
    renderScreen('import');

    await act(async () => {
      fireEvent.changeText(
        getTextInputs()[0],
        'valid wordz here that are not slip39',
      );
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Next share'));
    });

    expect(screen.getByText(/"wordz" is not a valid SLIP39 word/)).toBeTruthy();
  });

  it('shows error for invalid share in handleImportOrVerify', async () => {
    renderScreen('import');

    await act(async () => {
      fireEvent.changeText(
        getTextInputs()[0],
        SHARE_1.replace('very', 'invalidword'),
      );
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Next share'));
    });

    expect(
      screen.getByText(/"invalidword" is not a valid SLIP39 word/),
    ).toBeTruthy();
  });

  it('handles generateSlip39SharesFromKeycardEntropy error', async () => {
    const entropy = new Uint8Array([1, 2, 3]);
    renderScreen('generate', 'idle', null, 'done', entropy);
    mockGenerateSlip39SharesFromKeycardEntropy.mockImplementation(() => {
      throw new Error('entropy error');
    });

    await flushTimers();

    expect(screen.getByText('entropy error')).toBeTruthy();
  });

  it('handles handleGenerateShares error', async () => {
    renderScreen('generate');
    mockStartGenerate.mockImplementation(() => {
      throw new Error('generate error');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Generate SLIP39 shares'));
    });

    expect(screen.getByText('generate error')).toBeTruthy();
  });

  it('passes NFC props through the bottom sheet', async () => {
    await renderScreen('import');

    expect(MockNFCBottomSheet.mock.calls[0][0].nfc.phase).toBe('idle');
  });
});
