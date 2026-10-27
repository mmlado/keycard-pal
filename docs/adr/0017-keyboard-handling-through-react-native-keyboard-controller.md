# 0017. Keyboard handling goes through react-native-keyboard-controller

Date: 2026-10-26

Screens that take typing keep their bottom action and their focused field clear of
the keyboard. React Native's keyboard events report the height on Android without
the navigation bar and arrive only once the keyboard has landed, and its
KeyboardAvoidingView resizes in one step, so the app had grown its own pieces around
them: a bottom action area, a keyboard-frame source, and a scroll area that measured
a field's block, scrolled it, and on iOS scrolled again once UIKit had moved the
field itself. Keyboard handling now goes through react-native-keyboard-controller
(MIT), which follows Android's inset animation and iOS's keyboard frame by frame,
with react-native-reanimated and react-native-worklets as its required native peers.
The app keeps its seams, `KeyboardAwareScrollView` with `useKeepAboveKeyboard` and
`BottomActionArea`, as thin adapters over the library, so no screen knows which of
them does the work.

## Considered options

- **Keep the in-house pieces.** About 150 lines, measured on a phone and with no
  dependency, but every keyboard edge case stays ours to find, and the movement
  stays a jump.
- **react-native-keyboard-aware-scroll-view.** JavaScript only, unmaintained, and
  blind to edge-to-edge insets.

## Consequences

- Reanimated and Worklets ship in both flavors, the offline one included: a larger
  APK, more native code to build, the Worklets Babel plugin, and Reanimated's Jest
  resolver beside the library's and Reanimated's mocks. Reproducible release builds
  (ADR-0015) have to be re-proven with every version change of the three.
- The library keeps a focused input's caret `bottomOffset` above the keyboard, not a
  whole block, and the caret sits at a different height in its input on each
  platform. A field reports its input's height and how far its block reaches below
  the input (Revert, Save and the error line), the library reports the caret, and
  the scroll area adds the part below the caret to `bottomOffset`.
- `KeyboardProvider` wraps the app with the status and navigation bars translucent
  and edge-to-edge preserved, because React Native already draws edge to edge. With
  the navigation bar translucent, the library reports the whole keyboard on Android,
  so nothing adds the bar back. It does not preload the keyboard, which would show
  it for a moment at launch.
- iOS needs `pod install` and the lock committed with every version change.
- Revisit if the library or Reanimated leaves the React Native line the app is on.
