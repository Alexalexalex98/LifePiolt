import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseTransport, mapError } from '../src/sync/supabaseTransport.ts';

const cfg = { url: 'https://x.supabase.co', anonKey: 'k', deviceId: 'dev1', deviceName: 'Telefono' };
function fake({ session = true, rpc } = {}) {
  const calls = [];
  const client = {
    rpc: async (fn, args) => { calls.push([fn, args]); return rpc ? rpc(fn, args) : { data: {}, error: null }; },
    from: () => ({ select: async () => ({ data: [{ id: 'dev1', nome: 'Telefono', ultimo_accesso: '2026-01-01T00:00:00Z' }], error: null }) }),
    auth: {
      getSession: async () => ({ data: { session: session ? { user: { email: 'a@b.it' } } : null } }),
      signInWithOtp: async () => ({ data: {}, error: null }),
      verifyOtp: async ({ token }) => (token === '123456' ? { data: {}, error: null } : { data: null, error: { message: 'bad' } }),
      signOut: async () => ({}),
    },
  };
  return { client, calls };
}

test('senza sessione non è collegato e dice di accedere', async () => {
  const t = new SupabaseTransport(fake({ session: false }).client, cfg);
  const r = await t.connect(cfg);
  assert.equal(r.ok, false); assert.match(r.message, /accedi/i);
  await assert.rejects(() => t.push([]), (e) => e.kind === 'auth');
});
test('accesso con codice email e collegamento', async () => {
  const { client } = fake({ session: false });
  const t = new SupabaseTransport(client, cfg);
  await assert.rejects(() => t.auth.signIn({ email: 'nope' }), (e) => e.kind === 'auth');
  await t.auth.signIn({ email: 'A@B.it' });
  await assert.rejects(() => t.auth.signIn({ email: 'a@b.it', token: '000000' }), (e) => e.kind === 'auth');
  await t.auth.signIn({ email: 'a@b.it', token: '123456' });
  assert.equal(t.auth.state(), 'ok');
});
test('push e pull chiamano le funzioni SQL con i parametri giusti', async () => {
  const { client, calls } = fake({ rpc: (fn) => (fn === 'sync_push' ? { data: { acked: ['c1'], rejected: [], serverCursor: 7 }, error: null } : { data: { changes: [], nextCursor: 7, hasMore: false }, error: null }) });
  const t = new SupabaseTransport(client, cfg, 'ios');
  await t.connect(cfg);
  const p = await t.push([{ id: 'c1' }]);
  assert.deepEqual(p, { acked: ['c1'], rejected: [], serverCursor: '7' });
  assert.equal(calls[0][1].batch.deviceId, 'dev1'); assert.equal(calls[0][1].batch.platform, 'ios');
  const l = await t.pull('5', { limit: 100 });
  assert.equal(calls[1][0], 'sync_pull'); assert.equal(calls[1][1].p_cursor, 5); assert.equal(l.nextCursor, '7');
  const d = await t.devices(); assert.equal(d[0].current, true);
});
test('errori: limite, accesso scaduto, rete, server in pausa', async () => {
  assert.equal(mapError({ status: 429 }, { error: 'rate_limited', retry_after: 12 }).retryAfterMs, 12000);
  assert.equal(mapError({ code: 'PT401' }).kind, 'auth');
  assert.equal(mapError({ message: 'TypeError: Failed to fetch' }).kind, 'network');
  assert.equal(mapError({ status: 503 }).kind, 'unavailable');
  const { client } = fake({ rpc: () => ({ data: null, error: { code: 'PT401', message: 'unauthorized' } }) });
  const t = new SupabaseTransport(client, cfg); await t.connect(cfg);
  await assert.rejects(() => t.pull(null), (e) => e.kind === 'auth');
  assert.equal(t.auth.state(), 'expired');
});
