# 0010. One bundled icon set (Material Design Icons) on both platforms

Date: 2026-09-13

The tile dashboard (#288) and leading icons on every menu row (#231) needed some
twenty icons and raised whether iOS should render SF Symbols instead of the MDI
set the app bundles. Both platforms render the bundled MDI set, in outline
variants, declared once under semantic keys in `src/assets/icons/index.ts` so a
glyph can be swapped without touching call sites. Two constraints decided it.
The Xcode and Apple SDKs Agreement, section 2.10, licenses system images solely
for applications running on Apple systems, so SF Symbol artwork cannot ship in
the Android build in any form, exported SVG included. And every maintained way to
render SF Symbols from bare React Native adds native code to both platforms:
`expo-symbols` and `sweet-sfsymbols` need Expo modules, `react-native-sfsymbols`
is a legacy-bridge module without Fabric, and `react-native-nitro-sfsymbols`
raises the floor to iOS 16.

## Considered options

- **SF Symbols on iOS, MDI on Android.** Forks the icon language for glyphs MDI
  already has, and the renderer's Android native code would then need ADR-0009's
  flavor scoping purely to stay out of the offline build.
- **Google Material Symbols.** A second icon dependency with no advantage over
  MDI's 7,448 glyphs.

## Consequences

- No new native module and no new permission surface.
- The iconography does not match iOS conventions glyph for glyph; the SF Symbol
  equivalents are recorded in the #288 notes should that ever change. The
  licence constraint on the Android build does not expire.
