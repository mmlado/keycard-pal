import React from 'react';
import { Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import EntryList, { EntryListItem } from '../src/components/EntryList';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockLayout: 'tiles' | 'list' = 'tiles';

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: { dashboardLayout: mockLayout },
    setPreference: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Forwards its props so the rendered icon carries a findable testID.
const Icon = (props: any) => <View {...props} />;

function entry(label: string, onPress = jest.fn()): EntryListItem {
  return { label, icon: Icon, onPress };
}

beforeEach(() => {
  mockLayout = 'tiles';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntryList', () => {
  describe('tile layout', () => {
    it('renders the grid', () => {
      render(<EntryList entries={[entry('One'), entry('Two')]} />);
      expect(screen.getByTestId('tile-grid')).toBeTruthy();
      expect(screen.queryByTestId('menu-icon-0')).toBeNull();
    });

    it('renders the footer below the entries', () => {
      render(
        <EntryList
          entries={[entry('One'), entry('Two')]}
          footer={<Text>Footer</Text>}
        />,
      );
      expect(screen.getByText('Footer')).toBeTruthy();
    });
  });

  describe('list layout', () => {
    it('renders rows instead of the grid', () => {
      mockLayout = 'list';
      render(<EntryList entries={[entry('One'), entry('Two')]} />);
      expect(screen.queryByTestId('tile-grid')).toBeNull();
      expect(screen.getByTestId('menu-icon-0')).toBeTruthy();
      expect(screen.getByText('One')).toBeTruthy();
    });

    it('renders the footer below the rows', () => {
      mockLayout = 'list';
      render(
        <EntryList entries={[entry('One')]} footer={<Text>Footer</Text>} />,
      );
      expect(screen.getByText('Footer')).toBeTruthy();
    });
  });

  // Groups let a screen carry a heading per set, in either layout. Ids have to
  // stay unique across groups or a query would match more than one element.
  describe('sections', () => {
    const sections = [
      { title: 'BIP39', entries: [entry('Generate'), entry('Import')] },
      { title: 'SLIP39', entries: [entry('Shares'), entry('Recover')] },
    ];

    it('heads each group in list layout', () => {
      mockLayout = 'list';
      render(<EntryList sections={sections} />);
      expect(screen.getByText('BIP39')).toBeTruthy();
      expect(screen.getByText('SLIP39')).toBeTruthy();
    });

    it('heads each group in tile layout', () => {
      render(<EntryList sections={sections} />);
      expect(screen.getByText('BIP39')).toBeTruthy();
      expect(screen.getByText('SLIP39')).toBeTruthy();
    });

    it('continues row ids across groups in list layout', () => {
      mockLayout = 'list';
      render(<EntryList sections={sections} />);
      for (const index of [0, 1, 2, 3]) {
        expect(screen.getByTestId(`menu-icon-${index}`)).toBeTruthy();
      }
    });

    it('gives each group its own grid in tile layout', () => {
      render(<EntryList sections={sections} />);
      expect(screen.getByTestId('tile-s0-grid')).toBeTruthy();
      expect(screen.getByTestId('tile-s1-grid')).toBeTruthy();
    });

    it('keeps the plain grid id when there is only one group', () => {
      render(<EntryList entries={[entry('One'), entry('Two')]} />);
      expect(screen.getByTestId('tile-grid')).toBeTruthy();
    });

    it('renders an empty grid when given neither entries nor sections', () => {
      render(<EntryList />);
      expect(screen.getByTestId('tile-grid')).toBeTruthy();
      expect(screen.queryByTestId('tile-0')).toBeNull();
    });

    it('renders every entry from every group', () => {
      render(<EntryList sections={sections} />);
      expect(screen.getByText('Generate')).toBeTruthy();
      expect(screen.getByText('Recover')).toBeTruthy();
    });
  });

  describe('press handling', () => {
    it('calls the pressed entry in tile layout', () => {
      const onPress = jest.fn();
      render(<EntryList entries={[entry('One', onPress), entry('Two')]} />);
      fireEvent.press(screen.getByTestId('tile-0'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('calls the pressed entry in list layout', () => {
      mockLayout = 'list';
      const onPress = jest.fn();
      render(<EntryList entries={[entry('One', onPress), entry('Two')]} />);
      fireEvent.press(screen.getByText('One'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
