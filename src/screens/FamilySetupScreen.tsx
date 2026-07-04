import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { useAppState } from '../context/AppState';
import { colors, spacing } from '../theme';

type Mode = 'choose' | 'create' | 'join';

export default function FamilySetupScreen() {
  const { refreshFamily, signOut, pendingInvite, clearInvite, markJoined } = useAppState();
  const [mode, setMode] = useState<Mode>(pendingInvite ? 'join' : 'choose');
  const [familyName, setFamilyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState(pendingInvite ?? '');
  const [busy, setBusy] = useState(false);

  // pendingInvite resolves from storage asynchronously; adopt it whenever it lands
  useEffect(() => {
    if (pendingInvite) {
      setMode('join');
      setInviteCode(pendingInvite);
    }
  }, [pendingInvite]);

  const submit = async () => {
    if (!displayName.trim()) {
      Alert.alert('Add your name so your family knows who you are');
      return;
    }
    setBusy(true);
    const { error } =
      mode === 'create'
        ? await supabase.rpc('create_family', {
            p_name: familyName.trim() || `${displayName.trim()}'s family`,
            p_display_name: displayName.trim(),
          })
        : await supabase.rpc('join_family', {
            p_invite_code: inviteCode.trim().toLowerCase(),
            p_display_name: displayName.trim(),
          });
    setBusy(false);
    if (error) {
      Alert.alert('Something went wrong', error.message);
      return;
    }
    track(mode === 'create' ? 'family_created' : 'family_joined', {
      via_link: mode === 'join' && !!pendingInvite,
    });
    if (mode === 'join') {
      clearInvite();
      markJoined();
    }
    await refreshFamily();
  };

  if (mode === 'choose') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Set up your family space</Text>
        <TouchableOpacity style={styles.button} onPress={() => setMode('create')}>
          <Text style={styles.buttonText}>Start a new family</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => setMode('join')}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Join with an invite code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.link}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>
        {mode === 'create' ? 'Start a new family' : 'Join your family'}
      </Text>

      {mode === 'join' && pendingInvite ? (
        <Text style={styles.invited}>
          🎉 You've been invited! Just add your name below.
        </Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Your name (e.g. Priya)"
        placeholderTextColor={colors.muted}
        value={displayName}
        onChangeText={setDisplayName}
      />

      {mode === 'create' ? (
        <TextInput
          style={styles.input}
          placeholder="Family name (e.g. The Sharmas)"
          placeholderTextColor={colors.muted}
          value={familyName}
          onChangeText={setFamilyName}
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Invite code"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={inviteCode}
          onChangeText={setInviteCode}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === 'create' ? 'Create family' : 'Join family'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode('choose')}>
        <Text style={styles.link}>Back</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  invited: {
    color: colors.primaryDark,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: colors.primaryDark },
  link: { color: colors.primaryDark, textAlign: 'center', marginTop: spacing.sm },
});
