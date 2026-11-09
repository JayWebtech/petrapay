import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PetraLogo } from '../components/Mark';
import { Dots, FadeIn } from '../components/motion';
import { Button, Icon, T } from '../components/ui';
import { useSession } from '../state/session';
import { colors, space } from '../theme';

export function StartingScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
      <View style={styles.center}>
        <FadeIn rise={0} scaleFrom={0.8} duration={640}>
          <PetraLogo size={56} light />
        </FadeIn>
      </View>
      <FadeIn delay={500} rise={0} style={{ alignItems: 'center', paddingBottom: space.xxl }}>
        <Dots color={colors.onInk} size={7} />
      </FadeIn>
    </SafeAreaView>
  );
}

/** Paired, but the server can't be reached at launch. Nothing is lost; try again. */
export function OfflineScreen() {
  const { retry } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
      <View style={[styles.center, { padding: space.xl }]}>
        <FadeIn rise={0} scaleFrom={0.85} style={styles.offlineIcon}>
          <Icon name="wifi-off" size={36} color={colors.onInk} />
        </FadeIn>
        <FadeIn delay={80} style={{ alignItems: 'center' }}>
          <T v="title" style={{ color: colors.onInk, marginTop: space.xl }}>No connection</T>
          <T v="body" style={{ color: colors.onInkMuted, marginTop: space.sm, textAlign: 'center' }}>
            This terminal can&apos;t reach PetraPay. Check the Wi-Fi or mobile data, then try again.
          </T>
        </FadeIn>
      </View>
      <View style={{ padding: space.lg }}>
        <Button
          label="Try again"
          variant="inverse"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await retry();
            setBusy(false);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  offlineIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: colors.inkBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
