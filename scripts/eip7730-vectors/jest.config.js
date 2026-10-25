// The registry's test vectors, run by scripts/check-eip7730-vectors.js and never by the main suite.
const path = require('path');

const root = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: root,
  preset: '@react-native/jest-preset',
  testEnvironmentOptions: {
    customExportConditions: ['require', 'node', 'node-addons'],
  },
  testMatch: ['<rootDir>/scripts/eip7730-vectors/vectors.harness.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@noble/(secp256k1|hashes|curves)|@scure/(bip32|bip39|base)|keycard-sdk)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.svg': '<rootDir>/__mocks__/svgMock.js',
    '^@react-native-vector-icons/.*': '<rootDir>/__mocks__/vectorIconsMock.js',
    '^@noble/hashes/sha3$': '<rootDir>/node_modules/@noble/hashes/sha3.js',
  },
};
