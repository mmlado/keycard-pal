import { NativeModules } from 'react-native';

describe('scanDisplay', () => {
  afterEach(() => {
    delete NativeModules.ScanDisplay;
    jest.resetModules();
  });

  it('calls the native module', () => {
    const raise = jest.fn();
    const restore = jest.fn();
    NativeModules.ScanDisplay = { raise, restore };
    const {
      raiseScanDisplay,
      restoreScanDisplay,
    } = require('../src/utils/scanDisplay');

    raiseScanDisplay();
    restoreScanDisplay();

    expect(raise).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the native module', () => {
    const {
      raiseScanDisplay,
      restoreScanDisplay,
    } = require('../src/utils/scanDisplay');
    expect(() => {
      raiseScanDisplay();
      restoreScanDisplay();
    }).not.toThrow();
  });
});
