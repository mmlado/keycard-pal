/* global jest, afterEach */
// Suppress console.log during tests. Errors and warnings are still shown.
jest.spyOn(console, 'log').mockImplementation(() => {});

// NetInfo has no native module under Jest, and importing it throws. Any
// component reaching the network-state seam (connectivity.online) pulls it in.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// Clear any pending fake timers between tests to prevent bleed-over.
afterEach(() => {
  jest.clearAllTimers();
});
