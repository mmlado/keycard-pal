# 0010. One bundled icon set (Material Design Icons) on both platforms

Date: 2026-09-13
Status: accepted

## Context

Turning the dashboard into a tile grid (#288) and giving every menu row a
leading icon (#231) needs roughly twenty new icons, which raised the question
of whether iOS should render the platform-native set instead of the one the app
bundles today.

The two platforms are not symmetric. iOS ships SF Symbols with the OS, and at
the app's 15.1 deployment target the safe subset is SF Symbols 3. Android ships
no comparable set: `android.R.drawable` is about 170 legacy Holo-era assets
tied to old system chrome, and Material Symbols is a separate download that an
app bundles itself, exactly as this app already bundles Pictogrammers MDI
through `@react-native-vector-icons/material-design-icons`.

Two constraints decided it. First, licensing: the Xcode and Apple SDKs
Agreement section 2.10 licenses system-provided images "solely for the purpose
of developing Applications for Apple-branded products that run on the system
for which the image was provided", so SF Symbol artwork cannot ship inside the
Android build in any form, including exported SVG. Second, cost: every
maintained way to render SF Symbols from bare React Native adds native code to
both platforms. `expo-symbols` and `sweet-sfsymbols` require adopting Expo
modules, which links six extra native packages into the Android build for an
iOS-only visual; `react-native-sfsymbols` is a legacy-bridge module with no
Fabric story, last published June 2024; `react-native-nitro-sfsymbols` raises
the floor to iOS 16 and is a nine-star project. The vector-icons monorepo has
no SF Symbols or Material Symbols package at all.

## Decision

Both platforms render the bundled MDI set. Icons are declared once in
`src/assets/icons/index.ts` under semantic keys (`Icons.settings`, not
`Icons.cogOutline`) so a glyph can be swapped without touching call sites.
Outline variants are used throughout, matching the icons already in place.

## Considered options

- **SF Symbols on iOS, MDI on Android.** Forks the icon language between
  platforms for glyphs MDI already covers, and every renderer option installs
  Android-side native code that would then need the ADR-0009 flavor-scoping
  treatment purely to keep it out of the offline build.
- **Export SF Symbols to SVG and bundle them.** Same artwork, same licence
  clause, and nothing in the build would catch the assets reaching the Android
  APK.
- **Switch to Google Material Symbols.** A second icon dependency with no
  advantage over MDI, whose 7,448 glyphs already cover every entry.

## Consequences

- One icon vocabulary across iOS and Android, consistent with the existing
  chevron, close, copy and check icons.
- No new native module, so nothing to add to `react-native.config.js`,
  `settings.gradle` or `check-offline-apk.js`, and no new permission surface.
- The app's iconography will not match iOS conventions glyph for glyph. On
  Android it matches the platform's own icon family.
- SF Symbol and Material Symbol equivalents for each entry are recorded in the
  issue #288 planning notes, so a future switch does not restart the research.

## Revisit

If a maintained renderer appears that adds no Android native code and no Expo
dependency, and the product wants platform-native iconography, revisit for iOS
only. The licence constraint on shipping the artwork in the Android build does
not expire.
