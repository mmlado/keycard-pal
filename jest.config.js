// Two projects: React Native's preset resolves for iOS, and tests under
// `__tests__/android/` need Android resolution and Platform.OS.
const base = {
  preset: '@react-native/jest-preset',
  fakeTimers: { enableGlobally: true },
  testEnvironmentOptions: {
    customExportConditions: ['require', 'node', 'node-addons'],
  },
  // Anchored at rootDir on purpose: a bare '/android/' also swallows the
  // Android-arm tests in __tests__/android/.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
    'testUtils\\.ts$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@noble/(secp256k1|hashes|curves)|@scure/(bip32|bip39|base)|keycard-sdk|react-native-(reanimated|worklets|keyboard-controller|is-edge-to-edge))/)',
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  // Reanimated and Worklets take their JavaScript implementations: Jest has no native modules.
  resolver: 'react-native-reanimated/jest/resolver',
  // Project-level: at the root of a `projects` config this is ignored.
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
  moduleNameMapper: {
    '\\.svg': '<rootDir>/__mocks__/svgMock.js',
    '^@react-native-vector-icons/.*': '<rootDir>/__mocks__/vectorIconsMock.js',
    '^@noble/hashes/sha3$': '<rootDir>/node_modules/@noble/hashes/sha3.js',
  },
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: 'ios',
      testPathIgnorePatterns: [
        ...base.testPathIgnorePatterns,
        '/__tests__/android/',
      ],
    },
    {
      ...base,
      displayName: 'android',
      // Flips module resolution to the base (non-.ios) files, and with it
      // react-native's own Platform module, so Platform.OS is 'android' here.
      haste: { defaultPlatform: 'android', platforms: ['android', 'native'] },
      testMatch: ['<rootDir>/__tests__/android/**/*.test.{ts,tsx}'],
    },
  ],
};
