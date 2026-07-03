// Hearth extraction pipeline (Phase 2).
//
// Triggered by a database webhook on INSERT into `captures`. Reads the raw
// capture (text for now; photo/voice next), asks Claude to extract structured
// events/tasks/list entries, and writes them to `proposals` for one-tap
// review in the app.
//
// Required secrets (supabase secrets set):
//   ANTHROPIC_API_KEY  — Claude API key
//
// Deploy: supabase functions deploy extract
// Wire up: Database Webhooks → captures INSERT → this function.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXTRACTION_TOOL = {
  name: 'record_extracted_items',
  description:
    'Record the events, tasks, and shopping/list entries found in a family note or message.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['event', 'task', 'list_entry'] },
            title: { type: 'string', description: 'Short, action-oriented title' },
            notes: { type: 'string' },
            due_at: {
              type: 'string',
              description: 'ISO 8601 datetime if a date/time is stated or clearly implied',
            },
            recurrence: {
              type: 'string',
              description: 'iCal RRULE if the item repeats (e.g. FREQ=WEEKLY;BYDAY=TH)',
            },
            owner_hint: {
              type: 'string',
              description: 'Name of the family member who should own this, if mentioned',
            },
            list_name: {
              type: 'string',
              description: 'For list_entry items: which list (e.g. Groceries)',
            },
          },
          required: ['type', 'title'],
        },
      },
    },
    required: ['items'],
  },
} as const;

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { record: capture } = await req.json();
  if (!capture?.id) {
    return new Response(JSON.stringify({ error: 'no capture in payload' }), { status: 400 });
  }

  await supabase.from('captures').update({ status: 'processing' }).eq('id', capture.id);

  try {
    if (capture.kind !== 'text' || !capture.text_content) {
      // Photo (vision) and voice (transcription) ingestion land here next.
      throw new Error(`capture kind "${capture.kind}" not supported yet`);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'record_extracted_items' },
        messages: [
          {
            role: 'user',
            content:
              `Today is ${new Date().toISOString()}. Extract every concrete event, task, ` +
              `and shopping/list item from this family note. Resolve relative dates ` +
              `("next Thursday") to ISO datetimes. Do not invent items.\n\n---\n` +
              capture.text_content,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API ${response.status}: ${await response.text()}`);
    }

    const message = await response.json();
    const toolUse = message.content?.find((b: { type: string }) => b.type === 'tool_use');
    const items: Record<string, unknown>[] = toolUse?.input?.items ?? [];

    if (items.length > 0) {
      const { error } = await supabase.from('proposals').insert(
        items.map((payload) => ({
          family_id: capture.family_id,
          capture_id: capture.id,
          payload,
        })),
      );
      if (error) throw error;
    }

    await supabase.from('captures').update({ status: 'done' }).eq('id', capture.id);
    return new Response(JSON.stringify({ proposals: items.length }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    await supabase
      .from('captures')
      .update({ status: 'error', error: String(err) })
      .eq('id', capture.id);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
