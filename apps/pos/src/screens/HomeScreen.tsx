import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import type { Sale } from '../api/types';
import { PetraMark } from '../components/Mark';
import { FadeIn, Nudge, Press, Skeleton } from '../components/motion';
import { Badge, Banner, Card, Icon, IconButton, IconName, Row, T } from '../components/ui';
import { money, saleRef, shortTime } from '../lib/format';
import { useNav } from '../navigation';
import { useMe, useSession } from '../state/session';
import { colors, fonts, radius, space } from '../theme';
import { statusLabel } from './saleStatus';

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export function HomeScreen() {
  const me = useMe();
  const session = useSession();
  const nav = useNav();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [list] = await Promise.all([api.sales(30), session.reload()]);
    setSales(list);
  }, [session]);

  useEffect(() => {
    api.sales(30).then(setSales).catch(() => setSales([]));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => undefined);
    setRefreshing(false);
  };

  const today = (sales ?? []).filter((s) => s.status === 'PAID' && isToday(s.paidAt ?? s.createdAt));
  const todayUsd = today.reduce((sum, s) => sum + Number(s.received?.usd ?? (s.currency === 'USD' ? s.amount : 0)), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <FadeIn rise={6}>
          <Row style={{ gap: space.md, marginBottom: space.lg }}>
            <PetraMark size={30} />
            <T v="heading" numberOfLines={1} style={{ flex: 1 }}>{me.merchantName}</T>
            <IconButton name="settings" label="Settings" onPress={() => nav.push({ name: 'settings' })} />
          </Row>
        </FadeIn>

        <FadeIn delay={50} rise={18} duration={560}>
          <View style={styles.hero}>
            <PetraMark size={220} light style={styles.heroMark} />
            <T v="caption" style={{ color: colors.onInkMuted }}>Today</T>
            <T v="hero" numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onInk, fontSize: 38, lineHeight: 46, marginTop: 4 }}>
              {money(todayUsd, 'USD')}
            </T>
            <T v="small" style={{ color: colors.onInkMuted, marginTop: 2 }}>
              {today.length} paid sale{today.length === 1 ? '' : 's'} · settled as shielded ZEC
            </T>
            <Press
              onPress={() => nav.push({ name: 'newSale' })}
              disabled={!me.canAcceptPayments}
              accessibilityRole="button"
              accessibilityLabel="Charge a customer"
              style={[styles.charge, !me.canAcceptPayments && { opacity: 0.4 }]}
            >
              <Icon name="qr-code" size={24} color={colors.primary} />
              <T style={styles.chargeText}>Charge a customer</T>
              <Nudge>
                <Icon name="arrow-right" size={22} color={colors.primary} />
              </Nudge>
            </Press>
          </View>
        </FadeIn>

        {!me.canAcceptPayments ? (
          <View style={{ marginTop: space.md }}>
            <Banner tone="warning" title="Not ready to take payments">
              Add a shielded Zcash address in your PetraPay dashboard, then pull down to refresh.
            </Banner>
          </View>
        ) : me.freshAddresses < 3 ? (
          <View style={{ marginTop: space.md }}>
            <Banner tone="warning" title="Running low on fresh addresses">
              Add more shielded addresses in your dashboard so every sale gets its own. Sales still work meanwhile.
            </Banner>
          </View>
        ) : null}

        <FadeIn delay={120} rise={18} duration={560}>
          <Row style={{ gap: space.md, marginTop: space.md }}>
            <QuickAction icon="receipt-text" label="All sales" onPress={() => nav.push({ name: 'sales' })} />
            <QuickAction icon="printer" label="Printer" onPress={() => nav.push({ name: 'settings' })} />
          </Row>
        </FadeIn>

        <FadeIn delay={180}>
          <T v="heading" style={{ marginTop: space.xl, marginBottom: space.md }}>Recent sales</T>
        </FadeIn>
        {sales === null ? (
          <SalesSkeleton />
        ) : sales.length === 0 ? (
          <FadeIn>
            <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
              <View style={styles.emptyIcon}>
                <Icon name="qr-code" size={26} color={colors.primary} />
              </View>
              <T v="label" style={{ marginTop: space.md }}>No sales yet</T>
              <T v="small" style={{ textAlign: 'center', marginTop: 2 }}>Tap “Charge a customer” to take your first payment.</T>
            </Card>
          </FadeIn>
        ) : (
          <SaleList sales={sales.slice(0, 6)} onOpen={(s) => nav.push({ name: 'payment', id: s.id })} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" style={styles.quick}>
      <View style={styles.quickIcon}>
        <Icon name={icon} size={20} color={colors.primary} />
      </View>
      <T v="label">{label}</T>
    </Press>
  );
}

// ── Sale lists (also used by the Sales screen) ────────────────────────────────

export function SaleList({ sales, onOpen }: { sales: Sale[]; onOpen: (s: Sale) => void }) {
  return (
    <View style={styles.list}>
      {sales.map((s, i) => (
        <FadeIn key={s.id} delay={Math.min(i, 8) * 40} rise={10} duration={380}>
          <SaleRow sale={s} last={i === sales.length - 1} onPress={() => onOpen(s)} />
        </FadeIn>
      ))}
    </View>
  );
}

export function SaleRow({ sale, onPress, last }: { sale: Sale; onPress: () => void; last?: boolean }) {
  const st = statusLabel(sale);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { backgroundColor: colors.muted }]}>
      <View style={styles.rowIcon}>
        <Icon name={sale.status === 'PAID' ? 'check' : 'receipt-text'} size={18} color={sale.status === 'PAID' ? colors.success : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="label" numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
          {money(sale.amount, sale.currency)}
        </T>
        <T v="small" numberOfLines={1}>
          {saleRef(sale.number)} · {shortTime(sale.createdAt)}
          {sale.paidWith ? ` · ${sale.paidWith.symbol}` : ''}
        </T>
      </View>
      <Badge label={st.label} tone={st.tone} />
    </Pressable>
  );
}

export function SalesSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.row, i < rows - 1 && styles.rowLine]}>
          <Skeleton style={{ width: 38, height: 38, borderRadius: 19 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton style={{ width: '46%', height: 13 }} />
            <Skeleton style={{ width: '70%', height: 11 }} />
          </View>
          <Skeleton style={{ width: 54, height: 22, borderRadius: radius.pill }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.ink, borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
  heroMark: { position: 'absolute', right: -64, top: -56, opacity: 0.08 },
  charge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 64,
    marginTop: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.onInk,
  },
  chargeText: { flex: 1, fontFamily: fonts.semibold, fontSize: 18, color: colors.primary },
  quick: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.md },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
});
