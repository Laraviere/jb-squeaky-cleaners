import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";
function load(relative, overrides = {}) {
  const filename = path.resolve(relative),
    m = new Module(filename);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = m.require.bind(m);
  m.require = (id) =>
    Object.hasOwn(overrides, id) ? overrides[id] : original(id);
  m._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
      },
    }).outputText,
    filename,
  );
  return m.exports;
}
const workflow = load("lib/admin/workflow.ts");
test("workflow accepts only known kinds, UUIDs, allowed statuses and bounded notes", () => {
  assert.equal(workflow.isRecordKind("quotes"), true);
  assert.equal(workflow.isRecordKind("applications"), true);
  assert.equal(workflow.isRecordKind("staff"), false);
  assert.equal(workflow.validId("12121212-1212-4212-8212-121212121212"), true);
  assert.equal(workflow.validId("../"), false);
  for (const kind of ["quotes", "applications"])
    for (const status of workflow.statuses(kind))
      assert.equal(workflow.validStatus(kind, status), true);
  assert.equal(workflow.validStatus("quotes", "hired"), false);
  assert.equal(workflow.validStatus("applications", "won"), false);
  assert.equal(workflow.validNote("   "), false);
  assert.equal(workflow.validNote("a".repeat(4001)), false);
  assert.equal(workflow.validNote("A staff note"), true);
});
const config = load("lib/admin/config.ts");
test("MFA QR sources preserve SVG content and pass Next.js development image validation", () => {
  const { mfaQrImageSource } = load("lib/admin/mfa.ts");
  const { getImageProps } = load("node_modules/next/image.js");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg">\n</svg>\n';
  const raw = `data:image/svg+xml;utf-8,${svg}`;
  assert.throws(() => getImageProps({ src: raw, width: 220, height: 220, alt: "Synthetic QR", unoptimized: true }), /cannot end with a space or control character/);
  for (const input of [svg, raw, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`]) {
    const src = mfaQrImageSource(input);
    assert.equal(decodeURIComponent(src.slice(src.indexOf(",") + 1)), svg);
    assert.ok(getImageProps({ src, width: 220, height: 220, alt: "Synthetic QR", unoptimized: true }).props.src);
  }
  const base64 = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  assert.equal(mfaQrImageSource(base64), base64);
});
test("admin sessions use a dedicated name while retaining restricted cookie scope", () => {
  assert.equal(config.adminCookieOptions.name, "sb-jb-squeaky-admin-auth");
  assert.equal(config.adminCookieOptions.path, "/admin");
  assert.equal(config.adminCookieOptions.httpOnly, true);
  assert.equal(config.adminCookieOptions.sameSite, "lax");
});
test("SSR configuration refuses privileged credentials and insecure hosted URLs", () => {
  const saved = { ...process.env };
  try {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_secret_test";
    assert.equal(config.adminConfiguration(), null);
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    assert.ok(config.adminConfiguration());
    process.env.SUPABASE_PUBLISHABLE_KEY = [
      "eyJhbGciOiJIUzI1NiJ9",
      Buffer.from(JSON.stringify({ role: "service_role" })).toString(
        "base64url",
      ),
      "signature",
    ].join(".");
    assert.equal(config.adminConfiguration(), null);
    process.env.SUPABASE_URL = "http://example.com";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    assert.equal(config.adminConfiguration(), null);
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    assert.ok(config.adminConfiguration());
  } finally {
    process.env = saved;
  }
});
const redirect = (location) => {
  throw new Error("REDIRECT " + location);
};
test("admin configuration waits for request cookies and fails closed when runtime configuration is missing", async () => {
  let requestAvailable = false, configurationReads = 0, clientCreations = 0;
  const requestOnly = load("lib/admin/server.ts", {
    "server-only": {},
    "@supabase/ssr": { createServerClient: () => { clientCreations++; } },
    "next/headers": {
      cookies: async () => {
        if (!requestAvailable) throw new Error("PRERENDER_INTERRUPTED");
        return { getAll: () => [], set: () => {} };
      },
    },
    "next/navigation": { redirect },
    "./config": {
      adminConfiguration: () => { configurationReads++; return null; },
      adminCookieOptions: {},
    },
  });
  await assert.rejects(requestOnly.adminClient(), /PRERENDER_INTERRUPTED/);
  assert.equal(configurationReads, 0);
  requestAvailable = true;
  await assert.rejects(requestOnly.requireAdmin(), /Admin authentication is not configured/);
  assert.equal(configurationReads, 1);
  assert.equal(clientCreations, 0);
});
let user = { id: "synthetic" },
  identity = { role: "administrator", status: "active" },
  aal = "aal2",
  allowed = true,
  identityReads = 0;
const client = {
  auth: {
    getUser: async () => ({ data: { user }, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({
        data: { currentLevel: aal },
        error: null,
      }),
    },
  },
  rpc: async (name) =>
    name === "admin_identity"
      ? (identityReads++, { data: identity, error: null })
      : { data: allowed, error: null },
};
const server = load("lib/admin/server.ts", {
  "server-only": {},
  "@supabase/ssr": { createServerClient: () => client },
  "next/headers": {
    cookies: async () => ({ getAll: () => [], set: () => {} }),
  },
  "next/navigation": { redirect },
  "./config": {
    adminConfiguration: () => ({
      url: "http://127.0.0.1:54321",
      key: "sb_publishable_test",
    }),
    adminCookieOptions: {},
  },
});
test("anonymous, customer, employee and suspended sessions are denied server-side", async () => {
  user = null;
  await assert.rejects(server.requireAdmin(), /REDIRECT \/admin\/login$/);
  user = { id: "synthetic" };
  for (const value of [
    null,
    { role: "employee", status: "active" },
    { role: "administrator", status: "suspended" },
  ]) {
    identity = value;
    await assert.rejects(server.requireAdmin(), /reason=access/);
  }
});
test("administrator and manager need MFA and fresh database permission on every request", async () => {
  for (const role of ["administrator", "manager"]) {
    identity = { role, status: "active" };
    aal = "aal1";
    await assert.rejects(server.requireAdmin(), /\/admin\/mfa/);
    aal = "aal2";
    allowed = true;
    assert.ok((await server.requireAdmin()).user);
    allowed = false;
    await assert.rejects(server.requireAdmin(), /reason=access/);
  }
  allowed = true;
  identity = { role: "manager", status: "active" };
  const before = identityReads;
  await server.requireAdmin();
  identity.status = "suspended";
  await assert.rejects(server.requireAdmin(), /reason=access/);
  assert.equal(identityReads, before + 2);
});
test("management actions validate inputs and never accept an actor from the caller", async () => {
  const calls = [];
  const fake = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { error: null };
    },
  };
  const actions = load("app/admin/actions.ts", {
    "next/navigation": { redirect },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/admin/server": {
      requireAdmin: async (permission) => {
        assert.match(permission, /^(quotes|applications)\.manage$/);
        return { client: fake };
      },
    },
    "@/lib/admin/workflow": workflow,
  });
  const id = "12121212-1212-4212-8212-121212121212";
  for (const kind of ["quotes", "applications"]) {
    const form = new FormData();
    Object.entries({
      kind,
      id,
      operation: "status",
      status: kind === "quotes" ? "contacted" : "reviewing",
      actor_id: "forged",
    }).forEach(([k, v]) => form.set(k, v));
    assert.equal(
      (await actions.manageRecord({}, form)).success,
      "Status saved.",
    );
    assert.deepEqual(Object.keys(calls.at(-1).args).sort(), [
      "next_status",
      "record_id",
      "record_kind",
    ]);
    form.set("operation", "note");
    form.set("note", " Internal note ");
    assert.equal((await actions.manageRecord({}, form)).success, "Note saved.");
    assert.equal(calls.at(-1).args.note_body, "Internal note");
    assert.equal("actor_id" in calls.at(-1).args, false);
    form.set("note", " ");
    assert.ok((await actions.manageRecord({}, form)).error);
  }
});
test("list requests use permission checks and bounded typed search/filter/pagination inputs", async () => {
  const requests = [];
  const data = load("lib/admin/data.ts", {
    "server-only": {},
    "next/navigation": {
      notFound: () => {
        throw new Error("NOT_FOUND");
      },
    },
    "./server": {
      requireAdmin: async (permission) => {
        assert.equal(permission, "quotes.read");
        return {
          client: {
            rpc: async (name, args) => {
              requests.push({ name, args });
              return { data: { rows: [], total: 0 }, error: null };
            },
          },
        };
      },
    },
    "./workflow": workflow,
  });
  const result = await data.listRecords("quotes", {
    q: ["bad", "repeated"],
    page: ["2", "3"],
    status: "hired",
    sort: "invented",
  });
  assert.equal(result.q, "");
  assert.equal(result.page, 1);
  assert.equal(result.status, "");
  assert.equal(result.sort, "newest");
  await data.listRecords("quotes", {
    q: "a".repeat(500),
    page: "999999999",
    status: "won",
    sort: "oldest",
  });
  assert.equal(requests.at(-1).args.search_text.length, 200);
  assert.equal(requests.at(-1).args.page_number, 100000);
  assert.equal(requests.at(-1).args.status_filter, "won");
  assert.equal(requests.at(-1).args.oldest_first, true);
});
