// The smoke run's verdict from `adb logcat -d -v threadtime`, limited to the app's own processes.

const CRASH =
  /FATAL EXCEPTION|UnsatisfiedLinkError|ClassNotFoundException|NoSuchMethodError/;
const THREADTIME_PID = /^\d\d-\d\d \d\d:\d\d:\d\d\.\d+\s+(\d+)\s+\d+\s/;
const TRACE_LINES = 25;

/** Every pid the app ran under, from ActivityManager's `Start proc <pid>:<applicationId>` lines. */
function appPids(log, applicationId) {
  const id = applicationId.replace(/\./g, '\\.');
  // The lookahead keeps com.keycardpal from matching com.keycardpal.offline.
  const start = new RegExp(`Start proc (\\d+):${id}(?=[/:\\s])`);
  const pids = new Set();
  for (const line of log.split('\n')) {
    const match = line.match(start);
    if (match) {
      pids.add(match[1]);
    }
  }
  return pids;
}

/** The first crash line from one of `pids` and that process's lines after it, or null. */
function appCrash(log, pids) {
  const own = log.split('\n').filter(line => {
    const match = line.match(THREADTIME_PID);
    return match && pids.has(match[1]);
  });
  const first = own.findIndex(line => CRASH.test(line));
  return first === -1 ? null : own.slice(first, first + TRACE_LINES).join('\n');
}

/** What adb said when an install failed, in place of Node's stack trace. */
function installFailure(error) {
  const said =
    `${error.stdout || ''}\n${error.stderr || ''}`.trim() || error.message;
  return said.includes('INSTALL_FAILED_USER_RESTRICTED')
    ? `${said}\nMIUI refuses an adb install until Install is tapped on its "Install via USB" prompt.`
    : said;
}

module.exports = { appCrash, appPids, installFailure };
