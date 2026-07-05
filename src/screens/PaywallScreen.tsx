import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { useAppState } from '../context/AppState';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

// Set this to a Stripe Payment Link once the Stripe account exists; until
// then the buy button shows a "coming soon" note and the redeem-code path
// (for early supporters) is the live route to premium.
const STRIPE_PAYMENT_LINK = '';

const BENEFITS = [
  'Unlimited AI captures — no monthly cap',
  'Snap flyers & forward emails without limits',
  'Priority processing',
  'Everything in the free plan, forever',
];

export default function PaywallScreen({ navigation }: Props) {
  const { usage, refreshUsage, refreshFamily } = useAppState();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);

  useEffect(() => {
    track('paywall_shown', { used: usage?.used ?? null });
  }, [usage]);

  const buy = () => {
    track('upgrade_clicked');
    if (STRIPE_PAYMENT_LINK) {
      Linking.openURL(STRIPE_PAYMENT_LINK);
    } else {
      setShowRedeem(true);
      Alert.alert(
        'Founder Lifetime — $49',
        'Checkout is opening soon. If you have an unlock code, enter it below.',
      );
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('redeem_promo', { p_code: code.trim() });
    setBusy(false);
    const result = data as { ok: boolean; error?: string } | null;
    if (error || !result?.ok) {
      Alert.alert('Could not unlock', result?.error ?? error?.message ?? 'Please try again.');
      return;
    }
    track('promo_redeemed');
    await Promise.all([refreshUsage(), refreshFamily()]);
    Alert.alert('You’re Premium! 🎉', 'Unlimited AI captures are now unlocked.', [
      { text: 'Nice', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Hearth Premium</Text>
      <Text style={styles.title}>Never let the family’s chaos hit a limit.</Text>

      {usage && usage.plan === 'free' && (
        <Text style={styles.usage}>
          You’ve used {usage.used} of {usage.limit} free AI captures this month.
        </Text>
      )}

      <View style={styles.card}>
        {BENEFITS.map((b) => (
          <View key={b} style={styles.benefit}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.benefitText}>{b}</Text>
          </View>
        ))}
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>$49</Text>
        <Text style={styles.priceNote}>one-time · Founder Lifetime</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={buy} disabled={busy}>
        <Text style={styles.buttonText}>Get Premium for life</Text>
      </TouchableOpacity>

      {showRedeem ? (
        <View style={styles.redeemBox}>
          <TextInput
            style={styles.input}
            placeholder="Unlock code"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity style={styles.redeemButton} onPress={redeem} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Unlock</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setShowRedeem(true)}>
          <Text style={styles.redeemLink}>Have an unlock code?</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.maybe}>Maybe later</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl * 2, gap: spacing.md },
  kicker: {
    color: colors.primaryDark,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, lineHeight: 34 },
  usage: { color: colors.muted, fontSize: 15 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  benefit: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  check: { color: colors.success, fontWeight: '800', fontSize: 16 },
  benefitText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 22 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
  price: { fontSize: 40, fontWeight: '800', color: colors.text },
  priceNote: { color: colors.muted, fontSize: 15 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  redeemBox: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  redeemButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemLink: { color: colors.primaryDark, textAlign: 'center', fontWeight: '600' },
  maybe: { color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
});
