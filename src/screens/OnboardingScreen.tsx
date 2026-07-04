import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const EXAMPLE =
  'Soccer moved to Thursdays 5:30 — Dad handles drop-off. Mia\'s dentist next ' +
  'Tuesday 4pm. We\'re out of milk and eggs.';

type Phase = 'input' | 'working' | 'error';

/**
 * The activation moment: a brand-new family lands here instead of an empty
 * board. One brain dump in, watch Hearth organize it, land on review cards.
 */
export default function OnboardingScreen({ navigation }: Props) {
  const { family, member, session } = useAppState();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const captureIdRef = useRef<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    track('onboarding_shown');
  }, []);

  // Watch for the AI's proposals; the moment they land, go review them.
  useEffect(() => {
    if (!family) return;
    const channel = supabase
      .channel(`onb-${family.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proposals',
          filter: `family_id=eq.${family.id}`,
        },
        () => {
          if (doneRef.current) return;
          doneRef.current = true;
          track('onboarding_completed');
          navigation.replace('Review');
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'captures',
          filter: `family_id=eq.${family.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status: string; error: string | null };
          if (row.id === captureIdRef.current && row.status === 'error') {
            setPhase('error');
            setErrorMsg(row.error ?? 'Something went wrong.');
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [family, navigation]);

  // Safety net: realtime can miss; poll once in a while during "working".
  useEffect(() => {
    if (phase !== 'working' || !family) return;
    const timer = setInterval(async () => {
      if (doneRef.current || !captureIdRef.current) return;
      const { count } = await supabase
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('capture_id', captureIdRef.current);
      if ((count ?? 0) > 0) {
        doneRef.current = true;
        track('onboarding_completed');
        navigation.replace('Review');
        return;
      }
      const { data: cap } = await supabase
        .from('captures')
        .select('status, error')
        .eq('id', captureIdRef.current)
        .single();
      if (cap?.status === 'error') {
        setPhase('error');
        setErrorMsg(cap.error ?? 'Something went wrong.');
      } else if (cap?.status === 'done') {
        // done with zero proposals — nothing actionable found
        doneRef.current = true;
        navigation.replace('Board');
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [phase, family, navigation]);

  const submit = async () => {
    if (!family || !text.trim()) return;
    setPhase('working');
    track('onboarding_capture_submitted');
    const { data, error } = await supabase
      .from('captures')
      .insert({
        family_id: family.id,
        created_by: session?.user.id ?? null,
        kind: 'text',
        text_content: text.trim(),
      })
      .select('id')
      .single();
    if (error || !data) {
      setPhase('input');
      Alert.alert('Could not save that', error?.message ?? 'Please try again.');
      return;
    }
    captureIdRef.current = data.id;
    supabase.functions.invoke('extract', { body: { capture_id: data.id } }).catch(() => {});
  };

  const skip = () => {
    track('onboarding_skipped');
    navigation.replace('Board');
  };

  if (phase === 'working') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.workingTitle}>Hearth is reading it…</Text>
        <Text style={styles.workingText}>
          Turning your note into events, tasks, and lists. A few seconds.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.step}>Last step</Text>
        <Text style={styles.title}>
          {member ? `${member.display_name}, empty` : 'Empty'} your head once.
        </Text>
        <Text style={styles.sub}>
          Type everything your family has coming up — appointments, chores,
          things you're out of. Exactly how you'd say it. Hearth sorts it out.
        </Text>

        {phase === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder={`e.g. "${EXAMPLE}"`}
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
        />

        <TouchableOpacity onPress={() => setText(EXAMPLE)}>
          <Text style={styles.example}>No inspiration? Use the example →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !text.trim() && styles.buttonDisabled]}
          onPress={submit}
          disabled={!text.trim()}
        >
          <Text style={styles.buttonText}>✨ Organize it</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={skip}>
          <Text style={styles.skip}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  content: { padding: spacing.lg, paddingTop: spacing.xl * 2, gap: spacing.md },
  step: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, lineHeight: 34 },
  sub: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  example: { color: colors.primaryDark, fontSize: 14 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
  workingTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  workingText: { color: colors.muted, textAlign: 'center' },
  errorBox: {
    backgroundColor: colors.card,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14 },
});
