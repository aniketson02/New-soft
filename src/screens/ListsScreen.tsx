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
import type { Item, List } from '../types';
import { colors, spacing } from '../theme';

export default function ListsScreen() {
  const { family, session } = useAppState();
  const [lists, setLists] = useState<List[]>([]);
  const [entries, setEntries] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!family) return;
    const [{ data: ls }, { data: es }] = await Promise.all([
      supabase.from('lists').select('*').eq('family_id', family.id).order('created_at'),
      supabase
        .from('items')
        .select('*')
        .eq('family_id', family.id)
        .eq('type', 'list_entry')
        .eq('status', 'open')
        .order('created_at'),
    ]);
    setLists((ls as List[]) ?? []);
    setEntries((es as Item[]) ?? []);
  }, [family]);

  useEffect(() => {
    load();
    if (!family) return;
    const channel = supabase
      .channel(`lists-${family.id}`)
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

  const addEntry = async (list: List) => {
    const draft = (drafts[list.id] ?? '').trim();
    if (!family || !draft) return;
    setDrafts((d) => ({ ...d, [list.id]: '' }));
    const { error } = await supabase.from('items').insert({
      family_id: family.id,
      type: 'list_entry',
      title: draft,
      list_id: list.id,
      created_by: session?.user.id ?? null,
    });
    if (error) Alert.alert('Could not add', error.message);
    load();
  };

  const checkOff = async (entry: Item) => {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    await supabase.from('items').update({ status: 'done' }).eq('id', entry.id);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {lists.map((list) => {
        const listEntries = entries.filter((e) => e.list_id === list.id);
        return (
          <View key={list.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{list.name}</Text>
            {listEntries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.entry}
                onPress={() => checkOff(entry)}
              >
                <Text style={styles.check}>○</Text>
                <Text style={styles.entryTitle}>{entry.title}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder={`Add to ${list.name}…`}
                placeholderTextColor={colors.muted}
                value={drafts[list.id] ?? ''}
                onChangeText={(t) => setDrafts((d) => ({ ...d, [list.id]: t }))}
                onSubmitEditing={() => addEntry(list)}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addButton} onPress={() => addEntry(list)}>
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  check: { fontSize: 20, color: colors.primary },
  entryTitle: { fontSize: 16, color: colors.text, flex: 1 },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 22, fontWeight: '700' },
});
