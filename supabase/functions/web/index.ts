// Hearth web host.
//
// Serves the Expo web build (committed to the repo under dist/) at
//   https://<project>.supabase.co/functions/v1/web
// by proxying raw.githubusercontent.com with an in-memory cache. The repo is
// public, so no credentials are involved. Deployed with verify_jwt=false —
// it is a public web page.

const UPSTREAM =
  'https://raw.githubusercontent.com/aniketson02/New-soft/claude/genesis-startup-discovery-rk9rrv/dist';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const cache = new Map<string, { body: Uint8Array; type: string }>();

function extOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // strip the function name prefix (/web) added by the platform router
  let path = url.pathname.replace(/^\/web/, '');
  if (path === '' || path === '/') path = '/index.html';
  // SPA fallback: extensionless routes get the app shell
  if (!extOf(path)) path = '/index.html';

  const ext = extOf(path);
  const type = MIME[ext] ?? 'application/octet-stream';
  const isHtml = ext === '.html';

  let entry = cache.get(path);
  if (!entry) {
    const upstream = await fetch(UPSTREAM + path);
    if (!upstream.ok) {
      return new Response('Not found', { status: 404 });
    }
    entry = { body: new Uint8Array(await upstream.arrayBuffer()), type };
    if (!isHtml) cache.set(path, entry); // hashed assets are immutable
  }

  return new Response(entry.body.slice(), {
    headers: {
      'content-type': entry.type,
      'cache-control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
  });
});
