import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { api } from '../api/client';
import { Banner, Button, Card, ErrorText, KeyValue, Screen, Segmented, T } from '../components/ui';
import { testPage } from '../lib/receipt';
import { usePrinter } from '../native/usePrinter';
import { useNav } from '../navigation';
import { useMe, useSession } from '../state/session';
import { colors, space } from '../theme';

/** Only what a till needs: this terminal, the printer, and unpairing. */
export function SettingsScreen() {
  const nav = useNav();
  const me = useMe();
  const { prefs, setPrefs, unpair } = useSession();
  const printer = usePrinter();
  const [confirming, setConfirming] = useState(false);

  return (
    <Screen title="Settings" onBack={nav.pop}>
      <T v="caption" style={styles.section}>THIS TERMINAL</T>
      <Card>
        <KeyValue label="Business" value={me.merchantName} />
        <KeyValue label="Terminal" value={me.deviceName} />
        <KeyValue label="Server" value={api.server().replace(/^https?:\/\//, '')} />
      </Card>

      <T v="caption" style={styles.section}>SALES</T>
      <Card>
        <T v="label">Charge in</T>
        <Segmented
          style={{ marginTop: space.sm }}
          options={[
            { value: 'USD', label: 'US dollars' },
            { value: 'ZEC', label: 'ZEC' },
          ]}
          value={prefs.currency}
          onChange={(currency) => setPrefs({ currency })}
        />
        <T v="small" style={{ marginTop: space.sm }}>
          {prefs.currency === 'USD'
            ? 'You receive ZEC worth the dollar amount at the moment the customer pays.'
            : 'You receive exactly the ZEC amount you charge.'}
        </T>
      </Card>

      <T v="caption" style={styles.section}>RECEIPT PRINTER</T>
      <Card>
        {printer.available === false ? (
          <Banner tone="neutral" title="No printer found">
            This device has no built-in receipt printer. Sales still work; customers keep their receipt link instead.
          </Banner>
        ) : (
          <>
            <Pressable style={styles.toggleRow} onPress={() => setPrefs({ autoPrint: !prefs.autoPrint })} accessibilityRole="switch">
              <View style={{ flex: 1 }}>
                <T v="label">Print receipt automatically</T>
                <T v="small">When a payment completes on this terminal</T>
              </View>
              <Switch
                value={prefs.autoPrint}
                onValueChange={(autoPrint) => setPrefs({ autoPrint })}
                trackColor={{ true: colors.primary, false: colors.accent }}
                thumbColor={colors.card}
              />
            </Pressable>
            <Button
              label={printer.printing ? 'Printing…' : 'Print a test page'}
              variant="outline"
              size="md"
              icon="printer"
              disabled={printer.printing || printer.available === null}
              onPress={() => printer.print(testPage(me))}
              style={{ marginTop: space.md }}
            />
            <ErrorText error={printer.error} />
          </>
        )}
      </Card>

      <T v="caption" style={styles.section}>PAIRING</T>
      <Card>
        <T v="small">
          Unpairing signs this terminal out. Past sales stay in your dashboard. To pair again you&apos;ll need a new code.
        </T>
        {confirming ? (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button label="Keep" variant="secondary" size="md" onPress={() => setConfirming(false)} style={{ flex: 1 }} />
            <Button label="Unpair now" variant="destructive" size="md" onPress={() => unpair()} style={{ flex: 1 }} />
          </View>
        ) : (
          <Button label="Unpair this terminal" variant="destructive" size="md" icon="log-out" onPress={() => setConfirming(true)} style={{ marginTop: space.md }} />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, marginBottom: space.sm, letterSpacing: 0.6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
