import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import type { Currency } from '../api/types';
import { Keypad } from '../components/Keypad';
import { usePop, useShake } from '../components/motion';
import { Button, ErrorText, IconButton, Segmented, T } from '../components/ui';
import { DECIMALS, MINIMUM, money, newKey, typedAmount } from '../lib/format';
import { useNav } from '../navigation';
import { useSession } from '../state/session';
import { colors, space, type } from '../theme';

/**
 * Ringing up a sale is one decision: how much. The customer picks how to pay on
 * their own phone after scanning, so the till never asks which token or chain.
 */
export function NewSaleScreen() {
  const nav = useNav();
  const { prefs, setPrefs } = useSession();
  const [currency, setCurrency] = useState<Currency>(prefs.currency);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per sale attempt: a retry after a dropped connection can't create a second sale.
  const key = useRef(newKey());
  const amountPop = usePop();
  const amountShake = useShake();

  const amount = Number(raw || '0');
  const tooSmall = amount > 0 && amount < MINIMUM[currency];

  const onKey = (k: string) => {
    key.current = newKey();
    setError(null);
    let next: string;
    if (k === '⌫') next = raw.slice(0, -1);
    else if (k === '.') next = raw.includes('.') ? raw : (raw || '0') + '.';
    else {
      next = raw === '0' ? k : raw + k;
      const [, frac] = next.split('.');
      if ((frac && frac.length > DECIMALS[currency]) || next.replace('.', '').length > 12) next = raw;
    }
    if (next === raw) return amountShake.shake();
    setRaw(next);
    amountPop.pop();
  };

  const charge = async () => {
    if (busy || amount <= 0 || tooSmall) return;
    setBusy(true);
    setError(null);
    try {
      const sale = await api.createSale({ amount: raw.replace(/\.$/, ''), currency }, key.current);
      key.current = newKey();
      nav.replace({ name: 'payment', id: sale.id, initial: sale });
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton name="arrow-left" label="Back" onPress={nav.pop} />
        <Segmented
          compact
          style={{ width: 136 }}
          options={[
            { value: 'USD', label: 'USD $' },
            { value: 'ZEC', label: 'ZEC' },
          ]}
          value={currency}
          onChange={(c) => {
            setCurrency(c);
            setPrefs({ currency: c });
            setRaw((r) => {
              const [, frac] = r.split('.');
              return frac && frac.length > DECIMALS[c] ? r.slice(0, r.length - (frac.length - DECIMALS[c])) : r;
            });
            key.current = newKey();
          }}
        />
        <View style={{ width: 42 }} />
      </View>

      <View style={styles.amount}>
        <Animated.View style={[amountShake.style, { alignSelf: 'stretch' }]}>
          <Animated.View style={amountPop.style}>
            <Text style={[type.hero, styles.amountText, !raw && { color: '#BEBCD0' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {typedAmount(raw, currency)}
            </Text>
          </Animated.View>
        </Animated.View>
        <T v="small" style={{ marginTop: space.xs, textAlign: 'center' }}>
          {tooSmall
            ? `The minimum charge is ${money(MINIMUM[currency], currency)}`
            : amount > 0
              ? 'The customer pays with any token; you receive shielded ZEC'
              : 'Enter the amount to charge'}
        </T>
        <ErrorText error={error} />
      </View>

      <View style={styles.pad}>
        <Keypad onKey={onKey} onClear={() => setRaw('')} keyHeight={66} />
        <Button
          label={amount > 0 ? `Charge ${money(amount, currency)}` : 'Charge'}
          disabled={amount <= 0 || tooSmall}
          loading={busy}
          onPress={charge}
          icon={amount > 0 ? 'qr-code' : undefined}
          style={{ marginTop: space.md, height: 58 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  amount: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  amountText: { textAlign: 'center', fontSize: 54, lineHeight: 64 },
  pad: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});
