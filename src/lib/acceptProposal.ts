import { supabase } from './supabase';
import type { Member, Proposal, ProposalPayload } from '../types';

function matchOwner(hint: string | undefined, members: Member[]): string | null {
  if (!hint) return null;
  const needle = hint.trim().toLowerCase();
  const hit = members.find(
    (m) =>
      m.display_name.toLowerCase() === needle ||
      m.display_name.toLowerCase().startsWith(needle),
  );
  return hit?.id ?? null;
}

async function resolveList(familyId: string, name: string | undefined): Promise<string | null> {
  if (!name) return null;
  const { data: existing } = await supabase
    .from('lists')
    .select('id, name')
    .eq('family_id', familyId);
  const hit = existing?.find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
  if (hit) return hit.id;
  const { data: created, error } = await supabase
    .from('lists')
    .insert({ family_id: familyId, name: name.trim() })
    .select('id')
    .single();
  if (error) return null;
  return created.id;
}

/**
 * Turn an accepted proposal into a confirmed board item and mark the
 * proposal accepted. `overrides` carries any edits the user made on the
 * review card before accepting.
 */
export async function acceptProposal(
  proposal: Proposal,
  members: Member[],
  overrides: Partial<ProposalPayload> = {},
): Promise<{ error: string | null }> {
  const payload: ProposalPayload = { ...proposal.payload, ...overrides };

  const listId =
    payload.type === 'list_entry'
      ? await resolveList(proposal.family_id, payload.list_name ?? 'Groceries')
      : null;

  const { error: insertError } = await supabase.from('items').insert({
    family_id: proposal.family_id,
    type: payload.type,
    title: payload.title,
    notes: payload.notes ?? null,
    owner_member_id: matchOwner(payload.owner_hint, members),
    list_id: listId,
    due_at: payload.due_at ?? null,
    recurrence: payload.recurrence ?? null,
    source_proposal_id: proposal.id,
  });
  if (insertError) return { error: insertError.message };

  const { error: updateError } = await supabase
    .from('proposals')
    .update({ status: 'accepted' })
    .eq('id', proposal.id);
  return { error: updateError?.message ?? null };
}

export async function dismissProposal(proposal: Proposal): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('proposals')
    .update({ status: 'dismissed' })
    .eq('id', proposal.id);
  return { error: error?.message ?? null };
}
