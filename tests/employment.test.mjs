import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, overrides = {}) {
  const filename = path.join(root, relative);
  const m = new Module(filename);
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
const schema = load("lib/employment.ts");
const valid = () => ({
  answers: {
    full_name: "Test Applicant",
    address: "123 Test Street",
    city: "Galax",
    state: "VA",
    zip: "24333",
    phone: "2765550100",
    email: "test@example.com",
    position: "Cleaning",
    available_date: "2026-11-01",
    employment_preference: ["Part-time"],
    work_authorization: "Yes",
    sponsorship: "No",
    days: ["Monday"],
    earliest_time: "08:00",
    latest_time: "17:00",
    weekends: "No",
    evenings: "No",
    overtime: "No",
    years_experience: "0",
    valid_license: "Yes",
    transportation: "Yes",
    driving_duties: "No",
  },
  employers: [],
  references: [
    {
      name: "Test Reference One",
      relationship: "Colleague",
      phone: "2765550101",
    },
    {
      name: "Test Reference Two",
      relationship: "Colleague",
      phone: "2765550102",
    },
  ],
  accepted: true,
  acknowledgment: "Test Applicant",
});

test("valid application allows first-time workers and strips unknown sensitive/workflow fields", () => {
  const input = valid();
  input.status = "hired";
  input.answers.license_number = "must not persist";
  const result = schema.validateApplication(input);
  assert.deepEqual(result.errors, {});
  const payload = schema.applicationPayload(result.draft);
  assert.equal(payload.status, undefined);
  assert.equal(payload.applicant.license_number, undefined);
  assert.equal(payload.certification.text, schema.certificationText);
  assert.equal(payload.certification.version, schema.certificationVersion);
});
test("required fields, email, phone, ZIP, calendar date, enum and certification are validated", () => {
  const input = valid();
  Object.assign(input.answers, {
    full_name: "",
    email: "invalid",
    phone: "123",
    zip: "bad",
    available_date: "2026-02-30",
    sponsorship: "Maybe",
  });
  input.accepted = false;
  input.acknowledgment = "Other";
  const { errors } = schema.validateApplication(input);
  for (const key of [
    "full_name",
    "email",
    "phone",
    "zip",
    "available_date",
    "sponsorship",
    "accepted",
    "acknowledgment",
  ])
    assert.ok(errors[key], key);
});
test("step validation does not reject incomplete later steps", () => {
  const input = valid();
  input.accepted = false;
  input.references = [{}, {}];
  assert.deepEqual(schema.validateApplication(input, 0).errors, {});
  assert.ok(schema.validateApplication(input, 6).errors["references.0.name"]);
});
test("employment history is capped, dates ordered and reference details bounded", () => {
  const input = valid();
  input.employers = Array.from({ length: 4 }, () => ({}));
  assert.ok(schema.validateApplication(input).errors.employers);
  input.employers = [
    {
      name: "Test employer",
      position: "Cleaner",
      from: "2026-02",
      to: "2025-01",
    },
  ];
  assert.ok(schema.validateApplication(input).errors["employers.0.to"]);
  input.references[0].email = "bad";
  assert.ok(schema.validateApplication(input).errors["references.0.email"]);
  input.employers[0].to = "Present";
  assert.equal(
    schema.validateApplication(input).errors["employers.0.to"],
    undefined,
  );
});
test("pay pairing, other experience, body lengths and invalid checkbox values are checked", () => {
  const input = valid();
  Object.assign(input.answers, {
    desired_pay: "20",
    experience_categories: ["Other"],
    skills: "a".repeat(3001),
    days: ["Not a day"],
  });
  const { errors } = schema.validateApplication(input);
  for (const key of ["pay_period", "other_experience", "skills", "days"])
    assert.ok(errors[key], key);
});
test("malformed input and non-string field values fail safely", () => {
  assert.ok(Object.keys(schema.validateApplication(null).errors).length);
  const input = valid();
  input.answers.phone = 123;
  input.references = null;
  assert.ok(schema.validateApplication(input).errors.phone);
  assert.ok(schema.validateApplication(input).errors.references);
});

test("storage gating, signed token expiry, confirmation and error handling", async () => {
  const backup = { ...process.env };
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  try {
    process.env.SUPABASE_URL = "http://127.0.0.1:34999";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
    process.env.EMPLOYMENT_APPLICATION_SECRET =
      "test-only-secret-that-is-not-a-real-credential";
    process.env.EMPLOYMENT_APPLICATIONS_ENABLED = "false";
    process.env.VERCEL = "";
    const storage = load("lib/employment-storage.ts", {
      "server-only": {},
      "next/headers": { headers: async () => new Headers() },
      "./employment": schema,
    });
    global.fetch = async () => {
      throw Error("Unexpected network call");
    };
    assert.equal(await storage.applicationAvailable(), false);
    process.env.EMPLOYMENT_APPLICATIONS_ENABLED = "true";
    global.fetch = async () => new Response("0", { status: 200 });
    assert.equal(await storage.applicationAvailable(), false);
    global.fetch = async () => new Response("1", { status: 200 });
    assert.equal(await storage.applicationAvailable(), true);
    const token = storage.createApplicationToken();
    assert.equal(storage.verifyApplicationToken(token), null);
    Date.now = () => originalNow() + 3000;
    const id = storage.verifyApplicationToken(token);
    assert.ok(id);
    assert.equal(storage.verifyApplicationToken(token + "tampered"), null);
    Date.now = () => originalNow() + 25 * 60 * 60 * 1000;
    assert.equal(storage.verifyApplicationToken(token), null);
    Date.now = originalNow;
    let body;
    global.fetch = async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(
        JSON.stringify("11111111-1111-4111-8111-111111111111"),
        { status: 200 },
      );
    };
    const result = await storage.saveApplication(
      schema.validateApplication(valid()).draft,
      id,
    );
    assert.equal(result, "11111111-1111-4111-8111-111111111111");
    assert.equal(body.p_payload.status, undefined);
    assert.match(body.p_bucket, /^[a-f0-9]{64}$/);
    global.fetch = async () => new Response("null", { status: 200 });
    await assert.rejects(() =>
      storage.saveApplication(schema.validateApplication(valid()).draft, id),
    );
    global.fetch = async () => new Response("{}", { status: 503 });
    await assert.rejects(() =>
      storage.saveApplication(schema.validateApplication(valid()).draft, id),
    );
  } finally {
    global.fetch = originalFetch;
    Date.now = originalNow;
    for (const key of Object.keys(process.env))
      if (!(key in backup)) delete process.env[key];
    Object.assign(process.env, backup);
  }
});

