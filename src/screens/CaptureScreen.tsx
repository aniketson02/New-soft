import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { useAppState } from '../context/AppState';
import type { Capture } from '../types';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

const STATUS_LABEL: Record<Capture['status'], string> = {
  pending: 'Waiting for Hearth…',
  processing: 'Hearth is reading it…',
  done: 'Organized ✓',
  error: 'Could not process',
};

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;
  for (let i = 0; i + 3 < clean.length || i + 1 < clean.length; i += 4) {
    const chunk =
      (B64_ALPHABET.indexOf(clean[i]) << 18) |
      (B64_ALPHABET.indexOf(clean[i + 1]) << 12) |
      ((B64_ALPHABET.indexOf(clean[i + 2]) & 63) << 6) |
      (B64_ALPHABET.indexOf(clean[i + 3]) & 63);
    bytes[byteIndex++] = (chunk >> 16) & 255;
    if (clean[i + 2] !== undefined) bytes[byteIndex++] = (chunk >> 8) & 255;
    if (clean[i + 3] !== undefined) bytes[byteIndex++] = chunk & 255;
  }
  return bytes.slice(0, byteIndex);
}

/** Fire-and-forget: ask the extraction pipeline to process a capture. */
function triggerExtraction(captureId: string, kind: 'text' | 'photo') {
  track('capture_created', { kind });
  supabase.functions.invoke('extract', { body: { capture_id: captureId } }).catch(() => {
    // The capture row's status field carries the real state; errors surface there.
  });
}

export default function CaptureScreen({ navigation }: Props) {
  const { family, session, refreshUsage } = useAppState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Capture[]>([]);
  const paywalledRef = useRef(false);

  const loadRecent = useCallback(async () => {
    if (!family) return;
    const { data } = await supabase
      .from('captures')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false })
      .limit(10);
    const rows = (data as Capture[]) ?? [];
    setRecent(rows);
    // Hitting the free monthly cap surfaces the paywall (once).
    if (
      !paywalledRef.current &&
      rows.some((c) => c.status === 'error' && c.error === 'FREE_LIMIT_REACHED')
    ) {
      paywalledRef.current = true;
      track('limit_reached');
      refreshUsage();
      navigation.navigate('Paywall');
    }
  }, [family, navigation, refreshUsage]);

  useEffect(() => {
    loadRecent();
    if (!family) return;
    const channel = supabase
      .channel(`captures-${family.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'captures', filter: `family_id=eq.${family.id}` },
        () => loadRecent(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [family, loadRecent]);

  const submitText = async () => {
    if (!family || !text.trim()) return;
    setBusy(true);
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
    setBusy(false);
    if (error) {
      Alert.alert('Could not save capture', error.message);
      return;
    }
    setText('');
    triggerExtraction(data.id, 'text');
    loadRecent();
  };

  const submitPhoto = async (fromCamera: boolean) => {
    if (!family) return;

    const picker = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera permission is needed to snap a flyer');
        return;
      }
    }

    const result = await picker({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setBusy(true);
    const path = `${family.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const bytes = base64ToBytes(result.assets[0].base64);

    const { error: uploadError } = await supabase.storage
      .from('captures')
      .upload(path, bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg' });
    if (uploadError) {
      setBusy(false);
      Alert.alert('Could not upload photo', uploadError.message);
      return;
    }

    const { data, error } = await supabase
      .from('captures')
      .insert({
        family_id: family.id,
        created_by: session?.user.id ?? null,
        kind: 'photo',
        storage_path: path,
      })
      .select('id')
      .single();
    setBusy(false);
    if (error) {
      Alert.alert('Could not save capture', error.message);
      return;
    }
    triggerExtraction(data.id, 'photo');
    loadRecent();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Paste a school email, type a brain dump, or snap a flyer. Hearth turns it into
        events and tasks your family can review.
      </Text>
      <TextInput
        style={styles.input}
        placeholder={'e.g. "Soccer practice moved to Thursday 5pm, bring shin guards and ₹500 for the jersey"'}
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        multiline
      />
      <TouchableOpacity
        style={styles.button}
        onPress={submitText}
        disabled={busy || !text.trim()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>✨ Organize it</Text>
        )}
      </TouchableOpacity>

      <View style={styles.photoRow}>
        <TouchableOpacity
          style={[styles.button, styles.photoButton]}
          onPress={() => submitPhoto(true)}
          disabled={busy}
        >
          <Text style={styles.photoButtonText}>📷 Snap a flyer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.photoButton]}
          onPress={() => submitPhoto(false)}
          disabled={busy}
        >
          <Text style={styles.photoButtonText}>🖼 From photos</Text>
        </TouchableOpacity>
      </View>

      {recent.length > 0 && (
        <View style={styles.recent}>
          <Text style={styles.recentTitle}>Recent captures</Text>
          {recent.map((c) => (
            <View key={c.id} style={styles.captureCard}>
              <Text style={styles.captureText} numberOfLines={2}>
                {c.kind === 'photo' ? '📷 Photo capture' : c.text_content ?? c.kind}
              </Text>
              <Text
                style={[
                  styles.captureStatus,
                  c.status === 'error' && { color: colors.danger },
                ]}
              >
                {c.status === 'error' && c.error === 'FREE_LIMIT_REACHED'
                  ? 'Monthly free limit reached — tap Upgrade'
                  : STATUS_LABEL[c.status] +
                    (c.status === 'error' && c.error ? ` — ${c.error}` : '')}
              </Text>
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
  photoRow: { flexDirection: 'row', gap: spacing.sm },
  photoButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  photoButtonText: { color: colors.primaryDark, fontWeight: '700', fontSize: 15 },
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
