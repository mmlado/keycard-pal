import React from 'react';
import { ScrollView, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SlidePager, { type Slide } from '../src/components/SlidePager';

const PAGE_WIDTH = 400;

const slides: Slide[] = [
  { key: 'a', label: 'First', content: <Text>Slide A</Text> },
  { key: 'b', label: 'Second', content: <Text>Slide B</Text> },
  { key: 'c', label: 'Third', content: <Text>Slide C</Text> },
];

function layOut(width = PAGE_WIDTH) {
  fireEvent(screen.getByTestId('slide-pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } },
  });
}

function swipeTo(x: number) {
  fireEvent(screen.getByTestId('slide-pager'), 'momentumScrollEnd', {
    nativeEvent: {
      contentOffset: { x, y: 0 },
      contentSize: { width: PAGE_WIDTH * slides.length, height: 600 },
      layoutMeasurement: { width: PAGE_WIDTH, height: 600 },
    },
  });
}

function selected(index: number) {
  return screen.getByTestId(`slide-dot-${index}`).props.accessibilityState
    .selected;
}

describe('SlidePager', () => {
  const scrollToSpy = (ScrollView as any).prototype.scrollTo as jest.Mock;

  beforeEach(() => {
    scrollToSpy.mockClear();
  });

  it('renders every slide and one dot per slide, the first current', () => {
    render(<SlidePager slides={slides} />);

    expect(screen.getByText('Slide A')).toBeTruthy();
    expect(screen.getByText('Slide B')).toBeTruthy();
    expect(screen.getByText('Slide C')).toBeTruthy();
    expect(selected(0)).toBe(true);
    expect(selected(1)).toBe(false);
    expect(selected(2)).toBe(false);
  });

  it('labels each dot as a button with its slide', () => {
    render(<SlidePager slides={slides} />);

    expect(screen.getByLabelText('Third')).toBeTruthy();
    expect(screen.getByTestId('slide-dot-2').props.accessibilityRole).toBe(
      'button',
    );
  });

  it('follows a swipe to the page it settles on', () => {
    render(<SlidePager slides={slides} />);
    layOut();

    swipeTo(PAGE_WIDTH * 2);
    expect(selected(2)).toBe(true);
    expect(selected(0)).toBe(false);

    swipeTo(PAGE_WIDTH * 0.6);
    expect(selected(1)).toBe(true);
  });

  it('stays within the pages when the scroll bounces past either end', () => {
    render(<SlidePager slides={slides} />);
    layOut();

    swipeTo(-PAGE_WIDTH);
    expect(selected(0)).toBe(true);

    swipeTo(PAGE_WIDTH * 5);
    expect(selected(2)).toBe(true);
  });

  it('ignores a swipe before the pager has a width', () => {
    render(<SlidePager slides={slides} />);
    layOut(0);

    swipeTo(PAGE_WIDTH * 2);

    expect(selected(0)).toBe(true);
  });

  it('scrolls to a slide when its dot is pressed', () => {
    render(<SlidePager slides={slides} />);
    layOut();

    fireEvent.press(screen.getByTestId('slide-dot-1'));

    expect(scrollToSpy).toHaveBeenCalledWith({
      x: PAGE_WIDTH,
      animated: true,
    });
    expect(selected(1)).toBe(true);
  });

  it('ignores a scroll that does not settle a swipe', () => {
    render(<SlidePager slides={slides} />);
    layOut();

    fireEvent.scroll(screen.getByTestId('slide-pager'), {
      nativeEvent: { contentOffset: { x: PAGE_WIDTH * 2, y: 0 } },
    });

    expect(selected(0)).toBe(true);
  });

  it('leaves the pager alone when a layout keeps its size', () => {
    render(<SlidePager slides={slides} />);
    layOut();
    swipeTo(PAGE_WIDTH * 2);

    layOut();

    expect(screen.getByTestId('slide-pager').props.contentOffset).toEqual({
      x: 0,
      y: 0,
    });
    expect(selected(2)).toBe(true);
  });

  it('opens on the current slide again at a new width', () => {
    render(<SlidePager slides={slides} />);
    layOut();
    swipeTo(PAGE_WIDTH * 2);

    layOut(600);

    expect(screen.getByTestId('slide-pager').props.contentOffset).toEqual({
      x: 1200,
      y: 0,
    });
    expect(selected(2)).toBe(true);
  });
});
