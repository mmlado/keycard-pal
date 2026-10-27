import { Platform } from 'react-native';

import { importRegistryZipFromPicker } from '../src/utils/eip7730/import';

const mockPick = jest.fn();
jest.mock('@react-native-documents/picker', () => ({
  pick: (...args: any[]) => mockPick(...args),
  types: { zip: 'application/zip' },
}));

afterEach(() => jest.restoreAllMocks());

const mockReadFile = jest.fn();
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: { readFile: (...args: any[]) => mockReadFile(...args) },
}));

const mockAdopt = jest.fn();
jest.mock('../src/utils/eip7730/lookup', () => ({
  adoptRegistry: (...args: any[]) => mockAdopt(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPick.mockResolvedValue([{ uri: 'content://registry.zip' }]);
  mockReadFile.mockResolvedValue(Buffer.from('zip').toString('base64'));
  mockAdopt.mockResolvedValue({ ok: true });
});

describe('importRegistryZipFromPicker', () => {
  it('adopts the file as an import', async () => {
    expect(await importRegistryZipFromPicker()).toEqual({ ok: true });
    expect(Array.from(mockAdopt.mock.calls[0][0])).toEqual([
      ...Buffer.from('zip'),
    ]);
    expect(mockAdopt.mock.calls[0][1]).toBe('import');
  });

  it("opens Android's system picker, which grants the file it returns", async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await importRegistryZipFromPicker();
    expect(mockPick).toHaveBeenCalledWith({
      type: ['application/zip', 'application/zip'],
      mode: 'open',
    });
  });

  it('keeps import mode on iOS, where the picker copies the file', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await importRegistryZipFromPicker();
    expect(mockPick).toHaveBeenCalledWith({
      type: ['application/zip', 'application/zip'],
    });
  });

  it('reads the path behind the file URL the iOS picker returns', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockPick.mockResolvedValue([
      { uri: 'file:///private/var/mobile/tmp/My%20registry.zip' },
    ]);
    expect(await importRegistryZipFromPicker()).toEqual({ ok: true });
    expect(mockReadFile).toHaveBeenCalledWith(
      '/private/var/mobile/tmp/My registry.zip',
      'base64',
    );
  });

  it('hands the content URI to the reader unchanged on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await importRegistryZipFromPicker();
    expect(mockReadFile).toHaveBeenCalledWith(
      'content://registry.zip',
      'base64',
    );
  });

  it.each(['invalid', 'unsaved'] as const)(
    'passes on an adoption refused as %s',
    async reason => {
      mockAdopt.mockResolvedValueOnce({ ok: false, reason, message: 'why' });
      expect(await importRegistryZipFromPicker()).toEqual({
        ok: false,
        reason,
      });
    },
  );

  it('reports a cancelled pick and an unreadable file', async () => {
    mockPick.mockRejectedValueOnce(new Error('cancelled'));
    expect(await importRegistryZipFromPicker()).toEqual({
      ok: false,
      reason: 'cancelled',
    });
    mockPick.mockResolvedValueOnce([{}]);
    expect(await importRegistryZipFromPicker()).toEqual({
      ok: false,
      reason: 'cancelled',
    });
    mockReadFile.mockRejectedValueOnce(new Error('io'));
    expect(await importRegistryZipFromPicker()).toEqual({
      ok: false,
      reason: 'unreadable',
    });
  });

  it('decodes the file without atob too', async () => {
    const atob = (global as any).atob;
    delete (global as any).atob;
    try {
      expect(await importRegistryZipFromPicker()).toMatchObject({
        ok: true,
      });
      expect(Array.from(mockAdopt.mock.calls[0][0])).toEqual([
        ...Buffer.from('zip'),
      ]);
    } finally {
      (global as any).atob = atob;
    }
  });
});
