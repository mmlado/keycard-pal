import React, { useCallback, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import theme from '@/theme';

export type Slide = {
  key: string;
  // What a screen reader says for the slide's dot.
  label: string;
  content: React.ReactNode;
};

export type SlidePagerProps = {
  slides: Slide[];
};

export default function SlidePager({ slides }: SlidePagerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: windowWidth, height: 0, page: 0 });
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { width } = size;

  const showPage = useCallback((index: number) => {
    pageRef.current = index;
    setPage(index);
  }, []);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSize(prev =>
      prev.width === w && prev.height === h
        ? prev
        : { width: w, height: h, page: pageRef.current },
    );
  }, []);

  // Only a settled swipe moves the page: a resize clamps the offset and fires onScroll.
  const handleSwipeEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) {
        return;
      }
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      showPage(Math.min(Math.max(index, 0), slides.length - 1));
    },
    [showPage, slides.length, width],
  );

  const goTo = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * width, animated: true });
      showPage(index);
    },
    [showPage, width],
  );

  return (
    <View style={styles.container}>
      {/* Remounted at a new width: Android keeps the old pixel offset and snaps it to another page. */}
      <ScrollView
        key={Math.round(width)}
        ref={scrollRef}
        horizontal
        pagingEnabled
        contentOffset={{ x: size.page * width, y: 0 }}
        showsHorizontalScrollIndicator={false}
        onLayout={handleLayout}
        onMomentumScrollEnd={handleSwipeEnd}
        style={styles.pager}
        testID="slide-pager"
      >
        {slides.map(({ key, content }, index) => (
          <ScrollView
            key={key}
            style={{ width, height: size.height }}
            contentContainerStyle={styles.page}
            testID={`slide-${index}`}
          >
            {content}
          </ScrollView>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map(({ key, label }, index) => (
          // Padding, not hitSlop: overlapping areas hand the tap to the next dot.
          <Pressable
            key={key}
            style={styles.dotTarget}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: index === page }}
            onPress={() => goTo(index)}
            testID={`slide-dot-${index}`}
          >
            <View style={[styles.dot, index === page && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dotTarget: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.outline,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
});
