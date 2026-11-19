const {
  appCrash,
  appPids,
  installFailure,
} = require('../scripts/lib/smoke-log');

// Lines as a Redmi 9T (MIUI 12, Android 10) logs them around an install and launch.
const MIUI_NOISE = [
  '11-19 07:50:42.276  1568  1738 I ActivityManager: Start proc 6612:com.xiaomi.discover/u0a109 for service {com.xiaomi.discover/com.xiaomi.market.service.ManualUpdateScheduler} caller=android',
  '11-19 07:50:42.363  6590  6590 E LoadedApk: Unable to instantiate appComponentFactory',
  '11-19 07:50:42.363  6590  6590 E LoadedApk: java.lang.ClassNotFoundException: Didn\'t find class "androidx.core.app.CoreComponentFactory" on path: DexPathList[[zip file "/system/app/Updater/Updater.apk"]]',
  '11-19 07:56:07.132 16430 16483 D WM-WorkManagerImpl: java.lang.ClassNotFoundException: androidx.work.multiprocess.RemoteWorkManagerClient',
];

const START = (pid, id) =>
  `11-19 07:52:27.244  1568  1738 I ActivityManager: Start proc ${pid}:${id}/u0a256 for activity {${id}/com.keycardpal.MainActivity} caller=null`;

const CRASH_IN = pid => [
  `11-19 07:52:29.001  ${pid}  ${pid} E AndroidRuntime: FATAL EXCEPTION: main`,
  `11-19 07:52:29.001  ${pid}  ${pid} E AndroidRuntime: Process: com.keycardpal, PID: ${pid}`,
  `11-19 07:52:29.001  ${pid}  ${pid} E AndroidRuntime: java.lang.NoClassDefFoundError: a.b.c`,
];

const join = (...groups) => groups.flat().join('\n');

describe('appPids', () => {
  it("takes the app's pids from ActivityManager and no other app's", () => {
    const log = join(
      MIUI_NOISE,
      START(14292, 'com.keycardpal'),
      START(15762, 'com.keycardpal.standalone'),
      START(15800, 'com.keycardpal'),
    );
    expect([...appPids(log, 'com.keycardpal')]).toEqual(['14292', '15800']);
    expect([...appPids(log, 'com.keycardpal.standalone')]).toEqual(['15762']);
  });

  it("counts a secondary process of the app as the app's", () => {
    const log =
      '11-19 07:52:28.100  1568  1738 I ActivityManager: Start proc 14300:com.keycardpal:remote/u0a256 for service {com.keycardpal/x.Y} caller=com.keycardpal';
    expect([...appPids(log, 'com.keycardpal')]).toEqual(['14300']);
  });

  it('reads the offline application id', () => {
    const log = join(
      START(200, 'com.keycardpal'),
      START(201, 'com.keycardpal.offline'),
    );
    expect([...appPids(log, 'com.keycardpal.offline')]).toEqual(['201']);
  });
});

describe('appCrash', () => {
  it("passes over other apps' errors", () => {
    const log = join(START(14292, 'com.keycardpal'), MIUI_NOISE);
    expect(appCrash(log, appPids(log, 'com.keycardpal'))).toBeNull();
  });

  it("reports the app's own crash with only its own lines after it", () => {
    const log = join(
      START(14292, 'com.keycardpal'),
      CRASH_IN(14292).slice(0, 2),
      MIUI_NOISE,
      CRASH_IN(14292).slice(2),
    );
    expect(appCrash(log, appPids(log, 'com.keycardpal'))).toBe(
      CRASH_IN(14292).join('\n'),
    );
  });

  it('reports a crash in a process that has since restarted', () => {
    const log = join(
      START(14292, 'com.keycardpal'),
      CRASH_IN(14292),
      START(14400, 'com.keycardpal'),
    );
    expect(appCrash(log, appPids(log, 'com.keycardpal'))).toContain(
      'FATAL EXCEPTION',
    );
  });

  it('stops the trace after 25 lines', () => {
    const frames = Array.from(
      { length: 40 },
      (_, i) =>
        `11-19 07:52:29.002  14292  14292 E AndroidRuntime: \tat a.b(c:${i})`,
    );
    const log = join(START(14292, 'com.keycardpal'), CRASH_IN(14292), frames);
    expect(appCrash(log, new Set(['14292'])).split('\n')).toHaveLength(25);
  });

  it('finds nothing without a pid', () => {
    expect(appCrash(join(CRASH_IN(14292)), new Set())).toBeNull();
  });
});

describe('installFailure', () => {
  it("gives adb's own message", () => {
    const error = Object.assign(new Error('Command failed: adb install'), {
      stdout: 'Performing Streamed Install\n',
      stderr:
        'adb: failed to install x.apk: Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]\n',
    });
    expect(installFailure(error)).toBe(
      'Performing Streamed Install\n\nadb: failed to install x.apk: Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]',
    );
  });

  it("names MIUI's prompt when MIUI refused the install", () => {
    const error = Object.assign(new Error('Command failed: adb install'), {
      stdout: '',
      stderr:
        'adb: failed to install x.apk: Failure [INSTALL_FAILED_USER_RESTRICTED: Install canceled by user]',
    });
    expect(installFailure(error)).toMatch(
      /INSTALL_FAILED_USER_RESTRICTED[\s\S]*"Install via USB" prompt/,
    );
  });

  it('falls back to the error message when adb printed nothing', () => {
    expect(installFailure(new Error('spawn adb ENOENT'))).toBe(
      'spawn adb ENOENT',
    );
  });
});
