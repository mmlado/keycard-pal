const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');
const { createResolveRequest } = require('./metro.resolveRequest');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;
const nodeLibs = require('node-libs-react-native');

const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    unstable_enablePackageExports: true,
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    extraNodeModules: {
      ...nodeLibs,
      crypto: path.join(__dirname, 'src/shims/crypto.ts'),
      // Force WalletConnect's bundled async-storage v1 to resolve to our v3 (TurboModule-compatible)
      '@react-native-async-storage/async-storage': path.join(
        __dirname,
        'node_modules/@react-native-async-storage/async-storage',
      ),
    },
    resolveRequest: createResolveRequest(process.env.ONLINE_BUILD === 'true'),
  },
};

module.exports = mergeConfig(defaultConfig, config);
