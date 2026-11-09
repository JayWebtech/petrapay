import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Image,
  ImageStyle,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, type } from '../theme';
import { Dots, ease, FadeIn, Press, Spinner, useShake } from './motion';

// ── Text ──────────────────────────────────────────────────────────────────────

type Variant = keyof typeof type;
export function T({
  v = 'body',
  style,
  children,
  ...rest
}: { v?: Variant; style?: StyleProp<TextStyle>; children: React.ReactNode } & React.ComponentProps<typeof Text>) {
  return (
    <Text style={[type[v], style]} {...rest}>
      {children}
    </Text>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

/** Lucide icons (ISC), rendered to stencil PNGs so they can be tinted. */
const ICONS = {
  'arrow-left': require('../assets/icons/arrow_left.png'),
  'arrow-right': require('../assets/icons/arrow_right.png'),
  'arrow-up-right': require('../assets/icons/arrow_up_right.png'),
  x: require('../assets/icons/x.png'),
  settings: require('../assets/icons/settings.png'),
  'receipt-text': require('../assets/icons/receipt_text.png'),
  check: require('../assets/icons/check.png'),
  printer: require('../assets/icons/printer.png'),
  plus: require('../assets/icons/plus.png'),
  delete: require('../assets/icons/delete.png'),
  'chevron-down': require('../assets/icons/chevron_down.png'),
  'chevron-right': require('../assets/icons/chevron_right.png'),
  lock: require('../assets/icons/lock.png'),
  landmark: require('../assets/icons/landmark.png'),
  wallet: require('../assets/icons/wallet.png'),
  smartphone: require('../assets/icons/smartphone.png'),
  'log-out': require('../assets/icons/log_out.png'),
  'rotate-cw': require('../assets/icons/rotate_cw.png'),
  'shield-check': require('../assets/icons/shield_check.png'),
  'key-round': require('../assets/icons/key_round.png'),
  'wifi-off': require('../assets/icons/wifi_off.png'),
  mail: require('../assets/icons/mail.png'),
  'user-round': require('../assets/icons/user_round.png'),
  clock: require('../assets/icons/clock.png'),
  search: require('../assets/icons/search.png'),
  'triangle-alert': require('../assets/icons/triangle_alert.png'),
  info: require('../assets/icons/info.png'),
  'qr-code': require('../assets/icons/qr_code.png'),
  'circle-x': require('../assets/icons/circle_x.png'),
  nfc: require('../assets/icons/nfc.png'),
  'credit-card': require('../assets/icons/credit_card.png'),
  eye: require('../assets/icons/eye.png'),
  'eye-off': require('../assets/icons/eye_off.png'),
};
export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color = colors.foreground,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
}) {
  return <Image source={ICONS[name]} fadeDuration={0} style={[{ width: size, height: size, tintColor: color }, style]} />;
}

