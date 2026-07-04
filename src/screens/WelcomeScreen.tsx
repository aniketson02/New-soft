import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { track } from '../lib/analytics';
import { useAppState } from '../context/AppState';
import Avatar from '../components/Avatar';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const EXPLAINERS = [
  {
    icon: '✨',
    title: 'Capture anything',
    text: 'Snap a flyer, paste an email, type a brain dump — Hearth turns it into events, tasks, and lists.',
  },
  {
    icon: '📋',
    title: 'One shared board',
    text: 'Everyone in the family sees the same live board. Change something and it syncs to every phone.',
  },
  {
    icon: '✅',
    title: 'You stay in control',
    text: 'AI suggestions arrive as review cards — one tap to accept, edit, or dismiss.',
  },
];

/** One-time landing for someone who just joined an existing family. */
export default function WelcomeScreen({ navigation }: Props) {
  const { family, member, members, ackJoined } = useAppState();

  useEffect(() => {
    track('joiner_welcome_shown');
  }, []);

  const others = members.filter((m) => m.id !== member?.id);

  const toBoard = () => {
    track('joiner_welcome_to_board');
    ackJoined();
    navigation.replace('Board');
  };

  const toCapture = () => {
    track('joiner_welcome_to_capture');
    ackJoined();
    navigation.reset({ index: 1, routes: [{ name: 'Board' }, { name: 'Capture' }] });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hello}>
        Welcome{member ? `, ${member.display_name}` : ''}! 👋
      </Text>
      <Text style={styles.title}>You're in {family?.name ?? 'the family'}.</Text>

      {others.length > 0 && (
        <View style={styles.membersRow}>
          <View style={styles.avatars}>
            {others.slice(0, 5).map((m) => (
              <Avatar key={m.id} memberId={m.id} name={m.display_name} size={36} />
            ))}
          </View>
          <Text style={styles.membersText}>
            {others.map((m) => m.display_name).join(', ')}
            {others.length === 1 ? ' is' : ' are'} already here.
          </Text>
        </View>
      )}

      <View style={styles.cards}>
        {EXPLAINERS.map((e) => (
          <View key={e.title} style={styles.card}>
            <Text style={styles.cardIcon}>{e.icon}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{e.title}</Text>
              <Text style={styles.cardText}>{e.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={toBoard}>
        <Text style={styles.buttonText}>See the family board</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={toCapture}>
        <Text style={styles.secondaryText}>✨ Or try a capture first</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl * 2, gap: spacing.md },
  hello: { fontSize: 18, color: colors.muted, fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, lineHeight: 36 },
  membersRow: { gap: spacing.sm, marginTop: spacing.xs },
  avatars: { flexDirection: 'row', gap: spacing.xs },
  membersText: { color: colors.muted, fontSize: 15 },
  cards: { gap: spacing.sm, marginTop: spacing.sm },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  cardIcon: { fontSize: 24 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardText: { fontSize: 14, color: colors.muted, marginTop: 2, lineHeight: 20 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { alignItems: 'center', padding: spacing.sm },
  secondaryText: { color: colors.primaryDark, fontWeight: '600', fontSize: 15 },
});
