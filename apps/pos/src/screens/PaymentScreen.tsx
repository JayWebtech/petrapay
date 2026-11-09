import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import type { Sale } from '../api/types';
import { PetraMark } from '../components/Mark';
import { Burst, CheckDisc, DrainBar, FadeIn, PulseRings, Spinner, useCountUp } from '../components/motion';
import { Banner, Button, Card, Disclosure, ErrorText, Icon, IconButton, IconName, KeyValue, Loading, Row, T } from '../components/ui';
import { chainName, countdown, money, saleRef, shortTime } from '../lib/format';
import { saleReceipt } from '../lib/receipt';
import { usePrinter } from '../native/usePrinter';
import { useNav } from '../navigation';
import { useMe, useSession } from '../state/session';
import { colors, fonts, radius, space } from '../theme';
import { isLive, statusHint, statusLabel } from './saleStatus';

const POLL_MS = 3000;
const QR_SIZE = 248;
const QR_PAD = 12;

/**
 * Show the customer the QR and follow the sale live. The customer pays on their
 * own phone (any token, or shielded ZEC); the till just polls the server.
 */
export function PaymentScreen({ id, initial }: { id: string; initial?: Sale }) {
  const nav = useNav();
  const me = useMe();
  const { prefs } = useSession();
  const receipts = usePrinter();
  const autoPrinted = useRef(false);
  const [sale, setSale] = useState<Sale | null>(initial ?? null);
  const [qr, setQr] = useState<string | null>(initial?.qrDataUrl ?? null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const mounted = useRef(true);
  // Only a payment that lands while we're watching gets the celebration.
  const sawOpen = useRef(false);

  useEffect(() => () => void (mounted.current = false), []);

  // Opened from a list: load the sale (with its QR, in case it's still open).
  useEffect(() => {
    if (initial) return;
    api
      .sale(id, true)
      .then((s) => {
        if (!mounted.current) return;
        setSale(s);
        setQr(s.qrDataUrl);
      })
      .catch((e) => setError((e as ApiError).message));
  }, [id, initial]);

  // Follow the sale while it can still change.
  const live = !sale || isLive(sale);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      api
        .sale(id)
        .then((s) => mounted.current && setSale(s))
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [id, live]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Print the customer receipt once when a sale rung up on this screen is paid.
  const isPaid = sale?.status === 'PAID';
  useEffect(() => {
    if (!isPaid || !sale || !initial || autoPrinted.current) return;
    if (!prefs.autoPrint || !receipts.available) return;
    autoPrinted.current = true;
    receipts.print(saleReceipt(sale, me, 'customer'));
  }, [isPaid, sale, initial, me, prefs.autoPrint, receipts]);

  if (!sale) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton name="arrow-left" label="Back" onPress={nav.pop} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          {error ? <ErrorText error={error} /> : <Loading />}
        </View>
      </SafeAreaView>
    );
  }

  if (sale.status === 'OPEN') sawOpen.current = true;

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      setSale(await api.cancelSale(sale.id));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={styles.root}>
      {sale.status === 'PAID' ? (
        <PaidView
          sale={sale}
          celebrate={sawOpen.current || !!initial}
          printing={receipts.printing}
          canPrint={!!receipts.available}
          printError={receipts.error}
          onPrint={(copy) => receipts.print(saleReceipt(sale, me, copy))}
          onDone={() => nav.reset()}
          onNext={() => nav.reset({ name: 'newSale' })}
        />
      ) : (
        <LiveView
          sale={sale}
          qr={qr}
          now={now}
          error={error}
          cancelling={cancelling}
          onBack={() => nav.reset()}
          onCancel={cancel}
          onNext={() => nav.reset({ name: 'newSale' })}
        />
      )}
    </View>
  );
}

// ── Before the money lands ────────────────────────────────────────────────────

