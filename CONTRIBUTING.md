# Contributing

Thanks for looking. Keycard Pal is a small, security-sensitive app, so this file is mostly
about the handful of rules that are easy to break without knowing they exist.

Start with [README.md](README.md) for what the app does and how to build it, and with
[CONTEXT.md](CONTEXT.md) for the vocabulary. The words matter here: "signing source of truth"
and "convenience metadata" are different things, and reviews will use those terms.

## Setup

```sh
npm install
npm start          # Metro, terminal 1
npm run android    # terminal 2
npm run ios        # or this
```

Node 22.13 or later, JDK 17, Android SDK platform 37 with build-tools 37.0.0 and NDK
27.1.12297006. The offline flavour runs with `npm run start:offline` and
`npm run android:offline`, and only one Metro can serve at a time: an offline app served by
an online Metro crashes at startup on the first missing native module, loudly and on purpose.

## What has to pass

These are the CI jobs, run exactly as CI runs them. A pull request that skips them fails
there instead.

```sh
npm test               # jest; CI runs it with coverage
npm run lint           # eslint over the whole repo, not just src and __tests__
npm run typecheck      # must report zero errors, not "no new errors"
npm run format:check   # prettier in check mode
npm run check:bundles  # bundles the app both ways and checks each direction
```

Two of those have a writing counterpart worth knowing. `npm run format` applies the
formatting that `format:check` verifies, and `npx jest --no-coverage` is quicker while you
iterate, though it is not what CI measures.

`check:bundles` is the Offline bundle check job. It takes under a minute and needs no Android
toolchain, and it is the one that catches an online import reaching the offline build. CI also
runs an iOS bundle check on every pull request, which builds an iOS bundle and fails if it
carries any affiliate marker; `npm run check:ios-bundle -- --bundle <file>` is the same check
against a bundle you have already built.

## The rules that catch people out

**The online and offline builds are separated at build time, not at runtime.** Shared code
imports `.online` modules; the offline build swaps them for `.offline` stubs through a Metro
resolver. A stub must import no online-only package, RPC client or endpoint string, and every
stub ends with the parity guard from `src/utils/onlineParity.ts` so the type checker fails on
any drift between the pair. A `Platform.OS` ternary is not a boundary: both sides ship.

**Every network-touching feature is opt-in**, disabled until the user turns it on in Settings.
See [`docs/adr/0003-network-features-are-opt-in.md`](docs/adr/0003-network-features-are-opt-in.md).

**Release APKs are byte-identical wherever they are built.** That is what lets the F-Droid
build be verified against ours. Anything that bakes a path, a hostname, a timestamp or a
machine address into the output breaks it. See
[ADR 0015](docs/adr/0015-reproducible-release-builds.md) and
`android/reproducible-builds.gradle`.

**Dependencies are not free.** WalletConnect is pinned to its last Apache-2.0 releases and
must not be bumped; a test reads every installed `@reown/*` and `@walletconnect/*` package and
fails on any other licence. A new dependency also needs its licence entry in
`src/data/licenses.ts`, or in `src/data/onlineLicenses.online.ts` if it is online-only, and a
test holds each entry equal to what the installed package declares.

**Do not invent APDU commands.** Everything the app sends must come from the existing
`keycard-sdk` API. Heavy local work belongs before the NFC prompt opens or after the card has
left the field, never while the user is holding a card to the phone.

**Preferences are resolved once at startup** and read synchronously through `usePreferences`.
Adding one touches `src/storage/preferencesStorage.ts` only. Do not read a single preference
after startup or write to storage from a screen.

**The iOS build carries no affiliate link and no advertisement wording**, and an iOS binary
names no other mobile platform. Both are enforced by tests over the built bundle and the
source graph. If a test about "Advertisement" or "Buy a Keycard" fails, read it before
changing it: the wording is a legal constraint, not a style choice.

## Tests

Tests live in `__tests__/` and mirror `src/`. Jest runs two projects, because the two builds
ship different files: the default project sees the iOS variants, and anything under
`__tests__/android/` sees the Android ones. Put a test there only when it must see the Android
build.

Use `@testing-library/react-native` with user-visible queries, mock the icon registry with the
shared proxy mock in `__mocks__/iconsMock.js`, and build preference records with
`testPreferences()` rather than hand-writing partial objects.

If you change a screen, a hook or a utility, add tests for it. Branch coverage on touched
files should stay above 80%. If a branch needs elaborate timer or cancellation mocking, say so
in the pull request instead of leaving it silently untested.

## Code style

`@/` maps to `src/` and is used for anything crossing a folder boundary; relative imports are
for files in the same folder. Imports are grouped, blank line between groups, alphabetical
within each: third-party, internal shared types and theme, components, hooks, then local
files. Apply it to files you are already changing, and do not reorganise files you are not.

Comments are rare and short. One line where a reader would otherwise be misled, nothing that
restates the code, and no history of how a bug was found. That reasoning belongs in the pull
request or in an ADR.

Colours come from `src/theme.ts`. Icons are declared in `src/assets/icons/index.ts` under
semantic keys, so a glyph can be swapped without touching call sites.

## Commits, pull requests and issues

Keep the commit subject short, with a line or two of body if it needs one. The reasoning goes
in the pull request description, which is where a reviewer looks for why rather than what.

An issue says what changes and what the constraints are. It does not carry the story of how it
came up or what was decided in conversation. Two things are worth including because leaving
them out makes an implementer get it wrong: a technical property of the system that is not
obvious from the code, and a trap in an approach that has already been tried.

When you report a defect, give the measurement rather than the impression. "The button's
bottom is 32 px below the keyboard's top edge, in three-button navigation, and clears it by
31 px in gesture navigation" is worth more than "the button is hidden".

## Your name in the app

Anyone whose commit reaches the repository is listed as a contributor on the app's **About
screen**, in the shipped app on every channel, and in `src/data/contributors.json` here. The
list is regenerated from the whole git history at release time and committed with the version
bump, so a merged contribution appears in the next release without anyone adding it by hand.

What appears is the **author name on your commits**. If the commit email is a GitHub noreply
address, `login@users.noreply.github.com` or `id+login@users.noreply.github.com`, the entry
also carries your login and the row links to your GitHub profile. Commits from bots are
skipped.

So set your git author name to whatever you want shown before you commit. If something is
already listed wrongly, say so in the pull request: an entry that exists keeps the name it
has, so a correction survives every later regeneration. If you would rather not be listed at
all, say that too, before the change is merged.

## Changelog and decisions

Add an entry under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md) using `### Added`,
`### Changed`, `### Fixed` or `### Removed`. The changelog describes the difference against the
last release, so a bug introduced and fixed inside the same unreleased cycle gets no entry, and
one shipped feature is one bullet however many commits it took.

Significant architectural or dependency decisions get an ADR in [`docs/adr/`](docs/adr/), with
date, status, context, decision, rationale, consequences and revisit criteria.

## Security

Do not open a public issue for a vulnerability. Use GitHub's private vulnerability reporting on
this repository, under Security, Report a vulnerability.

## How this project is built

Keycard Pal is developed with substantial help from AI coding assistants. That is stated in the
README and on every distribution channel. It does not change what is expected of a contribution:
it is read, tested on real Keycards and real phones, and held to the same checks as anything
else. Say so in the pull request if a change was largely AI-written, the same way the project
says it about itself.

By contributing you agree your work is licensed under the MIT licence, like the rest of the
repository.