test("Server Action refuses unavailable, honeypot and invalid data; never reports failures as saved", async () => {
  const storage = {
    applicationAvailable: async () => false,
    verifyApplicationToken: () => "11111111-1111-4111-8111-111111111111",
    saveApplication: async () => {
      throw Error("not called");
    },
  };
  const action = load("app/careers/actions.ts", {
    "@/lib/employment": schema,
    "@/lib/employment-storage": storage,
  }).submitApplication;
  const form = new FormData();
  form.set("application_token", "test");
  form.set("application", JSON.stringify(valid()));
  assert.equal((await action({}, form)).status, "error");
  storage.applicationAvailable = async () => true;
  form.set("website", "bot");
  assert.equal((await action({}, form)).status, "error");
  form.delete("website");
  form.set("application", "{}");
  assert.ok((await action({}, form)).errors.full_name);
  form.set("application", JSON.stringify(valid()));
  assert.equal((await action({}, form)).status, "error");
  storage.saveApplication = async () => "11111111-1111-4111-8111-111111111111";
  assert.equal((await action({}, form)).status, "success");
});

test("future employment starts fail client-step and full server validation; past/current starts with Present remain valid", () => {
  const input = valid();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const futureMonth = `${new Date().getUTCFullYear() + 1}-01`;
  input.employers = [
    {
      name: "Synthetic employer",
      position: "Cleaner",
      from: futureMonth,
      to: "Present",
    },
  ];
  for (const step of [3, undefined])
    assert.match(
      schema.validateApplication(input, step).errors["employers.0.from"],
      /future/,
    );
  for (const from of ["2020-01", currentMonth]) {
    input.employers[0].from = from;
    for (const step of [3, undefined])
      assert.deepEqual(schema.validateApplication(input, step).errors, {});
  }
});

test("equal availability times fail; daytime and overnight windows preserve existing fields", () => {
  const input = valid();
  input.answers.earliest_time = "17:00";
  input.answers.latest_time = "17:00";
  for (const step of [1, undefined])
    assert.match(
      schema.validateApplication(input, step).errors.latest_time,
      /different latest time/,
    );
  input.answers.latest_time = "08:00";
  assert.deepEqual(schema.validateApplication(input).errors, {});
  assert.equal(schema.isOvernightAvailability(input.answers), true);
  const payload = schema.applicationPayload(
    schema.validateApplication(input).draft,
  );
  assert.equal(payload.availability.earliest_time, "17:00");
  assert.equal(payload.availability.latest_time, "08:00");
  assert.equal(payload.availability.overnight, undefined);
  input.answers.earliest_time = "08:00";
  input.answers.latest_time = "17:00";
  assert.equal(schema.isOvernightAvailability(input.answers), false);
  assert.deepEqual(schema.validateApplication(input).errors, {});
});

