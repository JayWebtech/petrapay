import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { api, ApiError } from '../api/client';
import type { Sale } from '../api/types';
import { FadeIn } from '../components/motion';
import { Card, ErrorText, Screen, T } from '../components/ui';
import { useNav } from '../navigation';
import { colors, space } from '../theme';
import { SaleList, SalesSkeleton } from './HomeScreen';

/** This terminal's recent sales. Tap one to see it again or reprint its receipt. */
export function SalesScreen() {
  const nav = useNav();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSales(await api.sales(50));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Sales" onBack={nav.pop} scroll={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[colors.primary]}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <ErrorText error={error} />
        {sales === null ? (
          <SalesSkeleton rows={6} />
        ) : sales.length === 0 ? (
          <FadeIn>
            <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
              <T v="label">No sales on this terminal yet</T>
            </Card>
          </FadeIn>
        ) : (
          <SaleList sales={sales} onOpen={(s) => nav.push({ name: 'payment', id: s.id })} />
        )}
      </ScrollView>
    </Screen>
  );
}
