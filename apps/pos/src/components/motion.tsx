import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../theme';

/**
 * The app's motion kit. Everything here runs on the native driver (transform
 * and opacity only), so it stays smooth on the terminal's low-end chip even
 * while the JS thread is polling or printing.
 */

export const ease = {
  /** Quick start, long settle: the default for things arriving on screen. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function useLoop(make: () => Animated.CompositeAnimation) {
  useEffect(() => {
    const a = make();
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Arrivals ──────────────────────────────────────────────────────────────────

/** Fade and rise once on mount. Stagger siblings with `delay`. */
export function FadeIn({
  children,
  delay = 0,
  duration = 460,
  rise = 14,
  scaleFrom,
  style,
}: {
  children?: React.ReactNode;
  delay?: number;
  duration?: number;
  rise?: number;
  scaleFrom?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: ease.out, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, duration, delay]);
  const transform: any[] = [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }];
  if (scaleFrom !== undefined) transform.push({ scale: v.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }) });
  return <Animated.View style={[style, { opacity: v, transform }]}>{children}</Animated.View>;
}

export type Direction = 'push' | 'pop' | 'swap';

/** How a screen arrives: from the right going forward, from the left going back. */
export function ScreenEnter({ direction, children }: { direction: Direction; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1,
      duration: direction === 'swap' ? 200 : 300,
      easing: ease.out,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, direction]);
  const dx = direction === 'push' ? 44 : direction === 'pop' ? -44 : 0;
  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ── Touch ─────────────────────────────────────────────────────────────────────

/** A pressable that gives under the finger and springs back. */
export function Press({
  scaleTo = 0.97,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (toValue: number) =>
    Animated.spring(s, { toValue, useNativeDriver: true, stiffness: 420, damping: 26, mass: 0.7 }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e: any) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e: any) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale: s }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** A horizontal head-shake for "no": wrong PIN, a key that does nothing. */
export function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = () => {
    x.setValue(0);
    const step = (toValue: number, duration: number) =>
      Animated.timing(x, { toValue, duration, easing: Easing.linear, useNativeDriver: true });
    Animated.sequence([step(9, 45), step(-9, 70), step(6, 60), step(-4, 50), step(0, 40)]).start();
  };
  return { style: { transform: [{ translateX: x }] }, shake };
}

/** A brief bump when a value changes under the finger. */
export function usePop(amount = 1.04) {
  const s = useRef(new Animated.Value(1)).current;
  const pop = () => {
    s.setValue(amount);
    Animated.spring(s, { toValue: 1, useNativeDriver: true, stiffness: 500, damping: 18, mass: 0.6 }).start();
  };
  return { style: { transform: [{ scale: s }] }, pop };
}

// ── Waiting ───────────────────────────────────────────────────────────────────

/** A rotating arc. */
export function Spinner({
  size = 22,
  thickness,
  color = colors.foreground,
  track = 'rgba(128,128,128,0.25)',
}: {
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useLoop(() =>
    Animated.loop(Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }))
  );
  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness ?? Math.max(2, size / 10),
        borderColor: track,
        borderTopColor: color,
        transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    />
  );
}

/** Three dots taking turns: the app's general "one moment". */
export function Dots({ color = colors.foreground, size = 8 }: { color?: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useLoop(() =>
    Animated.loop(Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }))
  );
  return (
    <View style={{ flexDirection: 'row', gap: size }} accessibilityRole="progressbar">
      {[0, 1, 2].map((i) => {
        const start = i * 0.18;
        const progress = v.interpolate({
          inputRange: [start, start + 0.2, start + 0.42, 1],
          outputRange: [0, 1, 0, 0],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.7] }) }],
            }}
          />
        );
      })}
    </View>
  );
}

/** A placeholder block that breathes while content loads. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useLoop(() =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 650, easing: ease.inOut, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 650, easing: ease.inOut, useNativeDriver: true }),
      ])
    )
  );
  return (
    <Animated.View
      style={[
        { backgroundColor: colors.accent, borderRadius: 8 },
        style,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) },
      ]}
    />
  );
}

/** Rings that swell and fade behind a shape: "listening for the payment". */
export function PulseRings({
  width,
  height,
  borderRadius,
  color = colors.foreground,
  grow = 34,
}: {
  width: number;
  height: number;
  borderRadius: number;
  color?: string;
  grow?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useLoop(() =>
    Animated.loop(Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }))
  );
  return (
    <>
      {[0, 0.5].map((offset) => {
        // Two rings on one clock, half a turn apart.
        const inputRange = offset === 0 ? [0, 1] : [0, 0.5, 0.5001, 1];
        const phase = (from: number, to: number) =>
          v.interpolate({
            inputRange,
            outputRange:
              offset === 0 ? [from, to] : [from + (to - from) / 2, to, from, from + (to - from) / 2],
          });
        return (
          <Animated.View
            key={offset}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width,
              height,
              borderRadius,
              borderWidth: 1.5,
              borderColor: color,
              opacity: phase(0.3, 0),
              transform: [{ scaleX: phase(1, 1 + grow / width) }, { scaleY: phase(1, 1 + grow / height) }],
            }}
          />
        );
      })}
    </>
  );
}

