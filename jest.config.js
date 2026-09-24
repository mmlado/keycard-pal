// Two projects, because the app now has two builds that differ in what they
// ship, not just in what they do at runtime. `constants/purchaseLink` and
// `components/AffiliateDisclosure` have `.ios` twins, and Metro — and Jest —
// resolve them by platform, so a single run can only ever exercise one of
// them. Jest's react-native preset defaults to ios, which is left alone: the
// whole existing suite is the iOS arm. Tests under `__tests__/android/` run
// in a second project with android resolution, which is the only way to
// assert that the affiliate link and its Advertisement labels are still there.
const base = {
  preset: 'react-native',
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
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@noble/(secp256k1|hashes|curves)|@scure/(bip32|bip39|base)|keycard-sdk)/)',
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
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
