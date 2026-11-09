import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, defaultServer } from '../api/client';
import { PetraLogo } from '../components/Mark';
import { FadeIn } from '../components/motion';
import { Banner, Button, Card, Disclosure, ErrorText, Input, T } from '../components/ui';
import { deviceName } from '../native/device';
import { useSession } from '../state/session';
import { colors, space } from '../theme';

/** Shown as XXXX-XXXX while typing; the server ignores the dash and case. */
function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/**
 * First run (or after the terminal was removed): connect it to a PetraPay
 * account with the one-time code from the dashboard.
 */
export function PairScreen({ reason }: { reason?: string }) {
  const { pair } = useSession();
  const [code, setCode] = useState('');
  const [name, setName] = useState(deviceName);
  const [server, setServer] = useState(defaultServer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = code.replace('-', '').length === 8 && name.trim().length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await pair(code, name.trim(), server);
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <FadeIn rise={8}>
            <PetraLogo size={40} />
            <T v="display" style={{ marginTop: space.xl }}>Pair this terminal</T>
            <T v="body" style={{ color: colors.mutedForeground, marginTop: space.sm }}>
              In your PetraPay dashboard, open <T v="label">Point of sale</T> and tap <T v="label">Get pairing code</T>. Enter the code below.
            </T>
          </FadeIn>

          {reason ? (
            <View style={{ marginTop: space.lg }}>
              <Banner tone="warning" title="This terminal was unpaired">
                {reason}
              </Banner>
            </View>
          ) : null}

          <FadeIn delay={80} rise={10}>
            <Card style={{ marginTop: space.xl, gap: space.md }}>
              <Input
                label="Pairing code"
                value={code}
                onChangeText={(t) => {
                  setCode(formatCode(t));
                  setError(null);
                }}
                placeholder="ABCD-2345"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                style={styles.code}
                onSubmitEditing={submit}
              />
              <Input label="Terminal name" value={name} onChangeText={setName} placeholder="Front counter" maxLength={60} />
              <ErrorText error={error} />
            </Card>
          </FadeIn>

          <FadeIn delay={140} rise={6}>
            <Disclosure label="PetraPay server" style={{ marginTop: space.lg }}>
              <Card>
                <Input value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                <T v="small" style={{ marginTop: space.sm }}>Only change this if your business runs its own PetraPay server.</T>
              </Card>
            </Disclosure>
          </FadeIn>
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Pair terminal" onPress={submit} disabled={!ready} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flexGrow: 1, padding: space.xl, paddingTop: space.xxl },
  code: { fontSize: 24, letterSpacing: 4, textAlign: 'center' },
  footer: { padding: space.lg },
});
