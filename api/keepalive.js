// Daily ping (Vercel Cron, see vercel.json) so the Supabase free plan never
// pauses the project for inactivity. Calls the keepalive_ping() RPC, which
// writes a row → counts as real database activity.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'Supabase env vars missing' }, { status: 500 });

  const res = await fetch(`${url}/rest/v1/rpc/keepalive_ping`, {
    method: 'POST',
    // New-style keys (sb_publishable_…) aren't JWTs: send them only as apikey.
    headers: {
      apikey: key,
      ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const body = await res.json().catch(() => null);
  return Response.json({ ok: res.ok, pinged_at: body }, { status: res.ok ? 200 : 502 });
}
