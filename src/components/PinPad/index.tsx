import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  loadBooleanPreference,
  preferenceKeys,
} from '../../storage/preferencesStorage';
import theme from '../../theme';

import Keypad from './Keypad';
import PinInput from './PinInput';

interface PinPadProps {
  onComplete: (pin: string) => void;
  error?: string;
  onType?: () => void;
  length?: number;
}

const PIN_LENGTH = 6;

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function normalizePinLength(length: number): number {
  if (!Number.isFinite(length)) {
    return PIN_LENGTH;
  }
  return Math.max(1, Math.floor(length));
}

function shuffleKeys(): string[][] {
  const slots = [...DIGITS];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return [
    [slots[0], slots[1], slots[2]],
    [slots[3], slots[4], slots[5]],
    [slots[6], slots[7], slots[8]],
    ['', slots[9], '⌫'],
  ];
}

function fixedKeys(): string[][] {
  return [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ];
}

export default function PinPad({
  onComplete,
  error,
  onType,
  length = PIN_LENGTH,
}: PinPadProps) {
  const normalizedLength = normalizePinLength(length);
  const [pin, setPin] = useState('');
  const [scramble, setScramble] = useState(false);
  const [padKeys, setPadKeys] = useState(fixedKeys);
  const prevError = useRef(error);
  const pinRef = useRef('');
  const lengthRef = useRef(length);
  const onCompleteRef = useRef(onComplete);
  const onTypeRef = useRef(onType);

  useEffect(() => {
    loadBooleanPreference(preferenceKeys.pinPadScramble).then(setScramble);
  }, []);

  useEffect(() => {
    if (scramble) {
      setPadKeys(shuffleKeys());
    } else {
      setPadKeys(fixedKeys());
    }
  }, [scramble]);

  lengthRef.current = normalizedLength;
  onCompleteRef.current = onComplete;
  onTypeRef.current = onType;

  useEffect(() => {
    if (scramble && error && error !== prevError.current) {
      setPadKeys(shuffleKeys());
    }
    prevError.current = error;
  }, [error, scramble]);

  const handleKey = useCallback((key: string) => {
    if (key !== '') {
      onTypeRef.current?.();
    }
    if (key === '⌫') {
      const next = pinRef.current.slice(0, -1);
      pinRef.current = next;
      setPin(next);
      return;
    }
    if (pinRef.current.length >= lengthRef.current) {
      return;
    }

    const next = pinRef.current + key;
    if (next.length === lengthRef.current) {
      pinRef.current = '';
      onCompleteRef.current(next);
      setPin('');
    } else {
      pinRef.current = next;
      setPin(next);
    }
  }, []);

  return (
    <View style={styles.container}>
      <PinInput
        enteredLength={pin.length}
        error={error}
        length={normalizedLength}
      />
      <Keypad keys={padKeys} onKey={handleKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