function LiveView({
  sale,
  qr,
  now,
  error,
  cancelling,
  onBack,
  onCancel,
  onNext,
}: {
  sale: Sale;
  qr: string | null;
  now: number;
  error: string | null;
  cancelling: boolean;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
}) {
  const left = sale.expiresAt ? countdown(sale.expiresAt, now) : null;
  // An open sale whose time ran out is shown as expired right away; the server agrees moments later.
  const waiting = sale.status === 'OPEN' && (!sale.expiresAt || !!left);
  const view: Sale = sale.status === 'OPEN' && !waiting ? { ...sale, status: 'EXPIRED' } : sale;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton name="arrow-left" label="Back" onPress={onBack} />
        <T v="caption">{saleRef(sale.number)}</T>
        {waiting && left ? (
          <View style={styles.timer} accessibilityLabel={`Expires in ${left}`}>
            <Icon name="clock" size={14} />
            <Text style={styles.timerText}>{left}</Text>
          </View>
        ) : (
          <View style={{ width: 42 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.liveBody} showsVerticalScrollIndicator={false}>
        {waiting ? <QrBlock sale={sale} qr={qr} /> : <StatusBlock sale={view} />}
        <ErrorText error={error} />
      </ScrollView>

      <FadeIn delay={240} rise={10} style={styles.liveFooter}>
        {waiting ? (
          <Button label="Cancel sale" variant="ghost" size="md" onPress={onCancel} loading={cancelling} />
        ) : (
          <Row style={{ gap: space.sm }}>
            <Button label="Done" variant="secondary" onPress={onBack} style={{ flex: 1 }} />
            <Button label="New sale" onPress={onNext} style={{ flex: 1.4 }} />
          </Row>
        )}
      </FadeIn>
    </SafeAreaView>
  );
}

/** Only what the customer needs: how much, and the code to scan. */
function QrBlock({ sale, qr }: { sale: Sale; qr: string | null }) {
  const card = QR_SIZE + QR_PAD * 2;
  return (
    <>
      <FadeIn delay={40} style={{ alignItems: 'center' }}>
        <T v="small">Scan to pay</T>
        <T v="display" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>
          {money(sale.amount, sale.currency)}
        </T>
      </FadeIn>

      <FadeIn delay={110} rise={0} scaleFrom={0.86} duration={620} style={[styles.qrStage, { width: card, height: card }]}>
        <PulseRings width={card} height={card} borderRadius={radius.xl} />
        <View style={[styles.qrCard, { width: card, height: card, padding: QR_PAD }]}>
          {qr ? (
            <Image source={{ uri: qr }} fadeDuration={0} style={{ width: QR_SIZE, height: QR_SIZE }} accessibilityLabel="Payment QR code" />
          ) : (
            <Loading />
          )}
          {qr ? (
            <View style={styles.qrBadge}>
              <PetraMark size={30} />
            </View>
          ) : null}
        </View>
      </FadeIn>

      {sale.expiresAt ? (
        <FadeIn delay={180} style={{ width: card, marginTop: space.md }}>
          <DrainBar from={sale.createdAt} until={sale.expiresAt} color={colors.primary} />
        </FadeIn>
      ) : null}

      <FadeIn delay={220} style={styles.payPill}>
        <Icon name="shield-check" size={18} color={colors.primary} />
        <T v="label">Any token, or shielded ZEC</T>
      </FadeIn>

      {sale.testMode ? (
        <FadeIn delay={230} style={{ alignSelf: 'stretch', marginTop: space.md }}>
          <Banner tone="warning" title="Test sale">
            Scan the code and tap “Simulate payment” on the checkout page. No real money moves.
          </Banner>
        </FadeIn>
      ) : null}

      {sale.customerReportedZec ? (
        <FadeIn delay={240} style={{ alignSelf: 'stretch', marginTop: space.md }}>
          <Banner tone="warning" title="Customer says they paid in ZEC">
            {statusHint(sale)}
          </Banner>
        </FadeIn>
      ) : (
        <FadeIn delay={260}>
          <T v="small" style={styles.qrHint}>{statusHint(sale)}</T>
        </FadeIn>
      )}
    </>
  );
}

const STATUS_ICONS: Partial<Record<Sale['status'], IconName>> = {
  EXPIRED: 'clock',
  CANCELLED: 'circle-x',
};

/** The QR has done its job (or is no longer valid): just say what's happening. */
function StatusBlock({ sale }: { sale: Sale }) {
  const st = statusLabel(sale);
  const working = sale.status === 'PROCESSING';
  return (
    <View style={styles.statusBlock}>
      <FadeIn key={sale.status} rise={0} scaleFrom={0.8} duration={520} style={styles.statusIcon}>
        {working ? (
          <>
            <View style={StyleSheet.absoluteFill}>
              <Spinner size={132} thickness={3} color={colors.primary} track={colors.accent} />
            </View>
            <PetraMark size={56} />
          </>
        ) : (
          <View style={styles.statusDisc}>
            <Icon name={STATUS_ICONS[sale.status] ?? 'info'} size={40} />
          </View>
        )}
      </FadeIn>
      <FadeIn key={`t-${sale.status}`} delay={80} style={{ alignItems: 'center' }}>
        <T v="title" style={{ marginTop: space.xl }}>{working ? 'Payment received' : st.label}</T>
        <T v="display" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: space.sm }}>
          {money(sale.amount, sale.currency)}
        </T>
        <T v="small" style={styles.statusHint}>{statusHint(sale)}</T>
      </FadeIn>
    </View>
  );
}

