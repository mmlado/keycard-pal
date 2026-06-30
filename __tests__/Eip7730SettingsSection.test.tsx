import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import Eip7730SettingsSectionOffline from '../src/components/settings/eip7730/Eip7730SettingsSection.offline';
import Eip7730SettingsSectionOnline from '../src/components/settings/eip7730/Eip7730SettingsSection.online';

const mockLoadIndexedAt = jest.fn();

jest.mock('../src/storage/eip7730Index', () => ({
  loadIndexedAt: (...args: any[]) => mockLoadIndexedAt(...args),
}));

const mockLoadSource = jest.fn();
const mockLoadUrl = jest.fn();
const mockLoadWifi = jest.fn();
const mockSaveSource = jest.fn();
const mockSaveUrl = jest.fn();
const mockSaveWifi = jest.fn();
const mockClearEtag = jest.fn();
const mockClearLastModified = jest.fn();

jest.mock('../src/storage/eip7730Settings.online', () => ({
  loadDescriptorSource: (...args: any[]) => mockLoadSource(...args),
  loadDescriptorUrl: (...args: any[]) => mockLoadUrl(...args),
  loadWifiOnly: (...args: any[]) => mockLoadWifi(...args),
  saveDescriptorSource: (...args: any[]) => mockSaveSource(...args),
  saveDescriptorUrl: (...args: any[]) => mockSaveUrl(...args),
  saveWifiOnly: (...args: any[]) => mockSaveWifi(...args),
  clearEtag: (...args: any[]) => mockClearEtag(...args),
  clearLastModified: (...args: any[]) => mockClearLastModified(...args),
}));

const mockTriggerDownload = jest.fn();
const mockUseDownload = jest.fn();

jest.mock('../src/hooks/useEip7730Download.online', () => ({
  useEip7730Download: () => mockUseDownload(),
}));

jest.mock('../src/utils/eip7730/import', () => ({
  importLedgerRegistryZipFromPicker: jest.fn(),
}));

const DEFAULT_URL =
  'https://github.com/LedgerHQ/clear-signing-erc7730-registry/archive/refs/heads/master.zip';

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadIndexedAt.mockResolvedValue(null);
  mockLoadSource.mockResolvedValue('manual');
  mockLoadUrl.mockResolvedValue(DEFAULT_URL);
  mockLoadWifi.mockResolvedValue(false);
  mockSaveSource.mockResolvedValue(undefined);
  mockSaveUrl.mockResolvedValue(undefined);
  mockSaveWifi.mockResolvedValue(undefined);
  mockClearEtag.mockResolvedValue(undefined);
  mockClearLastModified.mockResolvedValue(undefined);
  mockUseDownload.mockReturnValue({
    phase: 'idle',
    triggerDownload: mockTriggerDownload,
  });
});

describe('Eip7730SettingsSection.offline', () => {
  it('shows import button and Bundled default last updated', async () => {
    render(<Eip7730SettingsSectionOffline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    expect(screen.getByText(/Bundled/i)).toBeTruthy();
  });

  it('shows formatted timestamp when persisted indexed-at exists', async () => {
    mockLoadIndexedAt.mockResolvedValue('2025-01-01T00:00:00.000Z');
    render(<Eip7730SettingsSectionOffline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    // formatted via toLocaleString — just check it's not the literal placeholder
    expect(screen.queryByText(/Bundled/i)).toBeNull();
  });
});

describe('Eip7730SettingsSection.online', () => {
  it('defaults to Manual mode showing import button', async () => {
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    expect(screen.queryByTestId('eip7730-download-now')).toBeNull();
  });

  it('switches to Auto mode showing URL input, wifi toggle, download button', async () => {
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Auto-download'));
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-download-now')).toBeTruthy();
    });
    expect(screen.getByPlaceholderText(DEFAULT_URL)).toBeTruthy();
    expect(screen.getByText('Download on Wi-Fi only')).toBeTruthy();
    expect(mockSaveSource).toHaveBeenCalledWith('auto');
  });

  it('starts in Auto mode when persisted source is auto', async () => {
    mockLoadSource.mockResolvedValue('auto');
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-download-now')).toBeTruthy();
    });
    expect(screen.queryByTestId('eip7730-import-button')).toBeNull();
  });

  it('Download now button invokes triggerDownload', async () => {
    mockLoadSource.mockResolvedValue('auto');
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-download-now')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('eip7730-download-now'));
    expect(mockTriggerDownload).toHaveBeenCalled();
  });

  it('disables Download now button while download is in progress', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockUseDownload.mockReturnValue({
      phase: 'downloading',
      progress: 0.5,
      triggerDownload: mockTriggerDownload,
    });
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-download-now')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('eip7730-download-now'));
    expect(mockTriggerDownload).not.toHaveBeenCalled();
  });
});
