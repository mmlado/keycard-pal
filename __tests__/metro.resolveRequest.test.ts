import { resolve } from 'metro-resolver';

const { createResolveRequest } = require('../metro.resolveRequest');

jest.mock('metro-resolver', () => ({
  resolve: jest.fn(),
}));

describe('metro.resolveRequest', () => {
  const mockContext = {
    originModulePath: '/project/src/App.tsx',
    allowHaste: true,
    disableHierarchicalLookup: false,
    doesFileExist: () => true,
    isAssetFile: () => false,
    nodeModulesPaths: ['/project/node_modules'],
    preferNativePlatform: true,
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
    unstable_conditionNames: ['require', 'import'],
    unstable_conditionsByPlatform: {},
    unstable_enablePackageExports: true,
    getPackageMainPath: () => '/project/package.json',
    redirectModulePath: (p: string) => p,
    resolveRequest: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function assertNoResolveRequestRecursion() {
    const calledContext = (resolve as jest.Mock).mock.calls[0][0];
    expect(calledContext).not.toHaveProperty('resolveRequest');
  }

  describe('online build', () => {
    const resolveRequest = createResolveRequest(true);

    it('resolves .online imports normally', () => {
      resolveRequest(mockContext as any, './foo.online', 'ios');
      expect(resolve).toHaveBeenCalledTimes(1);
      assertNoResolveRequestRecursion();
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        './foo.online',
        'ios',
      );
    });

    it('resolves non-.online imports unchanged', () => {
      resolveRequest(mockContext as any, 'react-native', 'android');
      expect(resolve).toHaveBeenCalledTimes(1);
      assertNoResolveRequestRecursion();
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        'react-native',
        'android',
      );
    });
  });

  describe('offline build', () => {
    const resolveRequest = createResolveRequest(false);

    it('rewrites .online imports to .offline', () => {
      (resolve as jest.Mock).mockReturnValue('/project/src/foo.offline.ts');
      const result = resolveRequest(
        mockContext as any,
        './foo.online',
        'android',
      );
      expect(resolve).toHaveBeenCalledTimes(1);
      assertNoResolveRequestRecursion();
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        './foo.offline',
        'android',
      );
      expect(result).toBe('/project/src/foo.offline.ts');
    });

    it('rewrites .online.ts imports to .offline.ts', () => {
      (resolve as jest.Mock).mockReturnValue('/project/src/foo.offline.ts');
      resolveRequest(mockContext as any, './foo.online.ts', 'android');
      assertNoResolveRequestRecursion();
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        './foo.offline.ts',
        'android',
      );
    });

    it('throws when .offline file does not exist', () => {
      (resolve as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Module not found');
      });

      expect(() =>
        resolveRequest(mockContext as any, './foo.online', 'android'),
      ).toThrow('Module not found');
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        './foo.offline',
        'android',
      );
    });

    it('does not rewrite imports without .online suffix', () => {
      resolveRequest(mockContext as any, 'react-native', 'android');
      expect(resolve).toHaveBeenCalledTimes(1);
      assertNoResolveRequestRecursion();
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        'react-native',
        'android',
      );
    });

    it('does not rewrite imports containing online as part of a larger word', () => {
      resolveRequest(mockContext as any, './online-utils', 'android');
      expect(resolve).toHaveBeenCalledTimes(1);
      assertNoResolveRequestRecursion();
      expect(resolve).toHaveBeenCalledWith(
        expect.any(Object),
        './online-utils',
        'android',
      );
    });
  });
});
