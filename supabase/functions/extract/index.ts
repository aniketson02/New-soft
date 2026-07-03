// Hearth extraction pipeline.
//
// Invoked directly from the app after a capture is created
// (supabase.functions.invoke('extract', { body: { capture_id } })), and also
// compatible with a Database Webhook payload ({ record }). Reads the raw
// capture (text or photo), asks Claude to extract structured
// events/tasks/list entries, and writes them to `proposals` for one-tap
// review in the app.
//
// Required secrets (supabase secrets set):
//   ANTHROPIC_API_KEY  — Claude API key
//
// Deploy: supabase functions deploy extract

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXTRACTION_TOOL = {
  name: 'record_extracted_items',
  description:
    'Record the events, tasks, and shopping/list entries found in a family note, message, or photographed flyer.',
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

const INSTRUCTIONS = (now: string) =>
  `Today is ${now}. Extract every concrete event, task, and shopping/list item ` +
  `from this family note or photo. Resolve relative dates ("next Thursday") to ` +
  `ISO datetimes. Do not invent items. If there is nothing actionable, record an empty list.`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json().catch(() => ({}));
  const captureId: string | undefined = body?.capture_id ?? body?.record?.id;
  if (!captureId) {
    return new Response(JSON.stringify({ error: 'no capture_id in payload' }), { status: 400 });
  }

  const { data: capture, error: captureError } = await supabase
    .from('captures')
    .select('*')
    .eq('id', captureId)
    .single();
  if (captureError || !capture) {
    return new Response(JSON.stringify({ error: 'capture not found' }), { status: 404 });
  }
  if (capture.status === 'done' || capture.status === 'processing') {
    return new Response(JSON.stringify({ skipped: capture.status }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  await supabase.from('captures').update({ status: 'processing', error: null }).eq('id', capture.id);

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error(
        'AI is not configured yet: run `supabase secrets set ANTHROPIC_API_KEY=...`',
      );
    }

    let userContent: unknown;
    if (capture.kind === 'text' && capture.text_content) {
      userContent = `${INSTRUCTIONS(new Date().toISOString())}\n\n---\n${capture.text_content}`;
    } else if (capture.kind === 'photo' && capture.storage_path) {
      const { data: file, error: downloadError } = await supabase.storage
        .from('captures')
        .download(capture.storage_path);
      if (downloadError || !file) {
        throw new Error(`could not download photo: ${downloadError?.message}`);
      }
      const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
      userContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
        },
        { type: 'text', text: INSTRUCTIONS(new Date().toISOString()) },
      ];
    } else {
      throw new Error(`capture kind "${capture.kind}" not supported yet`);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'record_extracted_items' },
        messages: [{ role: 'user', content: userContent }],
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
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('captures')
      .update({ status: 'error', error: message.slice(0, 500) })
      .eq('id', capture.id);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
