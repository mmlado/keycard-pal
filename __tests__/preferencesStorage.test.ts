import {
  loadDashboardKeycardNoticeDismissed,
  loadPinPadScramble,
  saveDashboardKeycardNoticeDismissed,
  savePinPadScramble,
} from '../src/storage/preferencesStorage';

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: any[]) => mockGetItem(...args),
    setItem: (...args: any[]) => mockSetItem(...args),
  },
}));

describe('preferencesStorage', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  describe('loadDashboardKeycardNoticeDismissed', () => {
    it('reads the correct storage key', async () => {
      mockGetItem.mockResolvedValue(null);
      await loadDashboardKeycardNoticeDismissed();
      expect(mockGetItem).toHaveBeenCalledWith(
        'preference_dashboard_keycard_notice_dismissed',
      );
    });

    it('returns true when stored value is "1"', async () => {
      mockGetItem.mockResolvedValue('1');
      expect(await loadDashboardKeycardNoticeDismissed()).toBe(true);
    });

    it('returns false when nothing stored', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await loadDashboardKeycardNoticeDismissed()).toBe(false);
    });

    it('returns false when storage throws', async () => {
      mockGetItem.mockRejectedValue(new Error('storage failure'));
      expect(await loadDashboardKeycardNoticeDismissed()).toBe(false);
    });
  });

  describe('saveDashboardKeycardNoticeDismissed', () => {
    it('stores true as "1"', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await saveDashboardKeycardNoticeDismissed(true);
      expect(mockSetItem).toHaveBeenCalledWith(
        'preference_dashboard_keycard_notice_dismissed',
        '1',
      );
    });

    it('stores false as "0"', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await saveDashboardKeycardNoticeDismissed(false);
      expect(mockSetItem).toHaveBeenCalledWith(
        'preference_dashboard_keycard_notice_dismissed',
        '0',
      );
    });
  });

  describe('loadPinPadScramble', () => {
    it('reads the correct storage key', async () => {
      mockGetItem.mockResolvedValue(null);
      await loadPinPadScramble();
      expect(mockGetItem).toHaveBeenCalledWith('preference_pinpad_scramble');
    });

    it('returns true when stored value is "1"', async () => {
      mockGetItem.mockResolvedValue('1');
      expect(await loadPinPadScramble()).toBe(true);
    });

    it('returns false when nothing stored', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await loadPinPadScramble()).toBe(false);
    });

    it('returns false when storage throws', async () => {
      mockGetItem.mockRejectedValue(new Error('storage failure'));
      expect(await loadPinPadScramble()).toBe(false);
    });
  });

  describe('savePinPadScramble', () => {
    it('stores true as "1"', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await savePinPadScramble(true);
      expect(mockSetItem).toHaveBeenCalledWith(
        'preference_pinpad_scramble',
        '1',
      );
    });

    it('stores false as "0"', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await savePinPadScramble(false);
      expect(mockSetItem).toHaveBeenCalledWith(
        'preference_pinpad_scramble',
        '0',
      );
    });
  });
});