// ── After the money lands ─────────────────────────────────────────────────────

function PaidView({
  sale,
  celebrate,
  printing,
  canPrint,
  printError,
  onPrint,
  onDone,
  onNext,
}: {
  sale: Sale;
  celebrate: boolean;
  printing: boolean;
  canPrint: boolean;
  printError: string | null;
  onPrint: (copy: 'customer' | 'merchant') => void;
  onDone: () => void;
  onNext: () => void;
}) {
  const target = Number(sale.amount);
  const shown = useCountUp(target, { duration: 950, from: celebrate ? 0 : target });
  const delay = celebrate ? 260 : 0;
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.paidBody} showsVerticalScrollIndicator={false}>
        <View style={styles.paidHero}>
          {celebrate ? <Burst /> : null}
          <CheckDisc play={celebrate} />
        </View>
        <FadeIn delay={delay} style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <T v="label" style={{ color: colors.mutedForeground, marginTop: space.xl }}>Paid</T>
          <T v="hero" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>
            {money(shown, sale.currency)}
          </T>
          {sale.received ? (
            <T v="small" style={{ marginTop: space.xs }}>{sale.received.zec} ZEC received, shielded</T>
          ) : null}
          <T v="label" style={{ marginTop: space.lg, textAlign: 'center' }}>{statusHint(sale)}</T>
        </FadeIn>
        <FadeIn delay={delay + 120} rise={6} style={{ alignSelf: 'stretch' }}>
          <Disclosure label="Sale details" defaultOpen={!celebrate} style={{ marginTop: space.md }}>
            <Card style={{ marginBottom: 0 }}>
              <KeyValue label="Sale" value={saleRef(sale.number)} />
              <KeyValue label="Amount" value={money(sale.amount, sale.currency)} />
              {sale.paidWith ? (
                <KeyValue label="Paid with" value={`${sale.paidWith.amount} ${sale.paidWith.symbol} on ${chainName(sale.paidWith.chain)}`} />
              ) : (
                <KeyValue label="Paid with" value="Shielded ZEC" />
              )}
              {sale.received ? <KeyValue label="You received" value={`${sale.received.zec} ZEC`} /> : null}
              <KeyValue label="Time" value={shortTime(sale.paidAt ?? sale.createdAt)} />
            </Card>
          </Disclosure>
        </FadeIn>
      </ScrollView>

      <FadeIn delay={delay + 80} rise={18} style={styles.paidFooter}>
        {canPrint ? (
          <Row style={{ gap: space.sm, marginBottom: space.sm }}>
            <Button
              label={printing ? 'Printing…' : 'Print receipt'}
              variant="outline"
              size="md"
              icon="printer"
              disabled={printing}
              onPress={() => onPrint('customer')}
              style={{ flex: 1 }}
            />
            <Button label="Merchant copy" variant="outline" size="md" disabled={printing} onPress={() => onPrint('merchant')} style={{ flex: 1 }} />
          </Row>
        ) : null}
        <ErrorText error={printError} />
        <Row style={{ gap: space.sm }}>
          <Button label="Done" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
          <Button label="New sale" onPress={onNext} style={{ flex: 1.4 }} />
        </Row>
      </FadeIn>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, height: 60 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 32, borderRadius: radius.pill, backgroundColor: colors.muted },
  timerText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.foreground, fontVariant: ['tabular-nums'] },
  liveBody: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  qrStage: { alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A small mark in the middle of the code; error correction leaves room for it.
  qrBadge: { position: 'absolute', padding: 6, borderRadius: 12, backgroundColor: '#FFFFFF' },
  payPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  qrHint: { textAlign: 'center', marginTop: space.md, paddingHorizontal: space.md },
  statusBlock: { flex: 1, minHeight: 380, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  statusIcon: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  statusDisc: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  statusHint: { textAlign: 'center', marginTop: space.md, paddingHorizontal: space.md },
  liveFooter: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.xs },
  paidBody: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  paidHero: { alignItems: 'center', justifyContent: 'center' },
  paidFooter: { padding: space.lg, paddingTop: space.sm },
});
