export type ItemType = 'event' | 'task' | 'list_entry';
export type ItemStatus = 'open' | 'done';
export type MemberRole = 'adult' | 'kid';
export type CaptureKind = 'photo' | 'voice' | 'text';
export type ProposalStatus = 'pending' | 'accepted' | 'dismissed';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Member {
  id: string;
  family_id: string;
  user_id: string | null;
  display_name: string;
  role: MemberRole;
  created_at: string;
}

export interface List {
  id: string;
  family_id: string;
  name: string;
  created_at: string;
}

export interface Item {
  id: string;
  family_id: string;
  type: ItemType;
  title: string;
  notes: string | null;
  owner_member_id: string | null;
  list_id: string | null;
  due_at: string | null;
  recurrence: string | null;
  status: ItemStatus;
  source_proposal_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Capture {
  id: string;
  family_id: string;
  created_by: string | null;
  kind: CaptureKind;
  storage_path: string | null;
  text_content: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error: string | null;
  created_at: string;
}

/** Shape of the JSON payload the extraction pipeline puts on a proposal. */
export interface ProposalPayload {
  type: ItemType;
  title: string;
  notes?: string;
  due_at?: string;
  recurrence?: string;
  owner_hint?: string;
  list_name?: string;
}

export interface Proposal {
  id: string;
  family_id: string;
  capture_id: string | null;
  payload: ProposalPayload;
  status: ProposalStatus;
  created_at: string;
}

export interface Usage {
  plan: 'free' | 'premium';
  used: number;
  limit: number | null; // null when premium (unlimited)
  remaining: number | null;
  period_end: string;
}
