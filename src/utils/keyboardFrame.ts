import { Keyboard, Platform, type KeyboardMetrics } from 'react-native';

export function onKeyboardFrame(
  listener: (frame: KeyboardMetrics | null) => void,
): () => void {
  // Android sends no keyboardWill events.
  const ios = Platform.OS === 'ios';
  const show = Keyboard.addListener(
    ios ? 'keyboardWillShow' : 'keyboardDidShow',
    event => listener(event.endCoordinates),
  );
  const hide = Keyboard.addListener(
    ios ? 'keyboardWillHide' : 'keyboardDidHide',
    () => listener(null),
  );
  return () => {
    show.remove();
    hide.remove();
  };
}
