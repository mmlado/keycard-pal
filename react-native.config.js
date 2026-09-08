// Native packages listed under `dependencies` with `android: null` are kept
// out of React Native's Android autolinking. Autolinking is not flavor-aware:
// everything it links lands in every product flavor, so an online-only native
// module would ship in the offline APK too (#270). These packages are instead
// wired only into the `full` flavor by hand, in android/settings.gradle (project
// include), android/app/build.gradle (fullImplementation), android/app/src/full
// (ReactPackage registration) and android/app/src/main/jni (TurboModule C++
// provider). iOS keeps autolinking them; it has no offline flavor.
const ONLINE_ONLY_ANDROID_PACKAGES = [
  '@walletconnect/react-native-compat',
  '@react-native-community/netinfo',
];

module.exports = {
  assets: ['./src/assets/fonts/Inter/static/'],
  dependencies: Object.fromEntries(
    ONLINE_ONLY_ANDROID_PACKAGES.map(name => [
      name,
      { platforms: { android: null } },
    ]),
  ),
};
