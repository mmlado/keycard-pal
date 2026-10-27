import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { SAVE_FAILED } from '../src/components/settings/TextInputSetting';
import WalletConnectSettingsSection from '../src/components/settings/WalletConnectSettingsSection.online';

const mockLoadWCProjectId = jest.fn();
const mockSaveWCProjectId = jest.fn();
const mockResetClient = jest.fn();

jest.mock('../src/storage/walletConnect', () => ({
  loadWCProjectId: (...args: any[]) => mockLoadWCProjectId(...args),
  saveWCProjectId: (...args: any[]) => mockSaveWCProjectId(...args),
}));

jest.mock('../src/utils/walletConnect/client.online', () => ({
  wcClient: { resetClient: (...args: any[]) => mockResetClient(...args) },
}));

const PLACEHOLDER = 'Enter WalletConnect Project ID';

async function renderLoaded(stored = 'old-id') {
  mockLoadWCProjectId.mockResolvedValue(stored);
  render(<WalletConnectSettingsSection />);
  await waitFor(() =>
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy(),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveWCProjectId.mockResolvedValue(undefined);
});

describe('WalletConnectSettingsSection', () => {
  it('shows the stored Project ID', async () => {
    await renderLoaded();
    expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe('old-id');
  });

  it('stores the trimmed Project ID and resets the client', async () => {
    await renderLoaded();
    fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), ' new-id ');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(mockSaveWCProjectId).toHaveBeenCalledWith('new-id');
    expect(mockResetClient).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('says the Project ID could not be saved, and keeps the client, when storing fails', async () => {
    mockSaveWCProjectId.mockRejectedValue(new Error('storage full'));
    await renderLoaded();
    fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'new-id');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(screen.getByText(SAVE_FAILED)).toBeTruthy();
    expect(mockResetClient).not.toHaveBeenCalled();
    expect(screen.getByText('Save')).toBeTruthy();
  });
});