/** A slow nudge along x, for an arrow that wants to be followed. */
export function Nudge({ children, distance = 4 }: { children: React.ReactNode; distance?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useLoop(() =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 620, easing: ease.inOut, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 620, easing: ease.inOut, useNativeDriver: true }),
        Animated.delay(900),
      ])
    )
  );
  return (
    <Animated.View style={{ transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, distance] }) }] }}>
      {children}
    </Animated.View>
  );
}

// ── Numbers ───────────────────────────────────────────────────────────────────

/** Counts towards `target` and always lands on it exactly. */
export function useCountUp(target: number, { duration = 850, from = 0 }: { duration?: number; from?: number } = {}) {
  const [value, setValue] = useState(from);
  const shown = useRef(from);
  useEffect(() => {
    const start = shown.current;
    if (start === target) {
      setValue(target);
      return;
    }
    const startedAt = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - startedAt) / duration);
      const next = p === 1 ? target : start + (target - start) * (1 - Math.pow(1 - p, 3));
      shown.current = next;
      setValue(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

// ── Progress ──────────────────────────────────────────────────────────────────

/** A bar that fills to `progress` (0–1), springing as it moves. */
export function ProgressBar({
  progress,
  color = colors.foreground,
  track = colors.accent,
  height = 4,
}: {
  progress: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const v = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: progress, duration: 520, easing: ease.out, useNativeDriver: true }).start();
  }, [v, progress]);
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View
        style={{ height, backgroundColor: color, transformOrigin: 'left center', transform: [{ scaleX: v }] }}
      />
    </View>
  );
}

/** Drains in real time from now until `until`; the whole bar is `from`→`until`. */
export function DrainBar({ from, until, color = colors.foreground, track = colors.accent }: { from: string; until: string; color?: string; track?: string }) {
  const start = useMemo(() => {
    const total = new Date(until).getTime() - new Date(from).getTime();
    const left = new Date(until).getTime() - Date.now();
    return { left: Math.max(0, left), fraction: total > 0 ? Math.min(1, Math.max(0, left / total)) : 0 };
  }, [from, until]);
  const v = useRef(new Animated.Value(start.fraction)).current;
  useEffect(() => {
    v.setValue(start.fraction);
    const a = Animated.timing(v, { toValue: 0, duration: start.left, easing: Easing.linear, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, start]);
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={{ height: 3, backgroundColor: color, transformOrigin: 'left center', transform: [{ scaleX: v }] }} />
    </View>
  );
}

// ── Celebration ───────────────────────────────────────────────────────────────

/**
 * A black disc that pops in, then a check that draws itself in two strokes,
 * with a shockwave ring behind it. With `play` off it is simply there.
 */
export function CheckDisc({ size = 104, play = true }: { size?: number; play?: boolean }) {
  const start = play ? 0 : 1;
  const disc = useRef(new Animated.Value(start)).current;
  const short = useRef(new Animated.Value(start)).current;
  const long = useRef(new Animated.Value(start)).current;
  const wave = useRef(new Animated.Value(start)).current;

  useEffect(() => {
    if (!play) return;
    const a = Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.spring(disc, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 13, mass: 0.8 }),
        Animated.timing(wave, { toValue: 1, duration: 900, easing: ease.out, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(short, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(long, { toValue: 1, duration: 210, easing: ease.out, useNativeDriver: true }),
        ]),
      ]),
    ]);
    a.start();
    return () => a.stop();
  }, [play, disc, short, long, wave]);

  const t = size * 0.075;
  const stroke = (leftPct: number, topPct: number, lengthPct: number, deg: number, v: Animated.Value) => (
    <Animated.View
      style={{
        position: 'absolute',
        left: size * leftPct,
        top: size * topPct - t / 2,
        width: size * lengthPct,
        height: t,
        borderRadius: t / 2,
        backgroundColor: colors.onInk,
        transformOrigin: 'left center',
        transform: [{ rotate: `${deg}deg` }, { scaleX: v }],
      }}
    />
  );

  return (
    <View style={[styles.center, { width: size, height: size }]} accessibilityLabel="Paid">
      {play ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: colors.foreground,
            opacity: wave.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.55, 0] }),
            transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.6] }) }],
          }}
        />
      ) : null}
      <Animated.View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink, transform: [{ scale: disc }] }}
      >
        {stroke(0.27, 0.52, 0.235, 45, short)}
        {stroke(0.425, 0.685, 0.44, -47, long)}
      </Animated.View>
    </View>
  );
}

/** Monochrome confetti thrown from the centre of its parent, then falling. */
export function Burst({ count = 30, delay = 140 }: { count?: number; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const reach = 90 + Math.random() * 130;
        return {
          dx: Math.cos(angle) * reach,
          dy: Math.sin(angle) * reach - 40,
          fall: 150 + Math.random() * 190,
          spin: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 480),
          w: 4 + Math.random() * 6,
          h: 7 + Math.random() * 9,
          round: i % 4 === 0,
          color: i % 3 === 0 ? '#9A9A9A' : colors.foreground,
        };
      }),
    [count]
  );
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: 1700, delay, easing: Easing.linear, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: p.w,
            height: p.round ? p.w : p.h,
            borderRadius: p.round ? p.w / 2 : 1.5,
            backgroundColor: p.color,
            opacity: v.interpolate({ inputRange: [0, 0.02, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, p.dx, p.dx * 1.2] }) },
              { translateY: v.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, p.dy, p.dy + p.fall] }) },
              { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
