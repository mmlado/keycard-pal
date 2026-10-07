# 0008. Keycard dependency fixes go upstream first, pinned by commit meanwhile

Date: 2026-08-12

The tag-loss fix needed native changes in `react-native-keycard`, and later a
one-line `await` in `keycard-sdk`, whose 4.0.0 built INIT before the Secure
Channel V2 handshake had finished and so sent the new PIN and PUK in the clear to
a card that refused them with `0x6985`. Such fixes are developed on a fork branch
cut from upstream `main`, submitted as upstream pull requests (Android and iOS
together, the maintainer's one recurring ask), and consumed as a commit-SHA git
dependency: the fork's SHA while the PR is open, the upstream SHA after the merge,
and a version range once a release carries the fix. Never a branch name, which
`npm ci` and `npm install` can resolve differently, never patch-package, and never
an app-side workaround, which copies library logic into the app for someone to
find and delete later. `node_modules` is not a source of truth either: the
bridge's `lib/` is built at install time and was observed stale, so native work
starts with `rm -rf node_modules && npm ci`.

## Consequences

- The app ships without waiting for upstream, and the repoint after a merge is a
  one-line change with no code delta.
- A contract test per dependency reads the installed tree and goes red when a
  bump lands on a build without the fix. `keycardSdkContract.test.ts` guards the
  `^4.0.1` range that replaced the fork pin on 2026-09-21; the bridge keeps its
  pin until upstream cuts releases.
- The bridge takes `keycard-sdk` as a peer dependency, and two installed copies
  break every `instanceof` between them: `npm ls keycard-sdk` must show one.
