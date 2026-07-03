import React, { useCallback, useEffect, useState } from 'react';
import {
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
import { acceptProposal, dismissProposal } from '../lib/acceptProposal';
import type { Proposal } from '../types';
import { colors, spacing } from '../theme';

const TYPE_LABEL = { event: '📅 Event', task: '✅ Task', list_entry: '🛒 List item' } as const;

function Card({
  proposal,
  onResolved,
}: {
  proposal: Proposal;
  onResolved: (id: string) => void;
}) {
  const { members } = useAppState();
  const [title, setTitle] = useState(proposal.payload.title);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    const { error } = await acceptProposal(proposal, members, { title: title.trim() });
    setBusy(false);
    if (error) {
      Alert.alert('Could not add item', error);
      return;
    }
    onResolved(proposal.id);
  };

  const dismiss = async () => {
    setBusy(true);
    const { error } = await dismissProposal(proposal);
    setBusy(false);
    if (error) {
      Alert.alert('Could not dismiss', error);
      return;
    }
    onResolved(proposal.id);
  };

  const p = proposal.payload;
  const meta = [
    p.due_at
      ? new Date(p.due_at).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null,
    p.owner_hint ? `for ${p.owner_hint}` : null,
    p.list_name ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <Text style={styles.type}>{TYPE_LABEL[p.type] ?? p.type}</Text>
      <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} multiline />
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {p.notes ? <Text style={styles.notes}>{p.notes}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismiss} onPress={dismiss} disabled={busy}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.accept} onPress={accept} disabled={busy}>
          <Text style={styles.acceptText}>Add to board</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ReviewScreen() {
  const { family } = useAppState();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!family) return;
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('family_id', family.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setProposals((data as Proposal[]) ?? []);
    setLoaded(true);
  }, [family]);

  useEffect(() => {
    load();
    if (!family) return;
    const channel = supabase
      .channel(`proposals-${family.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proposals',
          filter: `family_id=eq.${family.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [family, load]);

  const onResolved = (id: string) =>
    setProposals((prev) => prev.filter((p) => p.id !== id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loaded && proposals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>All caught up ✨</Text>
          <Text style={styles.emptyText}>
            When Hearth reads a capture, its suggestions land here for a one-tap review.
          </Text>
        </View>
      ) : (
        proposals.map((p) => <Card key={p.id} proposal={p} onResolved={onResolved} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  empty: { alignItems: 'center', marginTop: spacing.xl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  type: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    padding: 0,
  },
  meta: { fontSize: 13, color: colors.muted },
  notes: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dismiss: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dismissText: { color: colors.muted, fontWeight: '600' },
  accept: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  acceptText: { color: '#fff', fontWeight: '700' },
});
