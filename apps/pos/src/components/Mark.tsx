import React from 'react';
import { Image, ImageStyle, StyleProp, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

const MARK = require('../assets/petrapay_mark.png');
const MARK_WHITE = require('../assets/petrapay_mark_white.png');

/** Mark + "PetraPay", as in the web app's header. */
export function PetraLogo({ size = 32, light }: { size?: number; light?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }}>
      <PetraMark size={size} light={light} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.62, letterSpacing: -0.3, color: light ? colors.onInk : colors.foreground }}>PetraPay</Text>
    </View>
  );
}

/** The PetraPay hexagon. `light` is the white version for dark surfaces. */
export function PetraMark({ size = 32, light, style }: { size?: number; light?: boolean; style?: StyleProp<ImageStyle> }) {
  return <Image source={light ? MARK_WHITE : MARK} fadeDuration={0} style={[{ width: size, height: size }, style]} accessibilityIgnoresInvertColors />;
}
