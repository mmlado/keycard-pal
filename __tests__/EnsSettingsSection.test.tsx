import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import EnsSettingsSection from '../src/components/settings/EnsSettingsSection.online';
import EnsSettingsSectionOffline from '../src/components/settings/EnsSettingsSection.offline';

const mockLoadEnsSettings = jest.fn();
const mockSaveEnsEnabled = jest.fn();
const mockSaveEnsRpcUrl = jest.fn();
const mockValidateRpcUrl = jest.fn();

jest.mock('../src/storage/ensSettings.online', () => ({
  DEFAULT_ENS_RPC_URL: 'https://ethereum-rpc.publicnode.com',
  loadEnsSettings: (...args: any[]) => mockLoadEnsSettings(...args),
  saveEnsEnabled: (...args: any[]) => mockSaveEnsEnabled(...args),
  saveEnsRpcUrl: (...args: any[]) => mockSaveEnsRpcUrl(...args),
}));

jest.mock('../src/utils/ens/client.online', () => ({
  validateRpcUrl: (...args: any[]) => mockValidateRpcUrl(...args),
}));

function settingsWithUrl(rpcUrl: string, enabled = true) {
  return { enabled, rpcUrl };
}

describe('EnsSettingsSection.online', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveEnsEnabled.mockResolvedValue(undefined);
    mockSaveEnsRpcUrl.mockResolvedValue(undefined);
  });

  it('shows toggle off when ENS disabled on mount', async () => {
    mockLoadEnsSettings.mockResolvedValue({ enabled: false, rpcUrl: '' });

    render(<EnsSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeTruthy();
    });
    expect(screen.getByRole('switch').props.value).toBe(false);
    expect(
      screen.queryByPlaceholderText('https://ethereum-rpc.publicnode.com'),
    ).toBeNull();
  });

  it('shows toggle on and RPC input when ENS enabled on mount', async () => {
    mockLoadEnsSettings.mockResolvedValue(
      settingsWithUrl('https://custom.rpc'),
    );

    render(<EnsSettingsSection />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://custom.rpc')).toBeTruthy();
    });
    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('enabling with no saved URL auto-fills default, saves both', async () => {
    mockLoadEnsSettings.mockResolvedValue({ enabled: false, rpcUrl: '' });

    render(<EnsSettingsSection />);

    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());

    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('https://ethereum-rpc.publicnode.com'),
      ).toBeTruthy();
    });
    expect(mockSaveEnsEnabled).toHaveBeenCalledWith(true);
    expect(mockSaveEnsRpcUrl).toHaveBeenCalledWith(
      'https://ethereum-rpc.publicnode.com',
    );
  });

  it('enabling with existing URL saves only enabled flag', async () => {
    mockLoadEnsSettings.mockResolvedValue({
      enabled: false,
      rpcUrl: 'https://saved.rpc',
    });

    render(<EnsSettingsSection />);

    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());

    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() => {
      expect(mockSaveEnsEnabled).toHaveBeenCalledWith(true);
    });
    expect(mockSaveEnsRpcUrl).not.toHaveBeenCalled();
  });

  it('disabling saves enabled flag, keeps URL in input', async () => {
    mockLoadEnsSettings.mockResolvedValue(settingsWithUrl('https://saved.rpc'));

    render(<EnsSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://saved.rpc')).toBeTruthy(),
    );

    fireEvent(screen.getByRole('switch'), 'valueChange', false);

    await waitFor(() => {
      expect(mockSaveEnsEnabled).toHaveBeenCalledWith(false);
    });
    expect(mockSaveEnsRpcUrl).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('https://saved.rpc')).toBeNull();
  });

  it('loadEnsSettings failure still renders toggle', async () => {
    mockLoadEnsSettings.mockRejectedValue(new Error('storage error'));

    render(<EnsSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeTruthy();
    });
    expect(screen.getByRole('switch').props.value).toBe(false);
  });

  it('privacy disclosure always visible regardless of enabled state', async () => {
    mockLoadEnsSettings.mockResolvedValue({ enabled: false, rpcUrl: '' });

    render(<EnsSettingsSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/ENS lookups send reviewed Ethereum addresses/),
      ).toBeTruthy();
    });
  });

  it('Revert button appears when input is dirty, restores saved value', async () => {
    mockLoadEnsSettings.mockResolvedValue(settingsWithUrl('https://saved.rpc'));

    render(<EnsSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://saved.rpc')).toBeTruthy(),
    );

    expect(screen.queryByText('Revert')).toBeNull();

    fireEvent.changeText(
      screen.getByDisplayValue('https://saved.rpc'),
      'https://new.rpc',
    );
    expect(screen.getByText('Revert')).toBeTruthy();

    fireEvent.press(screen.getByText('Revert'));

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://saved.rpc')).toBeTruthy(),
    );
    expect(screen.queryByText('Revert')).toBeNull();
    expect(mockSaveEnsRpcUrl).not.toHaveBeenCalled();
  });

  it('valid mainnet RPC saves and clears dirty state', async () => {
    mockLoadEnsSettings.mockResolvedValue(settingsWithUrl('https://saved.rpc'));
    mockValidateRpcUrl.mockResolvedValue('ok');

    render(<EnsSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://saved.rpc')).toBeTruthy(),
    );

    fireEvent.changeText(
      screen.getByDisplayValue('https://saved.rpc'),
      'https://valid.rpc',
    );
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(mockSaveEnsRpcUrl).toHaveBeenCalledWith('https://valid.rpc'),
    );
    expect(screen.queryByText('Revert')).toBeNull();
  });

  it('non-mainnet response shows error, does not save', async () => {
    mockLoadEnsSettings.mockResolvedValue(settingsWithUrl('https://saved.rpc'));
    mockValidateRpcUrl.mockResolvedValue('non-mainnet');

    render(<EnsSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://saved.rpc')).toBeTruthy(),
    );

    fireEvent.changeText(
      screen.getByDisplayValue('https://saved.rpc'),
      'https://polygon.rpc',
    );
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(
        screen.getByText('Not an Ethereum mainnet endpoint.'),
      ).toBeTruthy();
    });
    expect(mockSaveEnsRpcUrl).not.toHaveBeenCalled();
  });

  it('unreachable/timeout shows error, does not save', async () => {
    mockLoadEnsSettings.mockResolvedValue(settingsWithUrl('https://saved.rpc'));
    mockValidateRpcUrl.mockResolvedValue('unreachable');

    render(<EnsSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://saved.rpc')).toBeTruthy(),
    );

    fireEvent.changeText(
      screen.getByDisplayValue('https://saved.rpc'),
      'https://bad.rpc',
    );
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(
        screen.getByText('Could not reach RPC endpoint — URL not saved.'),
      ).toBeTruthy();
    });
    expect(mockSaveEnsRpcUrl).not.toHaveBeenCalled();
  });

  it('saving empty string calls saveEnsRpcUrl("")', async () => {
    mockLoadEnsSettings.mockResolvedValue(settingsWithUrl('https://saved.rpc'));

    render(<EnsSettingsSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://saved.rpc')).toBeTruthy(),
    );

    fireEvent.changeText(screen.getByDisplayValue('https://saved.rpc'), '');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockSaveEnsRpcUrl).toHaveBeenCalledWith(''));
  });
});

describe('EnsSettingsSection.offline', () => {
  it('renders nothing', () => {
    const { UNSAFE_root } = render(<EnsSettingsSectionOffline />);
    expect(UNSAFE_root?.children.length).toBe(0);
  });
});
