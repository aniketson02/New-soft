import { supabase } from './supabase';

/**
 * First-party product analytics: fire-and-forget inserts into the write-only
 * `events` table. Funnel we care about:
 *   sign_in → family_created / family_joined → capture_created →
 *   proposal_accepted → invite_shared (viral loop)
 */
export function track(name: string, props: Record<string, unknown> = {}): void {
  supabase
    .from('events')
    .insert({ name, props })
    .then(({ error }) => {
      if (error && __DEV__) console.warn('analytics:', error.message);
    });
}
