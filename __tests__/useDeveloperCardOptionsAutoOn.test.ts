import { act, renderHook } from '@testing-library/react-native';

import { useDeveloperCardOptionsAutoOn } from '../src/hooks/useDeveloperCardOptionsAutoOn';
import type { DeveloperCardOptions } from '../src/storage/preferencesStorage';
import {
  clearUnverifiedCardApproval,
  isUnverifiedCardApprovalPending,
  noteUnverifiedCardApproved,
} from '../src/utils/unverifiedCardApproval';
import { testPreferences as mockTestPreferences } from './preferences.testUtils';

let mockChoice: DeveloperCardOptions = 'unset';
const mockSetPreference = jest.fn();
const mockLoadApprovedCardKeys = jest.fn();

jest.mock('../src/storage/approvedCardsStorage', () => ({
  loadApprovedCardKeys: () => mockLoadApprovedCardKeys(),
}));

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({ developerCardOptions: mockChoice }),
    setPreference: mockSetPreference,
  }),
}));

beforeEach(() => {
  mockChoice = 'unset';
  mockSetPreference.mockReset();
  mockLoadApprovedCardKeys.mockReset().mockResolvedValue([]);
  clearUnverifiedCardApproval();
});

const flush = () => act(async () => {});

describe('useDeveloperCardOptionsAutoOn', () => {
  it('does nothing without an approval', () => {
    renderHook(() => useDeveloperCardOptionsAutoOn());
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('shows the options after an approval while the user has not chosen', () => {
    renderHook(() => useDeveloperCardOptionsAutoOn());
    act(() => noteUnverifiedCardApproved());
    expect(mockSetPreference).toHaveBeenCalledWith(
      'developerCardOptions',
      'shown',
    );
    expect(isUnverifiedCardApprovalPending()).toBe(false);
  });

  it('acts on an approval kept before it mounted', () => {
    noteUnverifiedCardApproved();
    renderHook(() => useDeveloperCardOptionsAutoOn());
    expect(mockSetPreference).toHaveBeenCalledWith(
      'developerCardOptions',
      'shown',
    );
  });

  it.each(['hidden', 'shown'] as const)(
    'leaves a choice of %p alone',
    choice => {
      mockChoice = choice;
      renderHook(() => useDeveloperCardOptionsAutoOn());
      act(() => noteUnverifiedCardApproved());
      expect(mockSetPreference).not.toHaveBeenCalled();
      expect(isUnverifiedCardApprovalPending()).toBe(false);
    },
  );

  describe('a card approved in an earlier run', () => {
    it('shows the options at startup while the user has not chosen', async () => {
      mockLoadApprovedCardKeys.mockResolvedValue(['02'.repeat(33)]);
      renderHook(() => useDeveloperCardOptionsAutoOn());
      await flush();
      expect(mockSetPreference).toHaveBeenCalledWith(
        'developerCardOptions',
        'shown',
      );
    });

    it('changes nothing when no card was ever approved', async () => {
      renderHook(() => useDeveloperCardOptionsAutoOn());
      await flush();
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it.each(['hidden', 'shown'] as const)(
      'is not even read once the user chose %p',
      async choice => {
        mockChoice = choice;
        mockLoadApprovedCardKeys.mockResolvedValue(['02'.repeat(33)]);
        renderHook(() => useDeveloperCardOptionsAutoOn());
        await flush();
        expect(mockLoadApprovedCardKeys).not.toHaveBeenCalled();
        expect(mockSetPreference).not.toHaveBeenCalled();
      },
    );

    it('survives a store that cannot be read', async () => {
      mockLoadApprovedCardKeys.mockRejectedValue(new Error('keystore'));
      renderHook(() => useDeveloperCardOptionsAutoOn());
      await flush();
      expect(mockSetPreference).not.toHaveBeenCalled();
    });
  });
});
