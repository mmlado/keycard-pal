import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  type TextLayoutEvent,
  type TextStyle,
} from 'react-native';

import theme from '../theme';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BTC_BECH32_RE =
  /^(bc1|tb1|bcrt1)[023456789acdefghjklmnpqrstuvwxyz]{11,}$/i;
const BTC_BASE58_RE = /^[13mn2][A-HJ-NP-Za-km-z1-9]{25,62}$/;

/** React Native's own default, used when the caller sets no size. */
const DEFAULT_FONT_SIZE = 14;
/** Below this an address reads worse shrunk than wrapped. */
const MIN_FIT_SCALE = 0.8;
/** Headroom for rounding in the second layout pass. */
const FIT_MARGIN = 0.99;

export function isDisplayAddress(value: string): boolean {
  return (
    ETH_ADDRESS_RE.test(value) ||
    BTC_BECH32_RE.test(value) ||
    BTC_BASE58_RE.test(value)
  );
}

function chunkAddress(address: string): { prefix: string; groups: string[] } {
  const hasHexPrefix = address.startsWith('0x') || address.startsWith('0X');
  const prefix = hasHexPrefix ? address.slice(0, 2) : '';
  const body = hasHexPrefix ? address.slice(2) : address;
  const groups = body.match(/.{1,4}/g) ?? [];
  return { prefix, groups };
}

export default function AddressText({
  address,
  selectable = false,
  style,
}: {
  address: string;
  selectable?: boolean;
  style?: TextStyle | TextStyle[];
}) {
  const { prefix, groups } = chunkAddress(address);
  const flattened = StyleSheet.flatten(style);
  const activeColor = flattened?.color ?? theme.colors.onSurface;
  const baseSize = flattened?.fontSize ?? DEFAULT_FONT_SIZE;
  const [scale, setScale] = useState(1);

  useEffect(() => setScale(1), [address]);

  // A split address is easy to misread; one a little smaller on one line is not.
  const handleTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      const { lines } = event.nativeEvent;
      if (scale !== 1 || lines.length < 2 || !ETH_ADDRESS_RE.test(address)) {
        return;
      }
      const needed = lines.reduce((sum, line) => sum + line.width, 0);
      const room = Math.max(...lines.map(line => line.width));
      const fit = (room / needed) * FIT_MARGIN;
      if (fit >= MIN_FIT_SCALE) setScale(fit);
    },
    [address, scale],
  );

  return (
    <Text
      selectable={selectable}
      style={[
        styles.address,
        style,
        scale !== 1 && { fontSize: baseSize * scale },
      ]}
      onTextLayout={handleTextLayout}
    >
      {prefix ? (
        <Text style={[styles.address, { color: theme.colors.onSurfaceMuted }]}>
          {prefix}
        </Text>
      ) : null}
      {groups.map((group, index) => (
        <Text
          key={`${index}-${group}`}
          style={[
            styles.address,
            index % 2 === 0 ? styles.activeGroup : null,
            {
              color:
                index % 2 === 0 ? activeColor : theme.colors.onSurfaceSubtle,
            },
          ]}
        >
          {group}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  address: {
    fontFamily: theme.monospace,
  },
  activeGroup: {
    fontWeight: '600',
  },
});
