import React, { useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAppState } from '../context/AppState';
import type { ItemType } from '../types';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddItem'>;

export default function AddItemScreen({ navigation }: Props) {
  const { family, members, session } = useAppState();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ItemType>('task');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [dueText, setDueText] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!family || !title.trim()) {
      Alert.alert('Give it a title');
      return;
    }

    let dueAt: string | null = null;
    if (dueText.trim()) {
      const parsed = new Date(dueText.trim());
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert('Could not read that date', 'Try a format like 2026-07-10 15:00');
        return;
      }
      dueAt = parsed.toISOString();
    }

    setBusy(true);
    const { error } = await supabase.from('items').insert({
      family_id: family.id,
      type,
      title: title.trim(),
      owner_member_id: ownerId,
      due_at: dueAt,
      created_by: session?.user.id ?? null,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        style={styles.input}
        placeholder="What needs to happen?"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
        autoFocus
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.row}>
        {(['task', 'event'] as ItemType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, type === t && styles.chipActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
              {t === 'task' ? 'Task' : 'Event'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Who owns it?</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, ownerId === null && styles.chipActive]}
          onPress={() => setOwnerId(null)}
        >
          <Text style={[styles.chipText, ownerId === null && styles.chipTextActive]}>
            Anyone
          </Text>
        </TouchableOpacity>
        {members.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, ownerId === m.id && styles.chipActive]}
            onPress={() => setOwnerId(m.id)}
          >
            <Text style={[styles.chipText, ownerId === m.id && styles.chipTextActive]}>
              {m.display_name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>When (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-07-10 15:00"
        placeholderTextColor={colors.muted}
        value={dueText}
        onChangeText={setDueText}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add to board</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
