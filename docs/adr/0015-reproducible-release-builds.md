# 0015. Release APKs build byte for byte the same anywhere

Date: 2026-09-20
Status: accepted

## Context

f-droid.org can ship an app under the developer's own signature only when its
buildserver produces the same APK the developer published (#316). That matters
here: a copy signed by F-Droid could not update, or be updated by, the builds
from GitHub and `fdroid.keycardpal.com`, and the choice is fixed at the first
merge.

Two release builds of the same commit did not match. With two checkouts at
different paths and two Gradle homes, 10 of 912 APK entries differed, all of
them native libraries:

- `libappmodules.so` and the `libreact_codegen_*` libraries embed
  `/home/<user>/.gradle/caches/...` through `__FILE__` in React Native's prefab
  headers. The home directory is `/home/runner` on GitHub and `/home/vagrant` on
  the F-Droid buildserver.
- Every native library carries a `.note.gnu.build-id` that the linker hashes
  over debug info still holding absolute paths. That includes libraries built by
  their own CMake project (`librnscreens`), where the app's compiler flags never
  arrive.

## Decision

`android/reproducible-builds.gradle`, applied from `android/app/build.gradle`:

- passes `-ffile-prefix-map` for the checkout and for the Gradle home to the
  app's CMake build;
- removes `.note.gnu.build-id` from every release native library, in `doLast` of
  AGP's own `strip<Variant>DebugSymbols` task. A separate task would race AGP's.

Release builds use JDK 17 from Temurin, in the release workflow and in the
F-Droid recipes (Debian's OpenJDK 17 there, which gives the same bytes).

## What is part of the output, and what is not

Measured on both flavors, comparing whole universal APK files by SHA-256:

- **The JDK major version is.** JDK 17 and 21 give a different `classes.dex`,
  baseline profile and `kotlin-tooling-metadata.json`.
- **The JDK patch level is not.** Temurin 17.0.18 and 17.0.20 agree.
- **The JDK's zlib is.** AGP compresses APK entries and the baseline profile
  with `java.util.zip.Deflater`. Temurin bundles zlib, and Debian's OpenJDK 17
  (bookworm and trixie) links Debian's mainline zlib; the two agree. A JDK that
  links the system `libz.so.1` on a distribution that ships zlib-ng, Fedora for
  one, produces different compressed bytes: Zulu, the Microsoft build and distro
  JDKs there. `ldd $JAVA_HOME/lib/libzip.so | grep libz` prints nothing when
  zlib is bundled, which is the safe case.
- **The Node version is not.** The offline bundle is identical under Node
  22.22.2, 22.22.3 and 24.13.1.
- **A `WC_PROJECT_ID` in the environment or `.env` is**, for the full flavor.
  No release build has one (#328), and builds are only compared without it.

## Considered options

- **Let F-Droid sign.** No build work, but a second signature that splits the
  user base for good.
- **Build inside a fixed path or container everywhere.** Hides the path problem
  instead of removing it, and the F-Droid buildserver's path is not ours to set.
- **Strip the build id in a separate Gradle task.** Races AGP's strip task.

## Consequences

- Anyone can rebuild a release and compare it with the published file.
- A release must never be built with a JDK that links a non-mainline system
  zlib. On a Fedora machine that means Temurin only.
- The proof has to be repeated after a React Native, AGP, NDK or JDK upgrade:
  two `git worktree` checkouts at different paths, a second `GRADLE_USER_HOME`
  seeded with a copy of `~/.gradle/caches/modules-2`,
  `assembleOfflineRelease assembleFullRelease` in both, then compare the
  universal APKs entry by entry.

## Revisit when

- The release workflow moves to another JDK major or vendor.
- React Native stops embedding absolute paths in prefab headers, which would
  make the path mapping unnecessary.
- F-Droid's buildserver image changes its JDK or zlib.
