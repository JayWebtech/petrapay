/**
 * PetraPay design tokens, matching the web app (apps/web globals.css): a white,
 * light-only theme with PetraPay blue as the primary colour and deep navy for
 * the few full-bleed surfaces (splash, hero). Text uses the device's system font.
 */
export const colors = {
  background: '#FFFFFF',
  foreground: '#110F24',
  card: '#FFFFFF',
  muted: '#F5F4FA',
  mutedForeground: '#66647A',
  accent: '#EEEDF5',
  border: '#E6E4F0',
  primary: '#072AC8',
  primaryForeground: '#FFFFFF',
  primarySoft: '#EEF1FD',
  success: '#067647',
  successSoft: '#E7F6EC',
  warning: '#9A3F00',
  warningSoft: '#FFF1E6',
  destructive: '#D92D20',
  destructiveSoft: '#FDECEC',
  overlay: 'rgba(11,10,36,0.55)',
  // Deep navy surfaces: splash and the home hero.
  ink: '#0B0A24',
  inkRaised: '#1B1A3A',
  inkBorder: '#2C2B4D',
  onInk: '#FFFFFF',
  onInkMuted: '#A9A7C4',
  destructiveOnInk: '#FF8A80',
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const fonts = {
  regular: 'sans-serif',
  medium: 'sans-serif-medium',
  semibold: 'sans-serif-medium',
  mono: 'monospace',
};

export const type = {
  hero: { fontFamily: fonts.semibold, fontSize: 46, lineHeight: 54, letterSpacing: -1, color: colors.foreground },
  display: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6, color: colors.foreground },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2, color: colors.foreground },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.foreground },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.foreground },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.foreground },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.mutedForeground },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
} as const;
