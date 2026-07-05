import React, { useState } from 'react';
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
import { useAppState } from '../context/AppState';
import { colors, spacing } from '../theme';

export default function AuthScreen() {
  const { pendingInvite } = useAppState();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!email.includes('@')) {
      Alert.alert('Enter a valid email address');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    });
    setBusy(false);
    if (error) {
      Alert.alert('Could not send code', error.message);
      return;
    }
    setCodeSent(true);
  };

  /** Pull the token_hash (and type) out of a pasted Supabase magic-link URL,
   * if that's what the user got instead of a 6-digit code. */
  const parseMagicLink = (
    value: string,
  ): { tokenHash: string; type: 'magiclink' | 'email' } | null => {
    if (!value.includes('http')) return null;
    try {
      const url = new URL(value.trim());
      const tokenHash = url.searchParams.get('token') || url.searchParams.get('token_hash');
      if (!tokenHash) return null;
      const type = url.searchParams.get('type') === 'magiclink' ? 'magiclink' : 'email';
      return { tokenHash, type };
    } catch {
      return null;
    }
  };

  const verifyCode = async () => {
    const input = code.trim();
    if (!input) {
      Alert.alert('Enter the code or paste the link from your email');
      return;
    }
    setBusy(true);
    const link = parseMagicLink(input);
    const { error } = link
      ? await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: input,
          type: 'email',
        });
    setBusy(false);
    if (error) {
      Alert.alert(
        'Could not sign you in',
        `${error.message}\n\nTip: open your email and either type the 6-digit code, or copy the whole "Log In" link and paste it here.`,
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>Hearth</Text>
      <Text style={styles.tagline}>The chief-of-staff for your household.</Text>

      {pendingInvite ? (
        <Text style={styles.invited}>
          🎉 You've been invited to a family — sign in to join them.
        </Text>
      ) : null}

      {!codeSent ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity style={styles.button} onPress={sendCode} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send sign-in code</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.hint}>
            Check {email.trim()} — enter the 6-digit code, or paste the sign-in
            link from the email.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="123456 — or paste the link"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity style={styles.button} onPress={verifyCode} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCodeSent(false)}>
            <Text style={styles.link}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logo: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  invited: {
    color: colors.primaryDark,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  form: { gap: spacing.md },
  hint: { color: colors.muted, textAlign: 'center' },
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
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: colors.primaryDark, textAlign: 'center', marginTop: spacing.sm },
});
