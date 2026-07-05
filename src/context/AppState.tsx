import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { captureInviteFromUrl, clearPendingInvite } from '../lib/inviteLink';
import type { Family, Member, Usage } from '../types';

interface AppState {
  loading: boolean;
  session: Session | null;
  family: Family | null;
  member: Member | null;
  members: Member[];
  /** True when the family has no captures and no items yet — show the
   * guided first-capture onboarding instead of an empty board. */
  needsOnboarding: boolean;
  /** Invite code captured from a ?join= link, pending until used. */
  pendingInvite: string | null;
  clearInvite: () => void;
  /** True right after this user joined an existing family — show the
   * one-time welcome screen instead of dropping them on the board. */
  justJoined: boolean;
  markJoined: () => void;
  ackJoined: () => void;
  /** Current-month AI usage + plan for this family. */
  usage: Usage | null;
  refreshUsage: () => Promise<void>;
  refreshFamily: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  useEffect(() => {
    captureInviteFromUrl().then(setPendingInvite);
  }, []);

  const clearInvite = useCallback(() => {
    setPendingInvite(null);
    clearPendingInvite();
  }, []);

  const [justJoined, setJustJoined] = useState(false);
  const markJoined = useCallback(() => setJustJoined(true), []);
  const ackJoined = useCallback(() => setJustJoined(false), []);

  const [usage, setUsage] = useState<Usage | null>(null);
  const refreshUsage = useCallback(async () => {
    const { data } = await supabase.rpc('get_usage');
    setUsage((data as Usage) ?? null);
  }, []);

  const loadFamily = useCallback(async (userId: string) => {
    const { data: myMember } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!myMember) {
      setFamily(null);
      setMember(null);
      setMembers([]);
      setNeedsOnboarding(false);
      setUsage(null);
      return;
    }

    const [{ data: fam }, { data: all }, { count: captureCount }, { count: itemCount }] =
      await Promise.all([
        supabase.from('families').select('*').eq('id', myMember.family_id).single(),
        supabase.from('members').select('*').eq('family_id', myMember.family_id),
        supabase
          .from('captures')
          .select('id', { count: 'exact', head: true })
          .eq('family_id', myMember.family_id),
        supabase
          .from('items')
          .select('id', { count: 'exact', head: true })
          .eq('family_id', myMember.family_id),
      ]);

    setMember(myMember as Member);
    setNeedsOnboarding((captureCount ?? 0) === 0 && (itemCount ?? 0) === 0);
    setFamily((fam as Family) ?? null);
    setMembers((all as Member[]) ?? []);
    refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadFamily(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s) {
        if (event === 'SIGNED_IN') track('sign_in');
        await loadFamily(s.user.id);
      } else {
        setFamily(null);
        setMember(null);
        setMembers([]);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadFamily]);

  const refreshFamily = useCallback(async () => {
    if (session) await loadFamily(session.user.id);
  }, [session, loadFamily]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      family,
      member,
      members,
      needsOnboarding,
      pendingInvite,
      clearInvite,
      justJoined,
      markJoined,
      ackJoined,
      usage,
      refreshUsage,
      refreshFamily,
      signOut,
    }),
    [
      loading,
      session,
      family,
      member,
      members,
      needsOnboarding,
      pendingInvite,
      clearInvite,
      justJoined,
      markJoined,
      ackJoined,
      usage,
      refreshUsage,
      refreshFamily,
      signOut,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
