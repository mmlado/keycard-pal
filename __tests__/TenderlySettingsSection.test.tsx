import React from 'react';
import { Linking } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import TenderlySettingsSection from '../src/components/settings/tenderly/TenderlySettingsSection.online';
import TenderlySettingsSectionOffline from '../src/components/settings/tenderly/TenderlySettingsSection.offline';

const mockLoadTenderlyConfig = jest.fn();
const mockSaveTenderlyEnabled = jest.fn();
const mockSaveTenderlyCredentials = jest.fn();

jest.mock('../src/storage/tenderly.online', () => ({
  loadTenderlyConfig: (...args: any[]) => mockLoadTenderlyConfig(...args),
  saveTenderlyEnabled: (...args: any[]) => mockSaveTenderlyEnabled(...args),
  saveTenderlyCredentials: (...args: any[]) =>
    mockSaveTenderlyCredentials(...args),
}));

jest.mock('react-native-paper', () => {
  const { Text, Switch } = require('react-native');
  return {
    Text: ({ children, onPress, ...props }: any) => (
      <Text onPress={onPress} {...props}>
        {children}
      </Text>
    ),
    Switch,
  };
});

jest.mock('../src/theme', () => ({
  __esModule: true,
  default: {
    colors: {
      primary: '#FF6400',
      onSurface: '#fff',
      onSurfaceVariant: '#aaa',
      onSurfaceMuted: '#888',
      onSurfaceSubtle: '#666',
      onSurfaceDisabled: '#444',
      surfaceVariant: '#2d2d2d',
      error: '#E95460',
      success: '#1C8A80',
    },
  },
}));

const EMPTY_CONFIG = {
  enabled: false,
  credentials: { accountSlug: '', projectSlug: '', apiKey: '' },
};

const FULL_CONFIG = {
  enabled: true,
  credentials: {
    accountSlug: 'acme',
    projectSlug: 'proj',
    apiKey: 'key123',
  },
};

describe('TenderlySettingsSection.online', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveTenderlyEnabled.mockResolvedValue(undefined);
    mockSaveTenderlyCredentials.mockResolvedValue(undefined);
  });

  it('renders nothing while loading', () => {
    mockLoadTenderlyConfig.mockReturnValue(new Promise(() => {}));
    const { toJSON } = render(<TenderlySettingsSection />);
    expect(toJSON()).toBeNull();
  });

  it('shows toggle off when disabled on mount', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(EMPTY_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());
    expect(screen.getByRole('switch').props.value).toBe(false);
  });

  it('hides credential inputs when disabled', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(EMPTY_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());
    expect(screen.queryByPlaceholderText('my-account')).toBeNull();
  });

  it('shows toggle on and credential inputs when enabled', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('my-account')).toBeTruthy(),
    );
    expect(screen.getByRole('switch').props.value).toBe(true);
    expect(screen.getByPlaceholderText('my-project')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter API key')).toBeTruthy();
  });

  it('calls saveTenderlyEnabled when toggle pressed', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(EMPTY_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
    expect(mockSaveTenderlyEnabled).toHaveBeenCalledWith(true);
  });

  it('shows Save button when account slug is edited', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('my-account')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('my-account'),
      'new-account',
    );
    expect(screen.getAllByText('Save').length).toBeGreaterThan(0);
  });

  it('calls saveTenderlyCredentials when Save pressed', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('my-account')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('my-account'),
      'new-account',
    );
    fireEvent.press(screen.getAllByText('Save')[0]);
    expect(mockSaveTenderlyCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ accountSlug: 'new-account' }),
    );
  });

  it('shows Tenderly registration link when enabled', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByText('Create a free Tenderly account →')).toBeTruthy(),
    );
  });

  it('shows privacy note', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(EMPTY_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(
        screen.getByText(/transaction data.*sent to Tenderly/i),
      ).toBeTruthy(),
    );
  });

  it('shows component after load failure (catch path)', async () => {
    mockLoadTenderlyConfig.mockRejectedValue(new Error('storage error'));
    render(<TenderlySettingsSection />);
    await waitFor(() => expect(screen.getByRole('switch')).toBeTruthy());
    expect(screen.getByRole('switch').props.value).toBe(false);
  });

  it('reverts project slug to saved value', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('my-project')).toBeTruthy(),
    );
    fireEvent.changeText(screen.getByPlaceholderText('my-project'), 'changed');
    fireEvent.press(screen.getAllByText('Revert')[0]);
    expect(screen.getByPlaceholderText('my-project').props.value).toBe('proj');
  });

  it('saves project slug when Save pressed', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('my-project')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('my-project'),
      'new-project',
    );
    fireEvent.press(screen.getAllByText('Save')[0]);
    expect(mockSaveTenderlyCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ projectSlug: 'new-project' }),
    );
  });

  it('saves api key when Save pressed', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Enter API key')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter API key'),
      'newkey',
    );
    fireEvent.press(screen.getAllByText('Save')[0]);
    expect(mockSaveTenderlyCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'newkey' }),
    );
  });

  it('reverts api key to saved value', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Enter API key')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter API key'),
      'changed',
    );
    fireEvent.press(screen.getAllByText('Revert')[0]);
    expect(screen.getByPlaceholderText('Enter API key').props.value).toBe(
      'key123',
    );
  });

  it('second save uses updated saved state from first save', async () => {
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('my-account')).toBeTruthy(),
    );

    // Save accountSlug first
    fireEvent.changeText(
      screen.getByPlaceholderText('my-account'),
      'new-account',
    );
    fireEvent.press(screen.getAllByText('Save')[0]);
    await waitFor(() =>
      expect(mockSaveTenderlyCredentials).toHaveBeenCalledTimes(1),
    );

    // Now save projectSlug — second call must include the updated accountSlug
    fireEvent.changeText(
      screen.getByPlaceholderText('my-project'),
      'new-project',
    );
    fireEvent.press(screen.getAllByText('Save')[0]);
    await waitFor(() =>
      expect(mockSaveTenderlyCredentials).toHaveBeenCalledTimes(2),
    );

    expect(mockSaveTenderlyCredentials).toHaveBeenLastCalledWith({
      accountSlug: 'new-account',
      projectSlug: 'new-project',
      apiKey: 'key123',
    });
  });

  it('opens Tenderly registration URL when link pressed', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockLoadTenderlyConfig.mockResolvedValue(FULL_CONFIG);
    render(<TenderlySettingsSection />);
    await waitFor(() =>
      expect(screen.getByText('Create a free Tenderly account →')).toBeTruthy(),
    );
    fireEvent.press(screen.getByText('Create a free Tenderly account →'));
    expect(openURL).toHaveBeenCalledWith(
      'https://dashboard.tenderly.co/register',
    );
    openURL.mockRestore();
  });
});

describe('TenderlySettingsSection.offline', () => {
  it('renders null', () => {
    const { toJSON } = render(<TenderlySettingsSectionOffline />);
    expect(toJSON()).toBeNull();
  });
});
