import React from 'react';

import type { Slide } from '@/components/SlidePager';

import IntroSlide from './IntroSlide';
import StepSlide, { stepPosition, WELCOME_STEPS } from './StepSlide';

export const WELCOME_SLIDES: Slide[] = [
  { key: 'intro', label: 'Welcome', content: <IntroSlide /> },
  ...WELCOME_STEPS.map((step, index) => ({
    key: step.title,
    label: stepPosition(index),
    content: <StepSlide step={step} index={index} />,
  })),
];
