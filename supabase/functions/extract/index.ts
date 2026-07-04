// Hearth extraction pipeline.
//
// Invoked directly from the app after a capture is created
// (supabase.functions.invoke('extract', { body: { capture_id } })), and also
// compatible with a Database Webhook payload ({ record }). Reads the raw
// capture (text or photo), asks an LLM to extract structured
// events/tasks/list entries, and writes them to `proposals` for one-tap
// review in the app.
//
// Provider selection:
//   1. ANTHROPIC_API_KEY secret set  → Claude (tool-use extraction)
//   2. otherwise                     → Gemini, key read from Supabase Vault
//                                      via the service-role-only get_llm_key()
//
// Deploy: supabase functions deploy extract

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface ExtractedItem {
  type: 'event' | 'task' | 'list_entry';
  title: string;
  notes?: string;
  due_at?: string;
  recurrence?: string;
  owner_hint?: string;
  list_name?: string;
}

const ITEM_FIELDS = {
  type: 'event | task | list_entry',
  title: 'short, action-oriented title',
  notes: 'optional details',
  due_at: 'ISO 8601 datetime if a date/time is stated or clearly implied',
  recurrence: 'iCal RRULE if the item repeats (e.g. FREQ=WEEKLY;BYDAY=TH)',
  owner_hint: 'name of the family member who should own this, if mentioned',
  list_name: 'for list_entry items: which list (e.g. Groceries)',
};

const INSTRUCTIONS = (now: string) =>
  `Today is ${now}. Extract every concrete event, task, and shopping/list item ` +
  `from this family note or photo. Resolve relative dates ("next Thursday") to ` +
  `ISO datetimes. Do not invent items. Return an empty list if nothing is actionable.`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

async function extractWithClaude(
  apiKey: string,
  text: string | null,
  imageB64: string | null,
): Promise<ExtractedItem[]> {
  const tool = {
    name: 'record_extracted_items',
    description: 'Record the events, tasks, and list entries found in the input.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(ITEM_FIELDS).map(([k, d]) => [
                k,
                k === 'type'
                  ? { type: 'string', enum: ['event', 'task', 'list_entry'] }
                  : { type: 'string', description: d },
              ]),
            ),
            required: ['type', 'title'],
          },
        },
      },
      required: ['items'],
    },
  };

  const content = imageB64
    ? [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } },
        { type: 'text', text: INSTRUCTIONS(new Date().toISOString()) },
      ]
    : `${INSTRUCTIONS(new Date().toISOString())}\n\n---\n${text}`;

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
      tools: [tool],
      tool_choice: { type: 'tool', name: 'record_extracted_items' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API ${response.status}: ${await response.text()}`);

  const message = await response.json();
  const toolUse = message.content?.find((b: { type: string }) => b.type === 'tool_use');
  return toolUse?.input?.items ?? [];
}

async function extractWithGemini(
  apiKey: string,
  text: string | null,
  imageB64: string | null,
): Promise<ExtractedItem[]> {
  const parts: unknown[] = [];
  if (imageB64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageB64 } });
  parts.push({
    text: imageB64
      ? INSTRUCTIONS(new Date().toISOString())
      : `${INSTRUCTIONS(new Date().toISOString())}\n\n---\n${text}`,
  });

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: Object.fromEntries(
                Object.entries(ITEM_FIELDS).map(([k, d]) => [
                  k,
                  k === 'type'
                    ? { type: 'STRING', enum: ['event', 'task', 'list_entry'] }
                    : { type: 'STRING', description: d },
                ]),
              ),
              required: ['type', 'title'],
            },
          },
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini API ${response.status}: ${await response.text()}`);

  const message = await response.json();
  const jsonText = message.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) return [];
  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed) ? parsed : [];
}

async function resolveProvider(
  supabase: SupabaseClient,
): Promise<{ run: (text: string | null, img: string | null) => Promise<ExtractedItem[]> }> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (anthropicKey) {
    return { run: (t, i) => extractWithClaude(anthropicKey, t, i) };
  }
  const { data: vaultKey, error } = await supabase.rpc('get_llm_key');
  if (error || !vaultKey) {
    throw new Error(
      'AI is not configured yet: set the ANTHROPIC_API_KEY secret or store a Gemini key in Vault as llm_api_key',
    );
  }
  return { run: (t, i) => extractWithGemini(vaultKey, t, i) };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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

  await supabase
    .from('captures')
    .update({ status: 'processing', error: null })
    .eq('id', capture.id);

  try {
    let text: string | null = null;
    let imageB64: string | null = null;

    if (capture.kind === 'text' && capture.text_content) {
      text = capture.text_content;
    } else if (capture.kind === 'photo' && capture.storage_path) {
      const { data: file, error: downloadError } = await supabase.storage
        .from('captures')
        .download(capture.storage_path);
      if (downloadError || !file) {
        throw new Error(`could not download photo: ${downloadError?.message}`);
      }
      imageB64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    } else {
      throw new Error(`capture kind "${capture.kind}" not supported yet`);
    }

    const provider = await resolveProvider(supabase);
    const items = (await provider.run(text, imageB64)).filter(
      (i) => i && typeof i.title === 'string' && ['event', 'task', 'list_entry'].includes(i.type),
    );

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