test("transport rejection becomes recoverable state; retry keeps the original signed token and data", async () => {
  const { recoverableEmploymentSubmission } = load(
    "lib/employment-submission.ts",
  );
  let fail = true;
  const requests = [];
  const action = recoverableEmploymentSubmission(async (_state, data) => {
    requests.push([data.get("application_token"), data.get("application")]);
    if (fail) throw new TypeError("Failed to fetch");
    return {
      status: "success",
      message: "Saved",
      applicationId: "11111111-1111-4111-8111-111111111111",
    };
  });
  const form = new FormData();
  form.set("application_token", "synthetic-signed-token");
  form.set("application", JSON.stringify(valid()));
  const error = await action({ status: "idle", message: "" }, form);
  assert.equal(error.status, "error");
  assert.match(error.message, /entries are still here/);
  assert.equal(error.applicationId, undefined);
  fail = false;
  const saved = await action(error, form);
  assert.equal(saved.status, "success");
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(await action(saved, form), saved);
  assert.equal(requests.length, 2);
});

test("lost confirmation retry can return an already-saved ID without another insert", async () => {
  const { recoverableEmploymentSubmission } = load(
    "lib/employment-submission.ts",
  );
  const rows = new Map();
  let dropResponse = true;
  const action = recoverableEmploymentSubmission(async (_state, form) => {
    const token = form.get("application_token");
    if (!rows.has(token))
      rows.set(token, "11111111-1111-4111-8111-111111111111");
    if (dropResponse) {
      dropResponse = false;
      throw new TypeError("Lost response");
    }
    return {
      status: "success",
      message: "Saved",
      applicationId: rows.get(token),
    };
  });
  const form = new FormData();
  form.set("application_token", "synthetic-signed-token");
  const unconfirmed = await action({ status: "idle", message: "" }, form);
  assert.equal(unconfirmed.status, "error");
  assert.equal(rows.size, 1);
  const confirmed = await action(unconfirmed, form);
  assert.equal(confirmed.applicationId, rows.get("synthetic-signed-token"));
  assert.equal(rows.size, 1);
});

const deviceDraft = load("lib/employment-draft.ts", { "./employment": schema });
const savedRecord = (now = Date.now()) => ({
  version: 1,
  createdAt: now - 1000,
  savedAt: now,
  step: 6,
  submissionUnconfirmed: false,
  draft: {
    ...valid(),
    employers: [
      { name: "Synthetic one", from: "2020-01", to: "Present" },
      { name: "Synthetic two", from: "2018-01", to: "2019-01" },
    ],
  },
});
test("device drafts preserve partial applicant sections, rows, optional answers and step", () => {
  const record = savedRecord();
  const restored = deviceDraft.decodeEmploymentDraft(JSON.stringify(record));
  assert.deepEqual(restored, record);
  assert.ok(deviceDraft.applicantDraft(schema.emptyApplication()));
});
test("seven-day expiration is anchored to first save and rejects invalid metadata", () => {
  const now = Date.now(),
    record = savedRecord(now);
  record.createdAt = now - deviceDraft.draftLifetime;
  assert.equal(
    deviceDraft.decodeEmploymentDraft(JSON.stringify(record), now),
    null,
  );
  record.createdAt += 1;
  assert.ok(deviceDraft.decodeEmploymentDraft(JSON.stringify(record), now));
  for (const patch of [
    { version: 2 },
    { step: 8 },
    { createdAt: now + 1 },
    { savedAt: 0 },
    { draft: {} },
    { submissionUnconfirmed: "false" },
  ])
    assert.equal(
      deviceDraft.decodeEmploymentDraft(
        JSON.stringify({ ...record, ...patch }),
        now,
      ),
      null,
    );
  assert.equal(deviceDraft.decodeEmploymentDraft("{broken"), null);
});
test("draft allowlist excludes unknown sensitive fields, secrets, credentials and signed tokens", () => {
  const record = savedRecord();
  record.token = "signed-token-must-not-be-saved";
  record.draft.answers.license_number = "private-license";
  record.draft.answers.criminal_history = "private-screening";
  record.draft.employers[0].secret = "secret";
  let raw;
  assert.ok(
    deviceDraft.writeEmploymentDraft(
      {
        setItem: (key, value) => {
          assert.equal(key, deviceDraft.employmentDraftKey);
          raw = value;
        },
      },
      record,
    ),
  );
  for (const forbidden of [
    "signed-token",
    "private-license",
    "private-screening",
    '"secret"',
  ])
    assert.ok(!raw.includes(forbidden));
  const restored = deviceDraft.decodeEmploymentDraft(raw);
  assert.equal(
    restored.draft.answers.full_name,
    record.draft.answers.full_name,
  );
});
test("unavailable and quota-limited storage fail defensively; empty drafts need no persistence", () => {
  for (const name of ["SecurityError", "QuotaExceededError"]) {
    const fail = () => {
      throw Object.assign(new Error("Synthetic storage error"), { name });
    };
    assert.equal(
      deviceDraft.writeEmploymentDraft({ setItem: fail }, savedRecord()),
      false,
    );
    assert.equal(
      deviceDraft.removeEmploymentDraft({ removeItem: fail }),
      false,
    );
  }
  assert.equal(
    deviceDraft.hasApplicationProgress(schema.emptyApplication(), 0),
    false,
  );
  assert.equal(
    deviceDraft.hasApplicationProgress(schema.emptyApplication(), 1),
    true,
  );
});
