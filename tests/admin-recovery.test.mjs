import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import ts from 'typescript';
function load(relative, overrides = {}) {
  const filename = path.resolve(relative), m = new Module(filename);
  m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = m.require.bind(m);
  m.require = id => Object.hasOwn(overrides, id) ? overrides[id] : original(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, filename);
  return m.exports;
}
const store = new Map();
const cookieStore = { get: name => store.has(name) ? { value: store.get(name) } : undefined, set: (name, value) => store.set(name, value), getAll: () => [] };
const recovery = load('lib/admin/recovery.ts', { 'server-only': {}, 'next/headers': { cookies: async () => cookieStore }, './config': { adminCookieOptions: { httpOnly: true, path: '/admin', sameSite: 'lax' } } });
process.env.SUPABASE_SECRET_KEY = 'synthetic-test-signing-key-not-a-credential';
const redirect = location => { throw new Error('REDIRECT ' + location); };
test('recovery state is signed, short-lived, bound to user and session, and fail-closed', async () => {
  const now = Date.now(), token = recovery.signRecovery('owner', 'session', now);
  assert.equal(recovery.validRecovery(token, 'owner', 'session', now), true);
  for (const [value, user, session, time] of [[token, 'other', 'session', now], [token, 'owner', 'other', now], [token + 'x', 'owner', 'session', now], [undefined, 'owner', 'session', now], [token, 'owner', 'session', now + 900000]])
    assert.equal(recovery.validRecovery(value, user, session, time), false);
  await recovery.beginRecovery('owner', 'session');
  assert.equal(await recovery.hasRecovery('owner', 'session'), true);
  await recovery.clearRecovery();
  assert.equal(await recovery.hasRecovery('owner', 'session'), false);
});
test('recovery requests are throttled by normalized address and source with expiry', () => {
  const now = Date.now();
  for (let i = 0; i < 3; i++) assert.equal(recovery.allowRecoveryRequest('Synthetic@example.com', 'ip1', now), true);
  assert.equal(recovery.allowRecoveryRequest('synthetic@example.com', 'ip2', now), false);
  assert.equal(recovery.allowRecoveryRequest('synthetic@example.com', 'ip2', now + 900001), true);
});
test('callback accepts administrator/manager, rejects nonstaff/suspended, and invalid/expired/reused tokens', async () => {
  for (const scenario of ['administrator', 'manager', 'customer', 'suspended', 'invalid', 'expired', 'reused']) {
    let signedOut = 0, stateCreated = 0;
    const client = { auth: { verifyOtp: async args => { assert.equal(args.type, 'recovery'); return { error: ['invalid', 'expired', 'reused'].includes(scenario) ? { code: 'otp_expired' } : null }; }, getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }), signOut: async () => { signedOut++; } }, rpc: async () => ({ data: scenario === 'customer' ? null : { role: scenario === 'manager' ? 'manager' : 'administrator', status: scenario === 'suspended' ? 'suspended' : 'active' }, error: null }) };
    const route = load('app/admin/auth/recovery/route.ts', { '@/lib/admin/server': { adminClient: async () => client, eligibleStaff: value => value?.status === 'active' && ['administrator', 'manager'].includes(value.role) }, '@/lib/admin/recovery': { clearRecovery: async () => {}, recoverySession: async () => ({ userId: 'owner', sessionId: 'session', recovery: true }), beginRecovery: async () => { stateCreated++; } } });
    const response = await route.GET({ nextUrl: new URL('http://localhost/admin/auth/recovery?token_hash=synthetic&type=recovery&next=https://evil.example') });
    const accepted = ['administrator', 'manager'].includes(scenario);
    assert.equal(response.headers.get('location'), accepted ? '/admin/setup' : '/admin/forgot-password?reason=recovery');
    assert.equal(stateCreated, accepted ? 1 : 0); assert.equal(signedOut, accepted ? 0 : 1);
  }
});
test('password checks preserve recovery state on failure and require fresh login after successful save', async () => {
  let updates = 0, signsOut = 0, clears = 0;
  const client = { auth: { updateUser: async () => { updates++; return { error: null }; }, signOut: async () => { signsOut++; } } };
  const actions = load('app/admin/actions.ts', { 'next/navigation': { redirect }, 'next/cache': {}, 'next/headers': {}, '@/lib/admin/workflow': {}, '@/lib/admin/server': { requireStaffEnrollment: async allow => { assert.equal(allow, true); return { client }; } }, '@/lib/admin/recovery': { recoverySession: async () => ({ recovery: true }), recoveryPurpose: async () => "recovery", clearRecovery: async () => { clears++; } } });
  for (const [password, confirm] of [['short', 'short'], ['x'.repeat(129), 'x'.repeat(129)], ['x'.repeat(12), 'different']]) {
    const form = new FormData(); form.set('password', password); form.set('confirm', confirm);
    assert.ok((await actions.setPassword({}, form)).error);
  }
  assert.equal(updates, 0); assert.equal(clears, 0);
  const form = new FormData(); form.set('password', 'x'.repeat(12)); form.set('confirm', 'x'.repeat(12));
  await assert.rejects(actions.setPassword({}, form), /REDIRECT \/admin\/login\?reason=password-saved/);
  assert.equal(updates, 1); assert.equal(signsOut, 1); assert.equal(clears, 1);
});
test('recovery sessions cannot bypass setup by deleting state, invoking MFA, or requesting admin data', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) }, rpc: async () => ({ data: { role: 'administrator', status: 'active' }, error: null }) };
  const server = load('lib/admin/server.ts', { 'server-only': {}, '@supabase/ssr': { createServerClient: () => client }, 'next/headers': { cookies: async () => cookieStore }, 'next/navigation': { redirect }, './config': { adminConfiguration: () => ({ url: 'http://localhost', key: 'test' }), adminCookieOptions: {} }, './recovery': { recoverySession: async () => ({ userId: 'owner', sessionId: 'session', recovery: true }), hasRecovery: async () => false } });
  await assert.rejects(server.requireStaffEnrollment(), /REDIRECT \/admin\/setup/);
  await assert.rejects(server.requireAdmin(), /REDIRECT \/admin\/setup/);
  await assert.rejects(server.requireStaffEnrollment(true), /forgot-password\?reason=recovery/);
});
test('recovery requests use a fixed callback and identical responses on Auth failure or throttling', async () => {
  let allowed = true, failure = false, calls = 0;
  const actions = load('app/admin/actions.ts', { 'next/navigation': { redirect }, 'next/cache': {}, 'next/headers': { headers: async () => new Map([['x-forwarded-for', 'synthetic-source']]) }, '@/lib/admin/workflow': {}, '@/lib/admin/server': { adminClient: async () => ({ auth: { resetPasswordForEmail: async (email, options) => { calls++; assert.equal(email, 'synthetic@example.com'); assert.equal(options.redirectTo, 'http://localhost:3000/admin/auth/recovery'); if (failure) throw new Error('Synthetic unavailable'); return { error: null }; } } }) }, '@/lib/admin/recovery': { allowRecoveryRequest: () => allowed, recoveryOrigin: () => 'http://localhost:3000' } });
  const form = new FormData(); form.set('email', 'synthetic@example.com');
  const first = await actions.requestRecovery({}, form);
  failure = true;
  assert.deepEqual(await actions.requestRecovery({}, form), first);
  allowed = false;
  assert.deepEqual(await actions.requestRecovery({}, form), first);
  assert.equal(calls, 2);
  form.set('email', 'invalid'); assert.ok((await actions.requestRecovery({}, form)).error);
});
test('existing invitation callback still verifies invite tokens and checks membership', async () => {
  const route = load('app/admin/auth/confirm/route.ts', { '@/lib/admin/recovery': { recoverySession: async () => ({ userId: 'owner', sessionId: 'session' }), beginRecovery: async () => {} }, '@/lib/admin/server': { adminClient: async () => ({ auth: { verifyOtp: async args => { assert.equal(args.type, 'invite'); return { error: null }; }, getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) }, rpc: async () => ({ data: { role: 'administrator', status: 'active' }, error: null }) }), eligibleStaff: () => true } });
  const response = await route.GET({ nextUrl: new URL('http://localhost/admin/auth/confirm?token_hash=synthetic&type=invite') });
  assert.equal(response.headers.get('location'), '/admin/setup');
});
test('verified claims recognize both modern recovery and legacy OTP sessions; missing/invalid claims fail closed', async () => {
  for (const method of ['recovery', 'otp', 'password', 'invite']) {
    const client = { auth: { getClaims: async () => ({ data: { claims: { sub: 'owner', session_id: 'session', amr: [{ method }] } }, error: null }) } };
    assert.equal((await recovery.recoverySession(client)).recovery, ['recovery', 'otp'].includes(method));
  }
  for (const claims of [null, { sub: 'owner' }, { sub: 'owner', session_id: 'session', amr: [] }]) {
    await assert.rejects(recovery.recoverySession({ auth: { getClaims: async () => ({ data: { claims }, error: null }) } }));
  }
});
