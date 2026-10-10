// Opt-in integration tests. NEVER runs against a hosted URL; retains synthetic records/users.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import ts from "typescript";
import Module from "node:module";
const enabled = process.env.ADMIN_LOCAL_TESTS === "1";
const run = (name, fn) => test(name, { skip: !enabled, timeout: 90000 }, fn);
const root = path.resolve(".");
let url,
  key,
  privileged,
  users = {},
  clients = {},
  records = {},
  baseline,
  browser,
  server,
  base,
  serverLog = "",
  privilegedSecrets = [];
const sql = (query) =>
  JSON.parse(
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "supabase_db_jb-squeaky-cleaners",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-tA",
        "-c",
        query,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
const fingerprints = () =>
  sql(
    "select json_build_object('quotes',coalesce((select jsonb_object_agg(id,md5(to_jsonb(q)::text)) from public.quote_requests q),'{}'::jsonb),'applications',coalesce((select jsonb_object_agg(id,md5(to_jsonb(a)::text)) from public.employment_applications a),'{}'::jsonb))",
  );
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=/g, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", Buffer.from(bytes))
    .update(counter)
    .digest();
  const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
async function newContext() {
  const context = await browser.newContext();
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(15000);
  return context;
}
const newClient = () =>
  createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
function schema() {
  const m = new Module(path.join(root, "lib/employment.ts"));
  m._compile(
    ts.transpileModule(fs.readFileSync(m.id, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
      },
    }).outputText,
    m.id,
  );
  return m.exports;
}
const employment = schema();
const answers = {
  full_name: "Synthetic Admin QA Applicant",
  address: "100 Synthetic Lane",
  city: "Galax",
  state: "VA",
  zip: "24333",
  phone: "2765550144",
  email: "synthetic-admin-applicant@example.com",
  position: "Synthetic cleaner",
  available_date: "2026-11-01",
  employment_preference: ["Part-time"],
  work_authorization: "Yes",
  sponsorship: "No",
  days: ["Monday"],
  earliest_time: "17:00",
  latest_time: "08:00",
  weekends: "Yes",
  evenings: "Yes",
  overtime: "No",
  years_experience: "0",
  valid_license: "Yes",
  transportation: "Yes",
  driving_duties: "No",
};
const references = [0, 1].map((i) => ({
  name: `Synthetic reference ${i + 1}`,
  relationship: "Colleague",
  phone: "2765550142",
}));
before(
  async () => {
    if (!enabled) return;
    const status = JSON.parse(
      execFileSync(
        path.join(root, "node_modules/.bin/supabase"),
        ["status", "-o", "json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
    assert.equal(
      status.API_URL,
      "http://127.0.0.1:54321",
      "Local Supabase URL must be positively verified",
    );
    url = status.API_URL;
    key = status.PUBLISHABLE_KEY || status.ANON_KEY;
    const env = Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
        }),
    );
    assert.equal(env.SUPABASE_URL, url);
    assert.equal(env.EMPLOYMENT_APPLICATIONS_ENABLED, "true");
    privileged = createClient(
      url,
      status.SECRET_KEY || status.SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    privilegedSecrets = [
      status.SECRET_KEY,
      status.SERVICE_ROLE_KEY,
      env.SUPABASE_SECRET_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.EMPLOYMENT_APPLICATION_SECRET,
    ].filter(Boolean);
    baseline = fingerprints();
    const tag = randomUUID().slice(0, 8);
    for (const role of [
      "administrator",
      "manager",
      "employee",
      "customer",
      "suspended",
      "unenrolled",
    ]) {
      const email = `synthetic-admin-${role}-${tag}@example.com`,
        password = randomBytes(24).toString("base64url");
      const result = await privileged.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ok(
        !result.error && result.data.user,
        "Synthetic local Auth user created",
      );
      users[role] = { id: result.data.user.id, email, password };
      if (role !== "customer")
        sql(
          `with inserted as (insert into public.staff_memberships(user_id,role,status) values('${users[role].id}','${["suspended", "unenrolled"].includes(role) ? "administrator" : role}','${role === "suspended" ? "suspended" : "active"}') returning user_id) select to_json(count(*)) from inserted`,
        );
      const client = newClient();
      const signIn = await client.auth.signInWithPassword({ email, password });
      assert.ok(!signIn.error, "Synthetic local sign in confirmed");
      clients[role] = client;
      if (
        ["administrator", "manager", "employee", "suspended"].includes(role)
      ) {
        const enrolled = await client.auth.mfa.enroll({ factorType: "totp" });
        assert.ok(!enrolled.error, "Local TOTP enrollment available");
        users[role].factor = enrolled.data.id;
        users[role].secret = enrolled.data.totp.secret;
        {
          const verified = await client.auth.mfa.challengeAndVerify({
            factorId: enrolled.data.id,
            code: totp(enrolled.data.totp.secret),
          });
          assert.ok(!verified.error, "Local MFA verification confirmed");
        }
      }
    }
    const quote = {
      name: "Synthetic Admin QA Customer",
      phone: "2765550144",
      email: `synthetic-quote-${tag}@example.com`,
      service_type: "Residential",
      location: "Galax, VA",
      frequency: "One-time",
      property_size: "1500 sq ft",
      preferred_timing: "Flexible",
      details: "Synthetic local admin integration fixture.",
    };
    const quoteResult = await privileged
      .from("quote_requests")
      .insert(quote)
      .select("id")
      .single();
    assert.ok(
      !quoteResult.error,
      "Local quote fixture saved through unchanged insert contract",
    );
    records.quotes = quoteResult.data.id;
    const checked = employment.validateApplication({
      answers,
      employers: [],
      references,
      accepted: true,
      acknowledgment: answers.full_name,
    });
    assert.equal(
      Object.keys(checked.errors).length,
      0,
      JSON.stringify(checked.errors),
    );
    const payload = employment.applicationPayload(checked.draft);
    const submissionId = randomUUID(),
      digest = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      bucket = createHash("sha256")
        .update("synthetic-admin-" + tag)
        .digest("hex");
    const application = await privileged.rpc("submit_employment_application", {
      p_submission_id: submissionId,
      p_payload: payload,
      p_digest: digest,
      p_bucket: bucket,
    });
    assert.ok(
      !application.error,
      "Local application fixture saved through unchanged RPC",
    );
    records.applications = application.data;
    const isolatedSigningSecret = randomBytes(32).toString("hex");
    privilegedSecrets.push(isolatedSigningSecret);
    if (process.env.ADMIN_TEST_DEV === "1") {
      // Reuse the owner's running local dev server without restarting it or
      // competing for its .next/dev lock. Local .env targeting is checked above.
      base = "http://127.0.0.1:3000";
      assert.ok((await fetch(base + "/admin/login")).ok, "Local dev server is available");
    } else {
      server = spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "start",
          "-p",
          "0",
          "-H",
          "127.0.0.1",
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            ...env,
            EMPLOYMENT_APPLICATION_SECRET: isolatedSigningSecret,
            NODE_ENV: "production",
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      server.stdout.on("data", (d) => (serverLog += d));
      server.stderr.on("data", (d) => (serverLog += d));
      for (let i = 0; i < 200; i++) {
        const match = serverLog.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) {
          base = `http://127.0.0.1:${match[1]}`;
          try {
            if ((await fetch(base + "/admin/login")).ok) break;
          } catch {}
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(base, "Local production server started");
    }
    browser = await chromium.launch({
      headless: true,
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--no-sandbox"],
    });
  },
  { timeout: 120000 },
);
after(
  async () => {
    if (!enabled) return;
    await browser?.close();
    server?.kill("SIGTERM");
  },
  { timeout: 15000 },
);
run(
  "RLS is enabled on every staff table and existing public grants are preserved",
  async () => {
    const count = sql(
      "select to_json(count(*)) from pg_class where relnamespace='public'::regnamespace and relname in ('staff_roles','staff_permissions','staff_role_permissions','staff_memberships','quote_workflows','application_workflows','staff_notes','staff_audit_events') and relrowsecurity",
    );
    assert.equal(count, 8);
    const grant = sql(
      "select json_build_object('quote_insert',has_table_privilege('service_role','public.quote_requests','INSERT'),'quote_id',has_column_privilege('service_role','public.quote_requests','id','SELECT'),'application_insert',has_table_privilege('service_role','public.employment_applications','INSERT'),'submit',has_function_privilege('service_role','public.submit_employment_application(uuid,jsonb,text,text)','EXECUTE'))",
    );
    assert.deepEqual(grant, {
      quote_insert: true,
      quote_id: true,
      application_insert: false,
      submit: true,
    });
  },
);
run(
  "anonymous/customer/employee/suspended direct API and mutations are denied",
  async () => {
    for (const client of [
      newClient(),
      clients.customer,
      clients.employee,
      clients.suspended,
    ]) {
      for (const kind of ["quotes", "applications"]) {
        const read = await client
          .from(kind === "quotes" ? "admin_quotes" : "admin_applications")
          .select("id");
        assert.ok(
          read.error || read.data.length === 0,
          "Unauthorized read returns no data",
        );
        assert.ok(
          (await client.rpc("admin_list_records", { record_kind: kind })).error,
        );
        assert.ok(
          (
            await client.rpc("admin_set_status", {
              record_kind: kind,
              record_id: records[kind],
              next_status: kind === "quotes" ? "contacted" : "reviewing",
            })
          ).error,
        );
        assert.ok(
          (
            await client.rpc("admin_add_note", {
              record_kind: kind,
              record_id: records[kind],
              note_body: "Unauthorized synthetic note",
            })
          ).error,
        );
      }
      assert.ok((await client.rpc("admin_dashboard")).error);
    }
  },
);
run(
  "administrator and manager MFA sessions read and manage both workflows with genuine audit actors",
  async () => {
    for (const [role, client] of [
      ["administrator", clients.administrator],
      ["manager", clients.manager],
    ]) {
      assert.equal(
        (await client.auth.mfa.getAuthenticatorAssuranceLevel()).data
          .currentLevel,
        "aal2",
      );
      assert.ok(!(await client.rpc("admin_dashboard")).error);
      for (const kind of ["quotes", "applications"]) {
        const listing = await client.rpc("admin_list_records", {
          record_kind: kind,
          search_text: "Synthetic Admin QA",
          status_filter: "",
          oldest_first: false,
          page_number: 1,
        });
        assert.ok(!listing.error && listing.data.rows.length > 0);
        const next =
          kind === "quotes"
            ? role === "administrator"
              ? "contacted"
              : "quote_in_progress"
            : role === "administrator"
              ? "reviewing"
              : "interview";
        assert.ok(
          !(
            await client.rpc("admin_set_status", {
              record_kind: kind,
              record_id: records[kind],
              next_status: next,
            })
          ).error,
        );
        assert.ok(
          !(
            await client.rpc("admin_add_note", {
              record_kind: kind,
              record_id: records[kind],
              note_body: "Synthetic local staff note.",
            })
          ).error,
        );
        const filtered = await client.rpc("admin_list_records", {
          record_kind: kind,
          search_text: "Synthetic Admin QA",
          status_filter: next,
          oldest_first: true,
          page_number: 1,
        });
        assert.ok(
          !filtered.error &&
            filtered.data.rows.some((row) => row.id === records[kind]),
          "Status filter includes the changed fixture",
        );
        assert.ok(
          filtered.data.rows.every((row) => row.workflow_status === next),
        );
        assert.ok(
          filtered.data.rows.every(
            (row, index, rows) =>
              index === 0 || rows[index - 1].submitted_at <= row.submitted_at,
          ),
          "Oldest-first dates are ordered",
        );
        const pageTwo = await client.rpc("admin_list_records", {
          record_kind: kind,
          page_number: 2,
        });
        assert.ok(
          !pageTwo.error && pageTwo.data.rows.length <= 20,
          "Pagination is bounded",
        );
        const literal = await client.rpc("admin_list_records", {
          record_kind: kind,
          search_text: "name.ilike.*,email.ilike.*",
        });
        assert.ok(
          !literal.error && literal.data.total === 0,
          "Search is literal, not a REST expression",
        );
        const column = kind === "quotes" ? "quote_id" : "application_id";
        const audit = await client
          .from("staff_audit_events")
          .select("actor_id,action,new_status")
          .eq(column, records[kind]);
        assert.ok(
          !audit.error &&
            audit.data.some(
              (a) =>
                a.actor_id === users[role].id &&
                a.action === "status_changed" &&
                a.new_status === next,
            ),
        );
        const count = audit.data.length;
        assert.ok(
          !(
            await client.rpc("admin_set_status", {
              record_kind: kind,
              record_id: records[kind],
              next_status: next,
            })
          ).error,
        );
        const repeated = await client
          .from("staff_audit_events")
          .select("id")
          .eq(column, records[kind]);
        assert.equal(
          repeated.data.length,
          count,
          "Same status is an idempotent no-op",
        );
        assert.ok(
          (
            await client.rpc("admin_set_status", {
              record_kind: kind,
              record_id: records[kind],
              next_status: "invented",
            })
          ).error,
        );
      }
    }
  },
);
run(
  "direct writes, audit forgery, membership escalation and original submission changes are denied",
  async () => {
    const client = clients.administrator;
    for (const table of [
      "staff_memberships",
      "staff_role_permissions",
      "quote_workflows",
      "application_workflows",
      "staff_notes",
      "staff_audit_events",
    ])
      assert.ok(
        (await client.from(table).insert({ id: randomUUID() })).error,
        "No direct table write grant",
      );
    assert.ok(
      (
        await client
          .from("quote_requests")
          .update({ name: "Overwrite" })
          .eq("id", records.quotes)
      ).error,
    );
    assert.ok(
      (
        await client
          .from("employment_applications")
          .update({ status: "hired" })
          .eq("id", records.applications)
      ).error,
    );
    assert.ok(
      (await client.from("quote_requests").delete().eq("id", records.quotes))
        .error,
    );
    assert.ok(
      (
        await client
          .from("employment_applications")
          .delete()
          .eq("id", records.applications)
      ).error,
    );
    assert.ok(
      (
        await client.rpc("admin_add_note", {
          record_kind: "quotes",
          record_id: records.quotes,
          note_body: "Forgery",
          actor_id: users.customer.id,
        })
      ).error,
    );
    const app = await client
      .from("admin_applications")
      .select("*")
      .eq("id", records.applications)
      .single();
    assert.ok(!app.error);
    assert.equal("submission_id" in app.data, false);
    assert.equal("payload_digest" in app.data, false);
  },
);
run(
  "live membership/permission changes immediately revoke existing MFA sessions",
  async () => {
    const client = clients.manager;
    sql(
      `with changed as (update public.staff_memberships set status='suspended' where user_id='${users.manager.id}' returning user_id) select to_json(count(*)) from changed`,
    );
    assert.ok((await client.rpc("admin_dashboard")).error);
    assert.ok(
      (await client.from("admin_quotes").select("id")).data.length === 0,
    );
    sql(
      `with changed as (update public.staff_memberships set status='active' where user_id='${users.manager.id}' returning user_id) select to_json(count(*)) from changed`,
    );
    sql(
      "with changed as (delete from public.staff_role_permissions where role='manager' and permission='quotes.manage' returning role) select to_json(count(*)) from changed",
    );
    try {
      assert.ok(
        (
          await client.rpc("admin_set_status", {
            record_kind: "quotes",
            record_id: records.quotes,
            next_status: "won",
          })
        ).error,
      );
    } finally {
      sql(
        "with restored as (insert into public.staff_role_permissions values('manager','quotes.manage') returning role) select to_json(count(*)) from restored",
      );
    }
    assert.ok(!(await client.rpc("admin_dashboard")).error);
  },
);
async function signIn(page, role, withMfa = true) {
  await page.goto(base + "/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(users[role].email);
  await page.getByLabel("Password", { exact: true }).fill(users[role].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (["administrator", "manager", "unenrolled"].includes(role)) {
    await page.waitForURL("**/admin/mfa");
    if (withMfa) {
      await page.getByLabel("Six-digit code").fill(totp(users[role].secret));
      await page.getByRole("button", { name: "Verify and continue" }).click();
      await page.waitForURL(base + "/admin");
    }
  } else await page.getByRole("alert").waitFor();
}
run("browser admin authentication is isolated from another local app's root cookie", async () => {
  const context = await newContext();
  const { data } = await clients.customer.auth.getSession();
  assert.ok(data.session);
  const legacyName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const legacyValue =
    "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  await context.addCookies([
    {
      name: legacyName,
      value: legacyValue,
      domain: new URL(base).hostname,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await signIn(page, "administrator");
  await page.reload();
  assert.equal(page.url(), base + "/admin");
  await page.goto(base + "/admin/quotes");
  assert.equal(page.url(), base + "/admin/quotes");
  await page.goto(base + "/admin/applications");
  assert.equal(page.url(), base + "/admin/applications");
  const adminCookies = (await context.cookies()).filter((c) =>
    c.name.startsWith("sb-jb-squeaky-admin-auth"),
  );
  assert.ok(adminCookies.length > 0);
  assert.ok(
    adminCookies.every(
      (c) => c.path === "/admin" && c.httpOnly && c.sameSite === "Lax",
    ),
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/admin/login");
  await page.goto(base + "/admin");
  assert.ok(page.url().includes("/admin/login"));
  assert.ok(
    (await context.cookies()).some(
      (c) => c.name === legacyName && c.value === legacyValue,
    ),
  );
  await context.close();
});
run(
  "browser direct routes, customer/employee/suspended login, AAL1 and sign-out are protected",
  async () => {
    const context = await newContext();
    const page = await context.newPage();
    for (const route of [
      "/admin",
      "/admin/quotes",
      "/admin/applications",
      `/admin/quotes/${records.quotes}`,
      `/admin/applications/${records.applications}`,
    ]) {
      await page.goto(base + route);
      assert.ok(page.url().includes("/admin/login"));
    }
    for (const role of ["customer", "employee", "suspended"])
      await signIn(page, role);
    await signIn(page, "manager", false);
    await page.goto(base + "/admin/quotes");
    assert.ok(page.url().includes("/admin/mfa"));
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/admin/login");
    await context.close();
  },
);
run(
  "browser staff workflows, all eight readonly sections, safe cookies and responsive keyboard navigation",
  async () => {
    const context = await newContext();
    const page = await context.newPage();
    await signIn(page, "administrator");
    const cookies = await context.cookies();
    assert.ok(
      cookies
        .filter((c) => c.name.startsWith("sb-"))
        .every(
          (c) => c.httpOnly && c.sameSite === "Lax" && c.path === "/admin",
        ),
    );
    for (const kind of ["quotes", "applications"]) {
      await page.goto(`${base}/admin/${kind}/${records[kind]}`);
      assert.ok(
        await page
          .getByRole("heading", {
            name: kind === "quotes" ? "Quote request" : "Personal information",
            exact: true,
          })
          .isVisible(),
      );
      if (kind === "applications")
        for (const step of employment.applicationSteps)
          assert.ok(
            await page
              .getByRole("heading", { name: step.title, exact: true })
              .isVisible(),
          );
      await page
        .getByLabel("Status", { exact: true })
        .selectOption(kind === "quotes" ? "quote_sent" : "offered");
      await page
        .getByRole("button", { name: "Save status", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Status saved." })
        .waitFor();
      await page
        .getByLabel("Note", { exact: true })
        .fill("Synthetic browser staff note.");
      await page.getByRole("button", { name: "Add note", exact: true }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "Note saved." })
        .waitFor();
    }
    for (const width of [320, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/admin",
        "/admin/quotes",
        "/admin/applications",
        `/admin/applications/${records.applications}`,
      ]) {
        await page.goto(base + route);
        if (route === "/admin" && [390, 1440].includes(width))
          await page.screenshot({
            path: `/tmp/jb-admin-dashboard-${width}.png`,
            fullPage: true,
          });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "No horizontal overflow",
        );
      }
      if (width <= 900) {
        await page.getByRole("button", { name: "Menu", exact: true }).click();
        assert.ok(
          await page
            .getByRole("link", { name: "Quote Requests", exact: true })
            .isVisible(),
        );
        await page.keyboard.press("Escape");
        assert.equal(
          await page
            .getByRole("button", { name: "Menu", exact: true })
            .getAttribute("aria-expanded"),
          "false",
        );
        assert.equal(
          await page.evaluate(() => document.activeElement?.textContent),
          "Menu",
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 320 });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Sign out", exact: true })
      .scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/admin/login");
    await page.goto(base + "/admin");
    assert.ok(page.url().includes("/admin/login"));
    await context.close();
  },
);
run("existing submissions remain byte-for-byte unchanged", () => {
  const after = fingerprints();
  for (const kind of ["quotes", "applications"])
    for (const [id, hash] of Object.entries(baseline[kind]))
      assert.equal(after[kind][id], hash, "Existing original row preserved");
  const originalStatus = sql(
    `select to_json(status) from public.employment_applications where id='${records.applications}'`,
  );
  assert.equal(
    originalStatus,
    "new",
    "Staff workflow did not change original application status",
  );
});
run(
  "public quote and eight-step employment forms save exactly one new local record each",
  async () => {
    const before = fingerprints(),
      context = await newContext(),
      page = await context.newPage();
    await page.goto(base + "/request-a-quote");
    for (const [id, value] of Object.entries({
      name: "Synthetic Public Admin Regression",
      phone: "2765550199",
      email: "synthetic-public-admin@example.com",
      location: "Richmond, VA",
      property_size: "1000 sq ft",
      preferred_timing: "Synthetic test",
      details: "Synthetic local public regression only.",
    }))
      await page.locator("#" + id).fill(value);
    await page.locator("#service_type").selectOption("Commercial");
    await page.locator("#frequency").selectOption("One-time");
    await page.getByRole("button", { name: "Send Quote Request" }).click();
    await page
      .getByRole("heading", { name: "Request received.", exact: true })
      .waitFor();
    const afterQuote = fingerprints();
    assert.equal(
      Object.keys(afterQuote.quotes).length,
      Object.keys(before.quotes).length + 1,
    );
    await page.goto(base + "/careers");
    await page.locator(".employment-form").waitFor();
    const control = (id) => page.locator(`[id="application-${id}"]`);
    async function fillFields(fields, values, prefix = "") {
      for (const field of fields) {
        const value = values[field.id] ?? "";
        if (field.type === "checks") {
          for (const option of field.options)
            await page
              .getByLabel(option, { exact: true })
              .setChecked(value.includes(option));
        } else if (field.type === "select")
          await control(prefix + field.id).selectOption(value);
        else await control(prefix + field.id).fill(value);
      }
    }
    for (let i = 0; i < 7; i++) {
      await fillFields(employment.applicationSteps[i].fields, answers);
      if (i === 6)
        for (let j = 0; j < 2; j++)
          await fillFields(
            employment.referenceFields,
            references[j],
            `references.${j}.`,
          );
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await control("accepted").check();
    await control("acknowledgment").fill(answers.full_name);
    await page.waitForTimeout(2100);
    await page
      .getByRole("button", { name: "Submit Application", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Application received.", exact: true })
      .waitFor();
    const afterApplication = fingerprints();
    assert.equal(
      Object.keys(afterApplication.applications).length,
      Object.keys(before.applications).length + 1,
    );
    await context.close();
  },
);
run(
  "browser first-use MFA enrollment and fresh staff revocation work",
  async () => {
    const context = await newContext(),
      page = await context.newPage();
    await signIn(page, "unenrolled", false);
    await page
      .getByRole("button", { name: "Set up authenticator", exact: true })
      .click();
    await page
      .getByRole("img", { name: "Authenticator enrollment QR code" })
      .waitFor();
    const secret = await page.locator(".admin-mfa-qr code").textContent();
    assert.ok(
      secret && secret.length > 10,
      "Enrollment key is present only for the signed-in staff user",
    );
    await page.getByLabel("Six-digit code").fill(totp(secret));
    await page
      .getByRole("button", { name: "Verify and continue", exact: true })
      .click();
    await page.waitForURL(base + "/admin");
    sql(
      `with changed as (update public.staff_memberships set status='suspended' where user_id='${users.unenrolled.id}' returning user_id) select to_json(count(*)) from changed`,
    );
    await page.goto(base + "/admin/applications");
    assert.ok(
      page.url().includes("/admin/login?reason=access"),
      "Fresh server membership denies a previously authorized browser",
    );
    await context.close();
  },
);
run(
  "all direct write grants are absent; sessions without MFA cannot read or mutate",
  async () => {
    const denied = sql(
      "select to_json(bool_and(not has_table_privilege('authenticated','public.'||t,p))) from unnest(array['staff_memberships','staff_roles','staff_permissions','staff_role_permissions','quote_workflows','application_workflows','staff_notes','staff_audit_events','quote_requests','employment_applications']) t cross join unnest(array['INSERT','UPDATE','DELETE']) p",
    );
    assert.equal(denied, true);
    const aal1 = newClient();
    await aal1.auth.signInWithPassword({
      email: users.administrator.email,
      password: users.administrator.password,
    });
    assert.equal(
      (await aal1.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,
      "aal1",
    );
    assert.ok((await aal1.rpc("admin_dashboard")).error);
    assert.equal((await aal1.from("admin_quotes").select("id")).data.length, 0);
    assert.ok(
      (
        await aal1.rpc("admin_set_status", {
          record_kind: "quotes",
          record_id: records.quotes,
          next_status: "won",
        })
      ).error,
    );
    assert.ok(
      (
        await aal1.rpc("admin_add_note", {
          record_kind: "applications",
          record_id: records.applications,
          note_body: "Denied AAL1 note",
        })
      ).error,
    );
  },
);
run(
  "privileged keys and applicant details are absent from browser assets and server logs",
  async () => {
    for (const secret of privilegedSecrets)
      assert.equal(
        serverLog.includes(secret),
        false,
        "No privileged secret in server logs",
      );
    for (const role of Object.values(users)) {
      assert.equal(
        serverLog.includes(role.password),
        false,
        "No password in logs",
      );
      assert.equal(
        serverLog.includes(role.email),
        false,
        "No staff email in logs",
      );
    }
    assert.equal(
      serverLog.includes(answers.full_name),
      false,
      "No applicant name in logs",
    );
    assert.equal(
      serverLog.includes(answers.email),
      false,
      "No applicant email in logs",
    );
    const dir = path.join(root, ".next/static/chunks");
    for (const file of fs
      .readdirSync(dir, { recursive: true })
      .filter((f) => f.endsWith(".js"))) {
      const body = fs.readFileSync(path.join(dir, file), "utf8");
      for (const secret of privilegedSecrets)
        assert.equal(
          body.includes(secret),
          false,
          "No privileged credential in client JavaScript",
        );
    }
    const anonymous = await fetch(base + "/admin/quotes", {
      redirect: "manual",
    });
    assert.ok([303, 307, 308].includes(anonymous.status));
    assert.ok(anonymous.headers.get("cache-control")?.includes("no-store"));
    assert.ok(anonymous.headers.get("x-robots-tag")?.includes("noindex"));
  },
);
run(
  "local invitation redemption requires membership and allows password setup before MFA",
  async () => {
    const result = await privileged.auth.admin.generateLink({
      type: "invite",
      email: `synthetic-invited-${randomUUID().slice(0, 8)}@example.com`,
    });
    assert.ok(
      !result.error && result.data.user,
      "Local-only invitation generated without sending email",
    );
    const id = result.data.user.id,
      tokenHash = result.data.properties.hashed_token;
    sql(
      `with inserted as (insert into public.staff_memberships(user_id,role,status) values('${id}','administrator','active') returning user_id) select to_json(count(*)) from inserted`,
    );
    const context = await newContext(),
      page = await context.newPage();
    try {
      await page.goto(
        `${base}/admin/auth/confirm?${new URLSearchParams({ token_hash: tokenHash, type: "invite" })}`,
      );
    } catch {
      throw new Error("Local invitation callback failed");
    }
    assert.equal(
      new URL(page.url()).pathname,
      "/admin/setup",
      "Verified local invite must reach password setup",
    );
    assert.ok(
      await page
        .getByRole("heading", { name: "Set your staff password" })
        .isVisible(),
    );
    const password = randomBytes(24).toString("base64url");
    await page.getByLabel("New password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Save password", exact: true })
      .click();
    await page.waitForURL("**/admin/mfa");
    assert.equal(
      new URL(page.url()).origin,
      base,
      "Invite redirects preserve the cookie origin",
    );
    await page.goto(base + "/admin/quotes");
    assert.ok(
      page.url().endsWith("/admin/mfa"),
      "Invited staff has no data access before MFA",
    );
    await context.close();
    const invalidContext = await newContext(),
      invalidPage = await invalidContext.newPage();
    await invalidPage.goto(
      base + "/admin/auth/confirm?token_hash=invalid&type=invite",
    );
    assert.ok(invalidPage.url().includes("reason=invite"));
    await invalidContext.close();
  },
);
