import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAppState } from '../context/AppState';
import type { Capture } from '../types';
import { colors, spacing } from '../theme';

const STATUS_LABEL: Record<Capture['status'], string> = {
  pending: 'Waiting for Hearth…',
  processing: 'Hearth is reading it…',
  done: 'Organized ✓',
  error: 'Could not process',
};

/**
 * Phase-2 entry point: dump unstructured text (a forwarded email, a note to
 * self) and let the extraction pipeline turn it into board proposals.
 * Photo and voice capture land here next.
 */
export default function CaptureScreen() {
  const { family, session } = useAppState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Capture[]>([]);

  const loadRecent = useCallback(async () => {
    if (!family) return;
    const { data } = await supabase
      .from('captures')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecent((data as Capture[]) ?? []);
  }, [family]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const submit = async () => {
    if (!family || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('captures').insert({
      family_id: family.id,
      created_by: session?.user.id ?? null,
      kind: 'text',
      text_content: text.trim(),
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not save capture', error.message);
      return;
    }
    setText('');
    loadRecent();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Paste a school email, type a brain dump, anything. Hearth will turn it into
        events and tasks for the family board.
      </Text>
      <TextInput
        style={styles.input}
        placeholder={'e.g. "Soccer practice moved to Thursday 5pm, bring shin guards and ₹500 for the jersey"'}
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy || !text.trim()}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>✨ Organize it</Text>}
      </TouchableOpacity>

      {recent.length > 0 && (
        <View style={styles.recent}>
          <Text style={styles.recentTitle}>Recent captures</Text>
          {recent.map((c) => (
            <View key={c.id} style={styles.captureCard}>
              <Text style={styles.captureText} numberOfLines={2}>
                {c.text_content ?? c.storage_path ?? c.kind}
              </Text>
              <Text style={styles.captureStatus}>{STATUS_LABEL[c.status]}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  recent: { marginTop: spacing.md, gap: spacing.sm },
  recentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  captureCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  captureText: { color: colors.text, fontSize: 14 },
  captureStatus: { color: colors.primaryDark, fontSize: 12, marginTop: 4 },
});
