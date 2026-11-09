import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';
import { Icon } from './ui';
import { Dots, useShake } from './motion';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

/** One key: a soft disc blooms behind the digit while it's held. */
function Key({
  k,
  hidden,
  dark,
  height,
  onKey,
  onLongPress,
}: {
  k: string;
  hidden: boolean;
  dark?: boolean;
  height: number;
  onKey: (k: string) => void;
  onLongPress?: () => void;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const to = (toValue: number) =>
    Animated.spring(v, { toValue, useNativeDriver: true, stiffness: 520, damping: 30, mass: 0.6 }).start();
  const ink = dark ? colors.onInk : colors.foreground;
  return (
    <Pressable
      disabled={hidden}
      onPress={() => onKey(k)}
      onLongPress={onLongPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      accessibilityRole="button"
      accessibilityLabel={k === '⌫' ? 'Delete' : k}
      style={[styles.key, { height }, hidden && { opacity: 0 }]}
    >
      <Animated.View
        style={[
          styles.bloom,
          {
            width: height,
            height,
            borderRadius: height / 2,
            backgroundColor: dark ? colors.inkRaised : colors.accent,
            opacity: v,
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }] }}>
        {k === '⌫' ? (
          <Icon name="delete" size={26} color={ink} />
        ) : (
          <Text style={[styles.keyText, { color: ink }]}>{k}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** On-screen numeric keypad (no system keyboard — fewer mistakes at the till). */
export function Keypad({
  onKey,
  allowDecimal = true,
  dark,
  keyHeight = 60,
  onClear,
}: {
  onKey: (k: string) => void;
  allowDecimal?: boolean;
  dark?: boolean;
  keyHeight?: number;
  /** Holding delete clears everything. */
  onClear?: () => void;
}) {
  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <Key
          key={k}
          k={k}
          hidden={k === '.' && !allowDecimal}
          dark={dark}
          height={keyHeight}
          onKey={onKey}
          onLongPress={k === '⌫' ? onClear : undefined}
        />
      ))}
    </View>
  );
}

function PinDot({ on, dark }: { on: boolean; dark?: boolean }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: on ? 1 : 0, useNativeDriver: true, stiffness: 520, damping: 20, mass: 0.6 }).start();
  }, [on, v]);
  const ink = dark ? colors.onInk : colors.foreground;
  return (
    <View style={[styles.dot, { borderColor: dark ? colors.inkBorder : colors.accent }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dotFill, { backgroundColor: ink, opacity: v, transform: [{ scale: v }] }]} />
    </View>
  );
}

/** A 6-digit secret entered on the keypad, shown as dots. Never kept beyond the form. */
export function PinPad({
  value,
  onChange,
  length = 6,
  dark,
  error,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  dark?: boolean;
  /** Shakes the dots whenever a new error arrives. */
  error?: string | null;
  busy?: boolean;
}) {
  const { style, shake } = useShake();
  useEffect(() => {
    if (error) shake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  const onKey = (k: string) => {
    if (k === '⌫') onChange(value.slice(0, -1));
    else if (/^\d$/.test(k) && value.length < length) onChange(value + k);
  };
  return (
    <View>
      <View style={styles.dotsSlot}>
        {busy ? (
          <Dots color={dark ? colors.onInk : colors.foreground} size={10} />
        ) : (
          <Animated.View style={[styles.dots, style]} accessibilityLabel={`${value.length} of ${length} digits entered`}>
            {Array.from({ length }).map((_, i) => (
              <PinDot key={i} on={i < value.length} dark={dark} />
            ))}
          </Animated.View>
        )}
      </View>
      <Keypad onKey={onKey} allowDecimal={false} dark={dark} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs },
  key: { width: '33.33%', alignItems: 'center', justifyContent: 'center' },
  bloom: { position: 'absolute' },
  keyText: { fontFamily: fonts.medium, fontSize: 28, lineHeight: 34 },
  dotsSlot: { height: 64, marginVertical: space.sm, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  dotFill: { borderRadius: 8, margin: -1.5 },
});
