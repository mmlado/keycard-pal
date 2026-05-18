const path = require('path');
const { resolve } = require('metro-resolver');


/**
 * Creates a Metro resolveRequest hook that maps `.online` imports to `.offline`
 * when the build is not online.
 *
 * @param {boolean} isOnlineBuild
 * @returns {import('metro-resolver').CustomResolver}
 */
function createResolveRequest(isOnlineBuild) {
  return function resolveRequest(context, moduleName, platform) {
    const { resolveRequest: _, ...restContext } = context;

    // Force every require of async-storage to the root v3 package so WalletConnect's
    // nested v1 (which breaks New Architecture) is never loaded. Spoofing
    // originModulePath to the project root makes Metro climb from there and find
    // the root node_modules copy instead of the nested one.
    if (moduleName === '@react-native-async-storage/async-storage') {
      return resolve(
        { ...restContext, originModulePath: path.join(__dirname, '_shim_.js') },
        moduleName,
        platform,
      );
    }

    if (!isOnlineBuild) {
      const offlineModuleName = moduleName.replace(/\.online\b/, '.offline');
      if (offlineModuleName !== moduleName) {
        return resolve(restContext, offlineModuleName, platform);
      }
    }

    return resolve(restContext, moduleName, platform);
  };
}

module.exports = { createResolveRequest };
