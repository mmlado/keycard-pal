import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import Eip7730SettingsSectionOffline from '../src/components/settings/eip7730/Eip7730SettingsSection.offline';
import Eip7730SettingsSectionOnline from '../src/components/settings/eip7730/Eip7730SettingsSection.online';
import { SAVE_FAILED } from '../src/components/settings/TextInputSetting';
import { IMPORT_SOURCE_WARNING } from '../src/constants/eip7730';
import { setSavedIndex } from '../src/utils/eip7730/lookup';
import { rfc3339 } from '../src/utils/rfc3339';

import { testIndex } from './eip7730Index.testUtils';

const mockClearSavedIndex = jest.fn();

jest.mock('../src/storage/eip7730Index', () => ({
  loadManifest: async () => null,
  clearSavedIndex: (...args: any[]) => mockClearSavedIndex(...args),
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
  DEFAULT_EIP7730_REGISTRY_URL:
    'https://github.com/ethereum/clear-signing-erc7730-registry/archive/refs/heads/master.zip',
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

const mockImport = jest.fn();
jest.mock('../src/utils/eip7730/import', () => ({
  importRegistryZipFromPicker: (...args: any[]) => mockImport(...args),
}));

const DEFAULT_URL =
  'https://github.com/ethereum/clear-signing-erc7730-registry/archive/refs/heads/master.zip';

const INDEX = testIndex({
  generatedAt: '2025-01-01T00:00:00.000Z',
  contracts: { '1:0xabc': { '0xa9059cbb': { fields: [] } } },
});
const INDEX_DATE = rfc3339(Date.parse(INDEX.generatedAt)) ?? INDEX.generatedAt;

beforeEach(() => {
  jest.clearAllMocks();
  setSavedIndex(null);
  mockClearSavedIndex.mockResolvedValue(undefined);
  mockLoadSource.mockResolvedValue('manual');
  mockLoadUrl.mockResolvedValue(DEFAULT_URL);
  mockLoadWifi.mockResolvedValue(false);
  mockSaveSource.mockResolvedValue(undefined);
  mockSaveUrl.mockResolvedValue(undefined);
  mockSaveWifi.mockResolvedValue(undefined);
  mockClearEtag.mockResolvedValue(undefined);
  mockClearLastModified.mockResolvedValue(undefined);
  mockImport.mockResolvedValue({ ok: false, reason: 'cancelled' });
  mockUseDownload.mockReturnValue({
    phase: 'idle',
    triggerDownload: mockTriggerDownload,
  });
});

describe('Eip7730SettingsSection.offline', () => {
  it('shows the import button, the bundled index and the registry to download', () => {
    render(<Eip7730SettingsSectionOffline />);
    expect(screen.getByText('Import registry zip')).toBeTruthy();
    expect(screen.getByText(IMPORT_SOURCE_WARNING)).toBeTruthy();
    expect(screen.getByText('Bundled (default)')).toBeTruthy();
    expect(screen.queryByTestId('eip7730-use-bundled')).toBeNull();
    expect(
      screen.getByText(
        'On another device, download the clear-signing registry zip from github.com/ethereum/clear-signing-erc7730-registry, then import it here.',
      ),
    ).toBeTruthy();
  });

  it('shows the date of an import as soon as it finishes', async () => {
    mockImport.mockImplementation(async () => {
      setSavedIndex(INDEX);
      return { ok: true, index: INDEX };
    });
    render(<Eip7730SettingsSectionOffline />);
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    await waitFor(() => {
      expect(screen.getByText(INDEX_DATE)).toBeTruthy();
    });
  });

  it('says when a file is not a registry zip, cannot be read or cannot be saved', async () => {
    mockImport.mockResolvedValueOnce({ ok: false, reason: 'invalid' });
    render(<Eip7730SettingsSectionOffline />);
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    await waitFor(() => {
      expect(
        screen.getByText('This file is not a clear-signing registry zip.'),
      ).toBeTruthy();
    });

    mockImport.mockResolvedValueOnce({ ok: false, reason: 'unreadable' });
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    await waitFor(() => {
      expect(
        screen.getByText('Could not read the selected file.'),
      ).toBeTruthy();
    });

    mockImport.mockResolvedValueOnce({ ok: false, reason: 'unsaved' });
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    await waitFor(() => {
      expect(
        screen.getByText(
          'Could not save the descriptors. Check free storage and try again.',
        ),
      ).toBeTruthy();
    });
  });

  it('says nothing when the pick is cancelled', async () => {
    render(<Eip7730SettingsSectionOffline />);
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    // The label replaces the spinner once the import has settled.
    await waitFor(() => {
      expect(screen.getByText('Import registry zip')).toBeTruthy();
    });
    expect(mockImport).toHaveBeenCalled();
    expect(screen.queryByText(/registry zip\./)).toBeNull();
    expect(screen.queryByText(/Could not read/)).toBeNull();
  });

  it('keeps the index while an import is running', async () => {
    setSavedIndex(INDEX);
    let finish: (value: unknown) => void = () => {};
    mockImport.mockReturnValue(new Promise(resolve => (finish = resolve)));
    render(<Eip7730SettingsSectionOffline />);
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    fireEvent.press(screen.getByTestId('eip7730-use-bundled'));
    await act(async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(mockClearSavedIndex).not.toHaveBeenCalled();
    await act(async () => finish({ ok: false, reason: 'cancelled' }));
    fireEvent.press(screen.getByTestId('eip7730-use-bundled'));
    await waitFor(() => expect(mockClearSavedIndex).toHaveBeenCalled());
  });

  it('goes back to the bundled index', async () => {
    setSavedIndex(INDEX);
    render(<Eip7730SettingsSectionOffline />);
    expect(screen.getByText(INDEX_DATE)).toBeTruthy();

    fireEvent.press(screen.getByText('Use bundled descriptors'));

    await waitFor(() => {
      expect(screen.getByText('Bundled (default)')).toBeTruthy();
    });
    expect(mockClearSavedIndex).toHaveBeenCalled();
    expect(screen.queryByTestId('eip7730-use-bundled')).toBeNull();
  });
});

describe('Eip7730SettingsSection.online', () => {
  it('defaults to Manual mode showing import button', async () => {
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    expect(screen.getByText(IMPORT_SOURCE_WARNING)).toBeTruthy();
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

  it('forgets the validators when Auto is chosen, so the next download is in full', async () => {
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Auto-download'));
    await waitFor(() => {
      expect(mockClearLastModified).toHaveBeenCalled();
    });
    expect(mockClearEtag).toHaveBeenCalled();
  });

  it('keeps the validators when Auto is pressed again, or Manual is chosen', async () => {
    mockLoadSource.mockResolvedValue('auto');
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-download-now')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Auto-download'));
    fireEvent.press(screen.getByText('Manual'));
    await waitFor(() => {
      expect(mockSaveSource).toHaveBeenCalledWith('manual');
    });
    expect(mockSaveSource).toHaveBeenCalledTimes(1);
    expect(mockClearEtag).not.toHaveBeenCalled();
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

  it('shows why a download did not happen', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockUseDownload.mockReturnValue({
      phase: 'error',
      error: 'Not on Wi-Fi, nothing downloaded.',
      triggerDownload: mockTriggerDownload,
    });
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(
        screen.getByText('Not on Wi-Fi, nothing downloaded.'),
      ).toBeTruthy();
    });
  });

  it('shows the date of a download as soon as it finishes', async () => {
    mockLoadSource.mockResolvedValue('auto');
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByText('Bundled (default)')).toBeTruthy();
    });

    act(() => setSavedIndex(INDEX));

    expect(screen.getByText(INDEX_DATE)).toBeTruthy();
  });

  it('goes back to the bundled index and to Manual', async () => {
    mockLoadSource.mockResolvedValue('auto');
    setSavedIndex(INDEX);
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-use-bundled')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('eip7730-use-bundled'));

    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    expect(screen.getByText('Bundled (default)')).toBeTruthy();
    expect(mockClearSavedIndex).toHaveBeenCalled();
    expect(mockSaveSource).toHaveBeenCalledWith('manual');
  });

  it('saves a trimmed URL and forgets the validators of the old one', async () => {
    mockLoadSource.mockResolvedValue('auto');
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(DEFAULT_URL)).toBeTruthy();
    });
    fireEvent.changeText(
      screen.getByPlaceholderText(DEFAULT_URL),
      '  https://example.test/registry.zip  ',
    );
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => {
      expect(mockSaveUrl).toHaveBeenCalledWith(
        'https://example.test/registry.zip',
      );
    });
    expect(mockClearEtag).toHaveBeenCalled();
    expect(mockClearLastModified).toHaveBeenCalled();
  });

  it('says the URL could not be saved when storing it fails', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockSaveUrl.mockRejectedValueOnce(new Error('storage full'));
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(DEFAULT_URL)).toBeTruthy();
    });
    fireEvent.changeText(
      screen.getByPlaceholderText(DEFAULT_URL),
      'https://example.test/registry.zip',
    );
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });
    expect(screen.getByText(SAVE_FAILED)).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('saves the default URL for an empty field, and reverts an edit', async () => {
    mockLoadSource.mockResolvedValue('auto');
    mockLoadUrl.mockResolvedValue('https://example.test/registry.zip');
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(DEFAULT_URL)).toBeTruthy();
    });
    const input = screen.getByPlaceholderText(DEFAULT_URL);

    fireEvent.changeText(input, 'https://other.test/registry.zip');
    fireEvent.press(screen.getByText('Revert'));
    expect(input.props.value).toBe('https://example.test/registry.zip');

    fireEvent.changeText(input, '   ');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => {
      expect(mockSaveUrl).toHaveBeenCalledWith(DEFAULT_URL);
    });
  });

  it('saves the Wi-Fi only choice', async () => {
    mockLoadSource.mockResolvedValue('auto');
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeTruthy();
    });
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
    await waitFor(() => {
      expect(mockSaveWifi).toHaveBeenCalledWith(true);
    });
  });

  it('falls back to Manual when the settings cannot be read', async () => {
    mockLoadSource.mockRejectedValue(new Error('io'));
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
  });

  it('keeps the index and the mode while an import is running', async () => {
    setSavedIndex(INDEX);
    let finish: (value: unknown) => void = () => {};
    mockImport.mockReturnValue(new Promise(resolve => (finish = resolve)));
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-import-button')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    fireEvent.press(screen.getByTestId('eip7730-use-bundled'));
    fireEvent.press(screen.getByText('Auto-download'));
    await act(async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(mockClearSavedIndex).not.toHaveBeenCalled();
    expect(mockSaveSource).not.toHaveBeenCalled();
    await act(async () => finish({ ok: false, reason: 'cancelled' }));
    fireEvent.press(screen.getByText('Auto-download'));
    await waitFor(() => expect(mockSaveSource).toHaveBeenCalledWith('auto'));
  });

  it('keeps the index while a download is running', async () => {
    setSavedIndex(INDEX);
    mockUseDownload.mockReturnValue({
      phase: 'processing',
      triggerDownload: mockTriggerDownload,
    });
    render(<Eip7730SettingsSectionOnline />);
    await waitFor(() => {
      expect(screen.getByTestId('eip7730-use-bundled')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('eip7730-use-bundled'));
    fireEvent.press(screen.getByTestId('eip7730-import-button'));
    // The reset is a promise chain; drain it before asserting it did not run.
    await act(async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
    expect(mockClearSavedIndex).not.toHaveBeenCalled();
    expect(mockImport).not.toHaveBeenCalled();
    expect(screen.getByText(INDEX_DATE)).toBeTruthy();
  });
});
