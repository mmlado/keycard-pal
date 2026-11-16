// Each platform file read directly: the ios project would resolve the bare path to the iOS one.
describe('installLockSupport', () => {
  it('is on for Android', () => {
    expect(
      require('../src/utils/installLockSupport.ts').INSTALL_LOCK_SUPPORTED,
    ).toBe(true);
  });

  it('is off for iOS until a device test', () => {
    expect(
      require('../src/utils/installLockSupport.ios.ts').INSTALL_LOCK_SUPPORTED,
    ).toBe(false);
  });
});
