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