/** A round icon button, for headers. */
export function IconButton({
  name,
  onPress,
  label,
}: {
  name: IconName;
  onPress?: () => void;
  label: string;
}) {
  return (
    <Press
      onPress={onPress}
      hitSlop={8}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
    >
      <Icon name={name} size={20} />
    </Press>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function Screen({
  title,
  onBack,
  right,
  children,
  scroll = true,
  footer,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scrollBody, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {(title || onBack) && (
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {onBack ? <IconButton name="arrow-left" label="Back" onPress={onBack} /> : null}
          </View>
          <T v="heading" style={styles.headerTitle} numberOfLines={1}>
            {title}
          </T>
          <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
        </View>
      )}
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'inverse' | 'ghostDark';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  size = 'lg',
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
  icon?: IconName;
}) {
  const v = buttonVariants[variant];
  const inactive = disabled || loading;
  const tint = v.text.color as string;
  return (
    <Press
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={label}
      disabled={!!inactive}
      onPress={onPress}
      style={[styles.button, size === 'md' && styles.buttonMd, v.box, disabled && !loading && { opacity: 0.35 }, style]}
    >
      {loading ? (
        <Spinner size={22} color={tint} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'md' ? 18 : 20} color={tint} /> : null}
          <Text style={[styles.buttonText, size === 'md' && { fontSize: 14 }, v.text]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Press>
  );
}

const buttonVariants: Record<ButtonVariant, { box: ViewStyle; text: TextStyle }> = {
  primary: { box: { backgroundColor: colors.primary }, text: { color: colors.primaryForeground } },
  secondary: { box: { backgroundColor: colors.muted }, text: { color: colors.foreground } },
  outline: { box: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, text: { color: colors.foreground } },
  destructive: { box: { backgroundColor: colors.destructiveSoft }, text: { color: colors.destructive } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.foreground } },
  inverse: { box: { backgroundColor: colors.onInk }, text: { color: colors.ink } },
  ghostDark: { box: { backgroundColor: 'transparent' }, text: { color: colors.onInkMuted } },
};

// ── Containers ────────────────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />;
}

export function KeyValue({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
      <T v="small">{label}</T>
      {typeof value === 'string' ? (
        <T v="label" style={[{ flexShrink: 1, textAlign: 'right', marginLeft: space.md }, mono && { fontFamily: fonts.mono }]}>
          {value}
        </T>
      ) : (
        value
      )}
    </Row>
  );
}

/** A tappable row in a settings-style list. */
export function ListRow({
  icon,
  label,
  sublabel,
  onPress,
  last,
  danger,
}: {
  icon: IconName;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  const tint = danger ? colors.destructive : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.listRow, !last && styles.listRowLine, pressed && { backgroundColor: colors.muted }]}
    >
      <View style={[styles.listIcon, danger && { backgroundColor: colors.destructiveSoft }]}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="label" style={{ color: tint }}>{label}</T>
        {sublabel ? <T v="small">{sublabel}</T> : null}
      </View>
      {danger ? null : <Icon name="chevron-right" size={18} color={colors.mutedForeground} />}
    </Pressable>
  );
}

/** A label that opens to reveal more, for what most people never need to see. */
export function Disclosure({
  label,
  children,
  defaultOpen = false,
  style,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const turn = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const toggle = () => {
    Animated.timing(turn, { toValue: open ? 0 : 1, duration: 260, easing: ease.out, useNativeDriver: true }).start();
    setOpen(!open);
  };
  const tint = colors.mutedForeground;
  return (
    <View style={[{ alignSelf: 'stretch' }, style]}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.disclosure}
      >
        <T v="label" style={{ color: tint }}>{label}</T>
        <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Icon name="chevron-down" size={16} color={tint} />
        </Animated.View>
      </Pressable>
      {open ? <FadeIn rise={8} duration={320}>{children}</FadeIn> : null}
    </View>
  );
}

/** A panel that rises from the bottom over a dimmed screen. */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(v, { toValue: 1, useNativeDriver: true, stiffness: 260, damping: 28, mass: 0.9 }).start();
    } else {
      Animated.timing(v, { toValue: 0, duration: 200, easing: ease.inOut, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, v]);

  // Registered after the navigator's handler, so it runs first.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm },
          { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [640, 0] }) }] },
        ]}
      >
        <View style={styles.sheetGrip} />
        {children}
      </Animated.View>
    </View>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────

// While a password is showing it's plain text to the keyboard, which must not
// capitalise it, correct it or learn it.
const PASSWORD_INPUT: TextInputProps = { autoCapitalize: 'none', autoCorrect: false, spellCheck: false };

/** Passing `secureTextEntry` adds an eye button to show or hide what's typed. */
export function Input({
  label,
  error,
  secureTextEntry,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Shared storefront device: once a password is cleared, the next one starts hidden.
  useEffect(() => {
    if (!props.value) setRevealed(false);
  }, [props.value]);

  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <T v="label" style={{ marginBottom: 6 }}>{label}</T> : null}
      <View>
        <TextInput
          placeholderTextColor="#A3A3A3"
          // Shared storefront device: never let Android Autofill / password
          // managers save credentials, codes or account numbers typed here.
          autoComplete="off"
          importantForAutofill="no"
          {...(secureTextEntry ? PASSWORD_INPUT : null)}
          {...props}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.input,
            secureTextEntry && styles.inputWithEye,
            focused && styles.inputFocused,
            error ? { borderColor: colors.destructive } : null,
            props.style,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={styles.inputEye}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {error ? <T v="small" style={{ color: colors.destructive, marginTop: 4 }}>{error}</T> : null}
    </View>
  );
}

