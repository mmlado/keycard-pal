# 0015. Release APKs build byte for byte the same anywhere

Date: 2026-09-20

f-droid.org ships an app under the developer's own signature only when its
buildserver reproduces the published APK (#316), and a copy under F-Droid's
signature could never update, or be updated by, the GitHub and
`fdroid.keycardpal.com` builds. Two release builds of one commit from different
paths and Gradle homes differed in 10 of 912 entries: `__FILE__` in React Native's
prefab headers baked the Gradle home into `libappmodules` and the
`libreact_codegen_*` libraries, every native library carried a `.note.gnu.build-id`
hashed over debug info holding absolute paths, and `resources.arsc` held the build
machine's IP address in `react_native_dev_server_ip`, which the React Native
Gradle plugin fills in every variant and which released APKs carried up to
v1.10.0. `android/reproducible-builds.gradle` fixes all three: `-ffile-prefix-map`
for the checkout and the Gradle home on the app's CMake build, `localhost` as the
dev server resource on the release build type, and the build id removed from every
release native library in `doLast` of AGP's own `strip<Variant>DebugSymbols` task,
because a separate task would race it. Release builds use JDK 17 from Temurin;
Debian's OpenJDK 17 on the F-Droid buildserver gives the same bytes.

## Considered options

- **Let F-Droid sign.** No build work, and a user base split for good.
- **Build inside a fixed path everywhere.** Hides the problem, and the
  buildserver's path is not ours to set.
- **Patch the resource out of `node_modules`.** A build type's `resValue` is the
  supported override.

## Consequences

- Measured by whole-file SHA-256 on both flavors: the JDK major is part of the
  output (17 and 21 give a different `classes.dex`), the patch level is not, the
  Node version is not, a `WC_PROJECT_ID` is (no release build has one, #328),
  and the JDK's zlib is. Temurin bundles zlib and Debian links mainline zlib; a
  JDK linking a zlib-ng system library, as distro JDKs, Zulu and Microsoft's build
  do on Fedora, gives different compressed bytes. `ldd $JAVA_HOME/lib/libzip.so |
  grep libz` printing nothing is the safe case.
- Anyone can rebuild a release and compare it with the published file, and no
  release tells its users which network the build machine was on.
- The proof is repeated after a React Native, AGP, NDK or JDK change: two
  worktrees at different paths, a second `GRADLE_USER_HOME`, both release
  assemblies, and an entry-by-entry comparison of the universal APKs.
