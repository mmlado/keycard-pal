module.exports = {
  preset: 'react-native',
  fakeTimers: { enableGlobally: true },
  testEnvironmentOptions: {
    customExportConditions: ['require', 'node', 'node-addons'],
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', 'testUtils\\.ts$'],
  // Test helpers are not product code.
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@noble/(secp256k1|hashes|curves)|@scure/(bip32|bip39|base)|keycard-sdk)/)',
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    '\\.svg': '<rootDir>/__mocks__/svgMock.js',
    '^@react-native-vector-icons/.*': '<rootDir>/__mocks__/vectorIconsMock.js',
    '^@noble/hashes/sha3$':
      '<rootDir>/node_modules/@noble/hashes/sha3.js',


  },
};
