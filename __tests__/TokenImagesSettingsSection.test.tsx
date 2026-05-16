import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import TokenImagesSettingsSection from '../src/components/settings/TokenImagesSettingsSection.online';

const mockLoad = jest.fn();
const mockSave = jest.fn();

jest.mock('../src/storage/preferencesStorage', () => ({
  loadTokenImagesEnabled: (...args: any[]) => mockLoad(...args),
  saveTokenImagesEnabled: (...args: any[]) => mockSave(...args),
}));

jest.mock('react-native-paper', () => {
  const { Text, Switch } = require('react-native');
  return {
    MD3DarkTheme: { colors: {} },
    Text,
    Switch,
  };
});

async function renderSection() {
  render(<TokenImagesSettingsSection />);
  await act(async () => {});
}

describe('TokenImagesSettingsSection', () => {
  beforeEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
    mockLoad.mockResolvedValue(false);
    mockSave.mockResolvedValue(undefined);
  });

  it('renders the toggle with label', async () => {
    await renderSection();
    expect(screen.getByText('Load token images')).toBeTruthy();
  });

  it('toggle is off by default (opt-in)', async () => {
    await renderSection();
    expect(screen.getByRole('switch').props.value).toBe(false);
  });

  it('reflects stored preference when enabled', async () => {
    mockLoad.mockResolvedValue(true);
    await renderSection();
    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('saves and updates state when toggled on', async () => {
    await renderSection();
    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', true);
    });
    expect(mockSave).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('reverts state when save rejects', async () => {
    mockLoad.mockResolvedValue(true);
    mockSave.mockRejectedValue(new Error('storage error'));
    await renderSection();
    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', false);
    });
    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('does not revert when state already changed before catch runs', async () => {
    mockLoad.mockResolvedValue(true);
    let rejectFirstSave!: (e: Error) => void;
    mockSave.mockReturnValueOnce(
      new Promise<void>((_, rej) => (rejectFirstSave = rej)),
    );
    mockSave.mockResolvedValueOnce(undefined);
    await renderSection();
    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', false);
    });
    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', true);
    });
    await act(async () => {
      rejectFirstSave(new Error('storage error'));
    });
    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('stale storage load does not override user interaction', async () => {
    let resolveLoad!: (v: boolean) => void;
    mockLoad.mockReturnValue(new Promise(res => (resolveLoad = res)));
    render(<TokenImagesSettingsSection />);
    await act(async () => {
      fireEvent(screen.getByRole('switch'), 'valueChange', true);
    });
    await act(async () => {
      resolveLoad(false);
    });
    expect(screen.getByRole('switch').props.value).toBe(true);
  });
});
