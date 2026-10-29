/* global jest, afterEach */
// Suppress console.log during tests. Errors and warnings are still shown.
jest.spyOn(console, 'log').mockImplementation(() => {});

// NetInfo has no native module under Jest, and importing it throws. Any
// component reaching the network-state seam (connectivity.online) pulls it in.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// Untranspiled Flow plus a native module, reached by every review panel through the descriptor lookup.
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/documents',
    exists: jest.fn(async () => false),
    readFile: jest.fn(async () => {
      throw new Error('no file');
    }),
    writeFile: jest.fn(async () => {}),
    mkdir: jest.fn(async () => {}),
    unlink: jest.fn(async () => {}),
    moveFile: jest.fn(async () => {}),
  },
}));

// The keyboard library and its Reanimated peer run on native modules Jest does not have.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// usePreventRemove needs a navigator, and screens are tested without one; the hook's own beforeRemove listener is what tests drive.
jest.mock('./src/navigation/useBlockNativeBack', () => ({
  useBlockNativeBack: () => {},
}));

// Clear any pending fake timers between tests to prevent bleed-over.
afterEach(() => {
  jest.clearAllTimers();
});
