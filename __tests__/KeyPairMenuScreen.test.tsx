import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import KeyPairMenuScreen, {
  dashboardEntry,
} from '../src/screens/keypair/KeyPairMenuScreen';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const { Text } = require('react-native');
  return { MD3DarkTheme: { colors: {} }, Text };
});

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

// These assertions describe the list layout's rows, so pin the preference.
jest.mock('../src/hooks/useDashboardLayout', () => ({
  useDashboardLayout: () => ({ layout: 'list', loaded: true }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const navigation = { navigate: jest.fn() } as any;
const route = { key: 'KeyPairMenu', name: 'KeyPairMenu' } as any;

function renderScreen() {
  return render(<KeyPairMenuScreen navigation={navigation} route={route} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KeyPairMenuScreen', () => {
  beforeEach(() => {
    navigation.navigate.mockClear();
  });

  // The two formats offer the same three actions, so the heading distinguishes
  // them and the labels stay short enough to scan.
  describe('grouping', () => {
    it('heads each group with its seed format', () => {
      renderScreen();
      expect(screen.getByText('BIP39')).toBeTruthy();
      expect(screen.getByText('SLIP39')).toBeTruthy();
    });

    it('puts the BIP39 group before the SLIP39 group', () => {
      const { toJSON } = renderScreen();
      const rendered = JSON.stringify(toJSON());
      expect(rendered.indexOf('BIP39')).toBeLessThan(
        rendered.indexOf('SLIP39'),
      );
    });

    it('keeps the actions in generate, import, verify order', () => {
      const { toJSON } = renderScreen();
      const rendered = JSON.stringify(toJSON());
      expect(rendered.indexOf('Generate key pair')).toBeLessThan(
        rendered.indexOf('Import recovery phrase'),
      );
      expect(rendered.indexOf('Import recovery phrase')).toBeLessThan(
        rendered.indexOf('Verify recovery phrase'),
      );
      expect(rendered.indexOf('Generate shares')).toBeLessThan(
        rendered.indexOf('Import shares'),
      );
    });
  });

  describe('layout', () => {
    it('renders the BIP39 entries', () => {
      renderScreen();
      expect(screen.getByText('Generate key pair')).toBeTruthy();
      expect(screen.getByText('Import recovery phrase')).toBeTruthy();
      expect(screen.getByText('Verify recovery phrase')).toBeTruthy();
    });

    it('renders the SLIP39 entries', () => {
      renderScreen();
      expect(screen.getByText('Generate shares')).toBeTruthy();
      expect(screen.getByText('Import shares')).toBeTruthy();
      expect(screen.getByText('Verify shares')).toBeTruthy();
    });

    // Row ids continue across groups rather than restarting, so the second
    // group's rows do not collide with the first group's.
    it('shows a leading icon on every row across both groups', () => {
      renderScreen();
      for (const index of [0, 1, 2, 3, 4, 5]) {
        expect(screen.getByTestId(`menu-icon-${index}`)).toBeTruthy();
      }
    });
  });

  describe('navigation', () => {
    it('navigates to Mnemonic when "Import recovery phrase" is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Import recovery phrase'));
      expect(navigation.navigate).toHaveBeenCalledWith('Mnemonic');
    });

    it('navigates to Mnemonic with verify mode when "Verify recovery phrase" is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Verify recovery phrase'));
      expect(navigation.navigate).toHaveBeenCalledWith('Mnemonic', {
        mode: 'verify',
      });
    });

    it('navigates to KeySize when "Generate key pair" is pressed', () => {
      renderScreen();
      fireEvent.press(screen.getByText('Generate key pair'));
      expect(navigation.navigate).toHaveBeenCalledWith('KeySize');
    });

    it('navigates to Slip39 generate/import/verify modes', () => {
      renderScreen();
      for (const [label, mode] of [
        ['Generate shares', 'generate'],
        ['Import shares', 'import'],
        ['Verify shares', 'verify'],
      ] as const) {
        fireEvent.press(screen.getByText(label));
        expect(navigation.navigate).toHaveBeenCalledWith('Slip39', { mode });
      }
    });
  });

  describe('dashboardEntry', () => {
    it('has the correct label', () => {
      expect(dashboardEntry.label).toBe('Key pair');
    });

    it('navigates to KeyPairMenu when invoked', () => {
      const nav = { navigate: jest.fn() } as any;
      dashboardEntry.navigate(nav);
      expect(nav.navigate).toHaveBeenCalledWith('KeyPairMenu');
    });
  });
});
