# 0009. Online-only native modules are kept out of autolinking and linked into the full flavor by hand

Date: 2026-09-08

ADR-0002 isolates online features on the JavaScript side only. Android
autolinking links every native package into every flavor, in the Gradle
dependency, the generated `PackageList.java` and the generated `autolinking.cpp`,
so the offline APK shipped WalletConnect's compat module with its native
libraries and `@react-native-community/netinfo`, whose manifest added
`ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` to a build whose point is
declaring no network permission (#270). Those packages are excluded from
autolinking in `react-native.config.js` and wired into the `full` flavor by hand,
one artifact per place autolinking touches: `settings.gradle` includes their
projects, `build.gradle` adds them as `fullImplementation` and passes their
codegen directories to CMake, `OnlineNativePackages.kt` registers their packages
(the offline twin returns nothing), and `OnlineModuleProvider.cpp` resolves their
TurboModule specs through React Native's `REACT_NATIVE_APP_MODULE_PROVIDER` hook.
`check-offline-apk.js` enforces the exclusion on the artifact.

## Considered options

- **`dependencyConfiguration: fullImplementation` alone.** Scopes the Gradle
  dependency but leaves `PackageList.java` instantiating the package for every
  flavor, so offline no longer compiles.
- **An environment-dependent `react-native.config.js`.** The settings plugin
  runs `react-native config` once per Gradle invocation, so building both
  flavors in one command would silently get one configuration.
- **Copying `OnLoad.cpp` into the app.** Works, but every React Native upgrade
  would mean diffing the copy; the module-provider hook is the documented
  extension point.

## Consequences

- Adding such a module touches four files. A forgotten C++ provider does not
  fail the build: the module is null at runtime and the shim only logs, so a new
  module is verified on a device in the full flavor.
- The provider uses the hook React Native reserves for the app's own codegen; a
  future `codegenConfig` would collide at compile time and the provider would
  move into the generated module provider.
- iOS has no offline flavor and keeps autolinking these pods. Reconsider when
  autolinking becomes flavor-aware.
