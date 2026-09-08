# 0009. Online-only native modules are kept out of autolinking and linked into the full flavor by hand

Date: 2026-09-08
Status: accepted

## Context

ADR-0002 isolates online-only features at build time, but only on the
JavaScript side: Metro swaps `.online` modules for `.offline` stubs. React
Native's Android autolinking has no equivalent. It links every native package
in `node_modules` into every product flavor, in three places at once: the Gradle
dependency, the generated `PackageList.java`, and the generated
`autolinking.cpp` that gives each Java TurboModule its C++ spec provider.

So the offline APK shipped `@walletconnect/react-native-compat` with everything
it drags in (JNA, the Yttrium uniffi Rust runtime, about 2.4 MB of native
libraries per ABI) and `@react-native-community/netinfo`, whose manifest adds
`ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` to a build whose whole point is
declaring no network permissions (#270). Nothing invoked that code, which is
also why the JNA/R8 launch crash of 1.9.0 and 1.9.1 only hit the full flavor;
it was absent by accident, not by construction.

## Decision

Native packages that only the Online build needs are excluded from Android
autolinking in `react-native.config.js` (`platforms: { android: null }`) and
wired into the `full` flavor by hand, reproducing exactly what autolinking
would have generated, one artifact per place autolinking touches:

- `android/settings.gradle` includes their Gradle projects under the names
  autolinking would have used.
- `android/app/build.gradle` adds them as `fullImplementation` and passes their
  codegen directories to CMake on the full flavor only.
- `android/app/src/full/.../OnlineNativePackages.kt` registers their
  `ReactPackage`s; the `src/offline` twin returns an empty list.
- `android/app/src/main/jni/CMakeLists.txt` links their `react_codegen_*`
  targets and `online/OnlineModuleProvider.cpp` resolves their TurboModule
  specs, reaching React Native's stock `OnLoad.cpp` through its
  `REACT_NATIVE_APP_MODULE_PROVIDER` hook. `OnLoad.cpp` itself is not copied.

`scripts/check-offline-apk.js` scans an offline APK for the excluded classes
and native libraries; `npm run smoke offline` and the release workflow run it,
so the exclusion is enforced on the artifact rather than trusted.

## Considered options

- **`dependencyConfiguration: fullImplementation` in `react-native.config.js`
  alone.** Scopes the Gradle dependency but not `PackageList.java`, which
  keeps `new RNWalletConnectModulePackage()` for every flavor and no longer
  compiles on offline. Fixing that needs a stub class in the third party's
  package namespace or a per-variant rewrite of a generated file.
- **Gradle `exclude` rules on the offline configurations.** Same
  `PackageList.java` problem, plus configuration-level excludes are meant for
  transitive dependencies and their effect on direct project dependencies is
  incidental.
- **An environment-dependent `react-native.config.js`.** The settings plugin
  runs `react-native config` once per Gradle invocation and caches the result,
  so one invocation could only ever produce one configuration; `assembleFull*`
  and `assembleOffline*` in one command (as CI runs them) would get whichever
  came first, silently.
- **Copying `OnLoad.cpp` into the app.** Works, but every React Native upgrade
  would then require diffing the copy against upstream. The app-module-provider
  hook is the documented extension point and leaves `OnLoad.cpp` upstream-owned.

## Consequences

- Adding an online-only native module means touching four files:
  `react-native.config.js`, `settings.gradle`, the full flavor's
  `OnlineNativePackages.kt`, and `OnlineModuleProvider.cpp` (`build.gradle`
  and `CMakeLists.txt` iterate the list from `settings.gradle`). Forgetting
  the C++ provider does not fail the build: the Java module is registered but
  `TurboModuleRegistry.get` returns null at runtime, and the WalletConnect
  shim only logs that. Verify a new module on a device, in the full flavor.
- The C++ provider hijacks the hook React Native reserves for the app's own
  codegen. If Keycard Pal ever adds a `codegenConfig` to `package.json`, the
  two definitions collide at compile time (loudly), and the provider must move
  into the app's generated module provider.
- The JNA keep rules in `proguard-rules.pro` stay: they are inert on offline
  and still load-bearing on full.
- iOS is untouched; it has no offline flavor and keeps autolinking these pods.

## Revisit

If React Native's autolinking becomes flavor-aware (per-variant
`autolinking.json`, or `buildTypes`-style scoping extended to product flavors),
move the packages back under autolinking and delete the hand wiring. If
WalletConnect drops the uniffi/JNA dependency, the size and crash arguments
weaken but the permission and audit arguments remain.
