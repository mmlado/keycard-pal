import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

import { onKeyboardFrame } from '@/utils/keyboardFrame';

export const FIELD_GAP = 16;

// The whole block, so Revert and Save stay above the keyboard too.
type FieldBlock = ComponentRef<typeof View>;
type FieldHandler = (block: FieldBlock | null) => void;

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
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const focusedBlock = useRef<FieldBlock | null>(null);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef(Number.POSITIVE_INFINITY);

  const scrollFieldIntoView = useCallback(() => {
    const block = focusedBlock.current;
    if (!block) return;
    block.measureInWindow((_x, y, _width, height) => {
      const hidden = y + height + FIELD_GAP - keyboardTop.current;
      if (hidden > 0) {
        scrollRef.current?.scrollTo({
          y: scrollOffset.current + hidden,
          animated: true,
        });
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onKeyboardFrame(frame => {
      keyboardTop.current = frame ? frame.screenY : Number.POSITIVE_INFINITY;
    });
    if (Platform.OS !== 'ios') return unsubscribe;
    // UIKit scrolls a focused field flush with the keyboard during its animation, which can
    // land after ours; scrolling again once the keyboard settles restores FIELD_GAP.
    const settled = Keyboard.addListener('keyboardDidShow', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      scrollFieldIntoView();
    });
    return () => {
      unsubscribe();
      settled.remove();
    };
  }, [scrollFieldIntoView]);

  // Moving between fields with the keyboard already up fires nothing else.
  const handleField = useCallback(
    (block: FieldBlock | null) => {
      focusedBlock.current = block;
      scrollFieldIntoView();
    },
    [scrollFieldIntoView],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scrollRef}
        // The viewport the keyboard shrank exists only once it has laid out.
        onLayout={scrollFieldIntoView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        <FieldContext.Provider value={handleField}>
          {children}
        </FieldContext.Provider>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** For a field inside the scroll area: spread `block` on its whole block and `input` on its TextInput. */
export function useKeepAboveKeyboard() {
  const onField = useContext(FieldContext);
  const ref = useRef<FieldBlock>(null);
  const focused = useRef(false);

  const onFocus = useCallback(() => {
    focused.current = true;
    onField(ref.current);
  }, [onField]);

  const onBlur = useCallback(() => {
    focused.current = false;
    onField(null);
  }, [onField]);

  // Revert and Save appear after the field was scrolled into view.
  const onLayout = useCallback(() => {
    if (focused.current) onField(ref.current);
  }, [onField]);

  return { block: { ref, onLayout }, input: { onFocus, onBlur } };
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
