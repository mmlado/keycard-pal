import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import WithAddToken from '../src/components/WithAddToken';

jest.mock('../src/assets/icons', () => require('../__mocks__/iconsMock'));

const mockNavigation = { isReady: jest.fn(), navigate: jest.fn() };

jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => mockNavigation.isReady(),
    navigate: (...args: unknown[]) => mockNavigation.navigate(...args),
  },
}));

const TOKEN = '0x000000000000000000000000000000000000dEaD';

beforeEach(() => jest.clearAllMocks());

describe('WithAddToken', () => {
  it('draws only its row when there is nothing to add', () => {
    render(
      <WithAddToken place={undefined}>
        <Text>Token contract</Text>
      </WithAddToken>,
    );
    expect(screen.getByText('Token contract')).toBeTruthy();
    expect(screen.queryByText('Add token')).toBeNull();
  });

  it('opens the editor with the chain and address', () => {
    mockNavigation.isReady.mockReturnValue(true);
    render(
      <WithAddToken place={{ chainId: 1, address: TOKEN }}>
        <Text>Token contract</Text>
      </WithAddToken>,
    );
    fireEvent.press(screen.getByLabelText('Add token'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomToken', {
      mode: 'add',
      chainId: 1,
      address: TOKEN,
    });
  });

  it('does nothing before the navigator is ready', () => {
    mockNavigation.isReady.mockReturnValue(false);
    render(
      <WithAddToken place={{ chainId: undefined, address: TOKEN }}>
        <Text>Token contract</Text>
      </WithAddToken>,
    );
    fireEvent.press(screen.getByLabelText('Add token'));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});