/** A 6-digit code shown as boxes; the real input sits invisibly on top of them. */
export function CodeBoxes({
  value,
  onChange,
  length = 6,
  autoFocus,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  label?: string;
}) {
  const [focused, setFocused] = useState(!!autoFocus);
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <T v="label" style={{ marginBottom: 6 }}>{label}</T> : null}
      <View style={styles.codeRow}>
        {Array.from({ length }).map((_, i) => {
          const digit = value[i];
          const current = focused && i === Math.min(value.length, length - 1);
          return (
            <View key={i} style={[styles.codeBox, digit ? styles.codeBoxFilled : null, current && styles.codeBoxCurrent]}>
              {digit ? (
                <FadeIn key={digit} rise={6} duration={220} scaleFrom={0.7}>
                  <Text style={styles.codeDigit}>{digit}</Text>
                </FadeIn>
              ) : null}
            </View>
          );
        })}
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={length}
          autoFocus={autoFocus}
          autoComplete="off"
          importantForAutofill="no"
          caretHidden
          accessibilityLabel={label ?? `${length}-digit code`}
          style={styles.codeInput}
        />
      </View>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const pos = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(pos, { toValue: index, useNativeDriver: true, stiffness: 340, damping: 28, mass: 0.8 }).start();
  }, [index, pos]);
  const cell = width > 0 ? (width - 8) / options.length : 0;
  const last = options.length - 1;
  return (
    <View style={[styles.segmented, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cell > 0 ? (
        <Animated.View
          style={[
            styles.segmentThumb,
            {
              width: cell,
              transform: [{ translateX: pos.interpolate({ inputRange: [0, last], outputRange: [0, cell * last] }) }],
            },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.segment, compact && { height: 34 }]}
          >
            <Text style={[type.label, compact && { fontSize: 13 }, { color: on ? colors.primaryForeground : colors.foreground }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Status ────────────────────────────────────────────────────────────────────

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'dark';
const tones: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  neutral: { bg: colors.muted, fg: colors.mutedForeground, icon: 'info' },
  info: { bg: colors.primarySoft, fg: colors.primary, icon: 'info' },
  success: { bg: colors.successSoft, fg: colors.success, icon: 'check' },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'triangle-alert' },
  danger: { bg: colors.destructiveSoft, fg: colors.destructive, icon: 'triangle-alert' },
  dark: { bg: colors.ink, fg: colors.onInk, icon: 'info' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[type.caption, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Banner({ tone = 'neutral', title, children }: { tone?: Tone; title?: string; children?: React.ReactNode }) {
  const t = tones[tone];
  return (
    <FadeIn rise={8} duration={360} style={[styles.banner, { backgroundColor: t.bg }]}>
      <Icon name={t.icon} size={18} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[type.label, { color: t.fg }]}>{title}</Text> : null}
        {children ? <Text style={[type.small, { color: tone === 'warning' ? colors.foreground : t.fg, marginTop: title ? 2 : 0 }]}>{children}</Text> : null}
      </View>
    </FadeIn>
  );
}

export function ErrorText({ error, dark }: { error?: string | null; dark?: boolean }) {
  const { style, shake } = useShake();
  useEffect(() => {
    if (error) shake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  if (!error) return null;
  return (
    <Animated.View style={style}>
      <T v="small" style={{ color: dark ? colors.destructiveOnInk : colors.destructive, marginTop: space.sm }}>{error}</T>
    </Animated.View>
  );
}

export function Loading({ color }: { color?: string }) {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <Dots color={color} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    backgroundColor: colors.background,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSide: { minWidth: 44, justifyContent: 'center' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  scrollBody: { padding: space.lg, paddingBottom: space.xxl },
  footer: { padding: space.lg, paddingTop: space.sm, backgroundColor: colors.background },
  button: {
    height: 54,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  buttonMd: { height: 44, borderRadius: radius.md },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  listRowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  listIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  disclosure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.md },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  sheetGrip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginBottom: space.md },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  inputFocused: { borderColor: colors.foreground },
  inputWithEye: { paddingRight: 52 },
  inputEye: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 52, alignItems: 'center', justifyContent: 'center' },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  codeBox: {
    flex: 1,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFilled: { borderColor: colors.foreground },
  codeBoxCurrent: { borderColor: colors.foreground, borderWidth: 2 },
  codeDigit: { fontFamily: fonts.semibold, fontSize: 24, color: colors.foreground },
  codeInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  segmented: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  segmentThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.sm, backgroundColor: colors.primary },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  banner: { flexDirection: 'row', gap: 10, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
});
