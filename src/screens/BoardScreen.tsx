import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAppState } from '../context/AppState';
import type { Item, Member } from '../types';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Board'>;

type Section = { title: string; items: Item[] };

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfWeek(): Date {
  const d = endOfToday();
  d.setDate(d.getDate() + (7 - d.getDay() || 7) - 1 + 1);
  return d;
}

function sectionize(items: Item[]): Section[] {
  const today: Item[] = [];
  const week: Item[] = [];
  const later: Item[] = [];
  const eod = endOfToday().getTime();
  const eow = endOfWeek().getTime();

  for (const item of items) {
    if (!item.due_at) {
      later.push(item);
      continue;
    }
    const due = new Date(item.due_at).getTime();
    if (due <= eod) today.push(item);
    else if (due <= eow) week.push(item);
    else later.push(item);
  }

  return [
    { title: 'Today', items: today },
    { title: 'This week', items: week },
    { title: 'Later & anytime', items: later },
  ].filter((s) => s.items.length > 0);
}

function ownerName(item: Item, members: Member[]): string | null {
  if (!item.owner_member_id) return null;
  return members.find((m) => m.id === item.owner_member_id)?.display_name ?? null;
}

export default function BoardScreen({ navigation }: Props) {
  const { family, members, signOut } = useAppState();
  const [items, setItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!family) return;
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('family_id', family.id)
      .eq('status', 'open')
      .neq('type', 'list_entry')
      .order('due_at', { ascending: true, nullsFirst: false });
    if (!error) setItems((data as Item[]) ?? []);
  }, [family]);

  useEffect(() => {
    load();
    if (!family) return;
    const channel = supabase
      .channel(`items-${family.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `family_id=eq.${family.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [family, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markDone = async (item: Item) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabase
      .from('items')
      .update({ status: 'done' })
      .eq('id', item.id);
    if (error) {
      Alert.alert('Could not update item', error.message);
      load();
    }
  };

  const shareInvite = async () => {
    if (!family) return;
    await Share.share({
      message: `Join our family space "${family.name}" on Hearth — invite code: ${family.invite_code}`,
    });
  };

  const sections = useMemo(() => sectionize(items), [items]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.familyName}>{family?.name}</Text>
          <TouchableOpacity onPress={shareInvite}>
            <Text style={styles.invite}>Invite code: {family?.invite_code} · share</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {sections.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing on the board yet</Text>
            <Text style={styles.emptyText}>
              Add something below, or capture a note and let Hearth organize it.
            </Text>
          </View>
        )}

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => {
              const owner = ownerName(item, members);
              return (
                <View key={item.id} style={styles.card}>
                  <TouchableOpacity style={styles.check} onPress={() => markDone(item)}>
                    <Text style={styles.checkText}>○</Text>
                  </TouchableOpacity>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>
                      {item.type === 'event' ? '📅 ' : ''}
                      {item.title}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {[
                        item.due_at
                          ? new Date(item.due_at).toLocaleString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : null,
                        owner,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Anytime · anyone'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <View style={{ height: 96 }} />
      </ScrollView>

      <View style={styles.fabRow}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => navigation.navigate('Capture')}
        >
          <Text style={styles.fabSecondaryText}>✨ Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddItem')}>
          <Text style={styles.fabText}>+ Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  familyName: { fontSize: 24, fontWeight: '800', color: colors.text },
  invite: { color: colors.primaryDark, marginTop: 2, fontSize: 13 },
  signOut: { color: colors.muted, fontSize: 13, marginTop: 6 },
  scroll: { flex: 1, paddingHorizontal: spacing.md },
  empty: { alignItems: 'center', marginTop: spacing.xl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  check: { marginRight: spacing.md },
  checkText: { fontSize: 22, color: colors.primary },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  fabRow: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fab: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    elevation: 3,
  },
  fabSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  fabSecondaryText: { color: colors.primaryDark, fontWeight: '700', fontSize: 16 },
});
