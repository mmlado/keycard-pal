import React from 'react';
import { Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import EntryList, { EntryListItem } from '../src/components/EntryList';

import { testPreferences as mockTestPreferences } from './preferences.testUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

let mockLayout: 'tiles' | 'list' = 'tiles';
let mockGenerationsInUse: ('3.1' | '4.0')[] = ['3.1', '4.0'];

jest.mock('../src/hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: mockTestPreferences({
      dashboardLayout: mockLayout,
      generationsInUse: mockGenerationsInUse,
    }),
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

/** An entry only cards older than 4.0 have. */
function legacyEntry(label: string): EntryListItem {
  return { ...entry(label), generationBoundRoute: 'PairingSlots' };
}

beforeEach(() => {
  mockLayout = 'tiles';
  mockGenerationsInUse = ['3.1', '4.0'];
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

  // Ids stay unique across groups.
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

  // A hidden entry must look as if it was never passed in.
  describe('generation-bound entries', () => {
    it('shows them while every card is ticked', () => {
      render(<EntryList entries={[entry('One'), legacyEntry('Legacy')]} />);
      expect(screen.getByText('Legacy')).toBeTruthy();
    });

    it('shows them when only cards that have them are ticked', () => {
      mockGenerationsInUse = ['3.1'];
      render(<EntryList entries={[entry('One'), legacyEntry('Legacy')]} />);
      expect(screen.getByText('Legacy')).toBeTruthy();
    });

    it('hides them when no ticked card has them', () => {
      mockGenerationsInUse = ['4.0'];
      render(<EntryList entries={[entry('One'), legacyEntry('Legacy')]} />);
      expect(screen.queryByText('Legacy')).toBeNull();
      expect(screen.getByText('One')).toBeTruthy();
    });

    it('renumbers the rows that follow a hidden one', () => {
      mockLayout = 'list';
      mockGenerationsInUse = ['4.0'];
      render(
        <EntryList
          entries={[entry('One'), legacyEntry('Legacy'), entry('Three')]}
        />,
      );
      expect(screen.getByTestId('menu-icon-0')).toBeTruthy();
      expect(screen.getByTestId('menu-icon-1')).toBeTruthy();
      expect(screen.queryByTestId('menu-icon-2')).toBeNull();
    });

    // Hiding one of three leaves an even count: two plain tiles.
    it('lays the tiles out for the count that is left', () => {
      mockGenerationsInUse = ['4.0'];
      render(
        <EntryList
          entries={[
            { ...entry('One'), detail: 'Only a hero shows this' },
            legacyEntry('Legacy'),
            entry('Three'),
          ]}
        />,
      );
      expect(screen.queryByText('Only a hero shows this')).toBeNull();
    });

    it('drops a group that is left empty, heading included', () => {
      mockGenerationsInUse = ['4.0'];
      render(
        <EntryList
          sections={[
            { title: 'Current', entries: [entry('One'), entry('Two')] },
            { title: 'Pairing', entries: [legacyEntry('Legacy')] },
          ]}
        />,
      );
      expect(screen.queryByText('Pairing')).toBeNull();
      expect(screen.getByText('Current')).toBeTruthy();
      // One group left, so the grid takes the ungrouped id.
      expect(screen.getByTestId('tile-grid')).toBeTruthy();
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
