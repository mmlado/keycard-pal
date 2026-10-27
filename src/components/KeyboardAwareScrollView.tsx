import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView as LibraryScrollView,
  useFocusedInputHandler,
} from 'react-native-keyboard-controller';
import { scheduleOnRN } from 'react-native-worklets';

export const FIELD_GAP = 16;

type Field = { inputHeight: number; belowInput: number };
type FieldHandler = (field: Field | null) => void;

// Fields sit several components deep, so they reach the scroll area through context.
const FieldContext = createContext<FieldHandler>(() => {});

export default function KeyboardAwareScrollView({
  children,
  style,
  contentContainerStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const [field, setField] = useState<Field | null>(null);
  const [caretBottom, setCaretBottom] = useState<number | null>(null);

  useFocusedInputHandler(
    {
      onSelectionChange: event => {
        'worklet';
        scheduleOnRN(setCaretBottom, event.selection.end.y);
      },
    },
    [],
  );

  // The library keeps only the caret clear, and the caret's height in its input differs per platform.
  let reach = 0;
  if (field) {
    const caret = Math.min(
      Math.max(caretBottom ?? field.inputHeight, 0),
      field.inputHeight,
    );
    reach = field.inputHeight - caret + field.belowInput;
  }

  return (
    <LibraryScrollView
      bottomOffset={FIELD_GAP + reach}
      style={style}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
    >
      <FieldContext.Provider value={setField}>{children}</FieldContext.Provider>
    </LibraryScrollView>
  );
}

/** Spread `block` on the field's block and `input` on its TextInput, a direct child of it. */
export function useKeepAboveKeyboard() {
  const onField = useContext(FieldContext);
  const focused = useRef(false);
  const blockHeight = useRef(0);
  const input = useRef({ bottom: 0, height: 0 });

  const report = useCallback(() => {
    if (focused.current) {
      onField({
        inputHeight: input.current.height,
        belowInput: blockHeight.current - input.current.bottom,
      });
    }
  }, [onField]);

  const onFocus = useCallback(() => {
    focused.current = true;
    report();
  }, [report]);

  const onBlur = useCallback(() => {
    focused.current = false;
    onField(null);
  }, [onField]);

  // Revert, Save and the error line change how far the block reaches.
  const onBlockLayout = useCallback(
    (event: LayoutChangeEvent) => {
      blockHeight.current = event.nativeEvent.layout.height;
      report();
    },
    [report],
  );

  const onInputLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      input.current = { bottom: y + height, height };
      report();
    },
    [report],
  );

  return {
    block: { onLayout: onBlockLayout },
    input: { onFocus, onBlur, onLayout: onInputLayout },
  };
}
