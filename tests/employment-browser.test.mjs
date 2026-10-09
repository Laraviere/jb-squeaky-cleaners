import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaModule = new Module(path.join(root, "lib/employment.ts"));
schemaModule._compile(
  ts.transpileModule(fs.readFileSync(schemaModule.id, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText,
  schemaModule.id,
);
const schema = schemaModule.exports;
const answers = {
  full_name: "Synthetic Regression Applicant",
  address: "100 Synthetic Lane",
  city: "Galax",
  state: "VA",
  zip: "24333",
  phone: "2765550144",
  email: "employment-regression@example.com",
  position: "Synthetic cleaning applicant",
  available_date: "2026-11-01",
  desired_pay: "20",
  pay_period: "Hour",
  employment_preference: ["Part-time"],
  work_authorization: "Yes",
  sponsorship: "No",
  days: ["Monday"],
  earliest_time: "17:00",
  latest_time: "08:00",
  weekends: "Yes",
  evenings: "Yes",
  overtime: "No",
  high_school: "Synthetic School",
  graduated: "Yes",
  college: "Synthetic College",
  degree: "Synthetic certificate",
  training: "Synthetic training",
  experience_categories: ["Residential Cleaning", "Other"],
  other_experience: "Synthetic additional experience",
  years_experience: "1",
  skills: "Synthetic skills " + "LongUnbrokenValue".repeat(12),
  valid_license: "Yes",
  transportation: "Yes",
  driving_duties: "No",
};
const employer = {
  name: "Synthetic employer",
  address: "200 Synthetic Lane",
  phone: "2765550143",
  supervisor: "Synthetic supervisor",
  position: "Cleaner",
  from: "2020-01",
  to: "Present",
  reason: "Synthetic test",
};
const references = [0, 1].map((i) => ({
  name: `Synthetic reference ${i + 1}`,
  relationship: "Colleague",
  phone: "2765550142",
  email: `reference-${i}@example.com`,
}));
let backend,
  application,
  browser,
  context,
  base,
  mode = "success";
const saved = new Map();
const savedQuotes = [];
const browserErrors = [];
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server.address().port)),
  );

before(async () => {
  assert.ok(
    fs.existsSync(path.join(root, ".next/BUILD_ID")),
    "Run npm run build before browser tests.",
  );
  backend = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/rest/v1/rpc/employment_submission_ready") {
      response.end("1");
      return;
    }
    if (
      request.url === "/rest/v1/quote_requests?select=id" &&
      request.method === "POST"
    ) {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      savedQuotes.push(JSON.parse(raw));
      response.writeHead(201).end(JSON.stringify([{ id: randomUUID() }]));
      return;
    }
    if (request.url !== "/rest/v1/rpc/submit_employment_application") {
      response.writeHead(404).end("{}");
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    if (mode === "error") {
      response.writeHead(503).end("{}");
      return;
    }
    const existing = saved.get(body.p_submission_id);
    if (existing && existing.digest !== body.p_digest) {
      response.writeHead(409).end("{}");
      return;
    }
    const row = existing || {
      id: randomUUID(),
      digest: body.p_digest,
      payload: body.p_payload,
    };
    saved.set(body.p_submission_id, row);
    response.end(JSON.stringify(row.id));
  });
  const backendPort = await listen(backend);
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  // Explicit localhost-only overrides: the suite never contacts a Supabase project.
  application = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: root,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "production",
        VERCEL: "",
        SUPABASE_URL: `http://127.0.0.1:${backendPort}`,
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backendPort}`,
        SUPABASE_SECRET_KEY: "sb_secret_isolated_browser_test",
        SUPABASE_SERVICE_ROLE_KEY: "",
        EMPLOYMENT_APPLICATIONS_ENABLED: "true",
        EMPLOYMENT_APPLICATION_SECRET: randomBytes(48).toString("base64url"),
      },
    },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/careers")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Startup only. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Isolated application server did not start.");
  const macChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath =
    process.env.EMPLOYMENT_TEST_BROWSER_PATH ||
    (fs.existsSync(macChrome) ? macChrome : undefined);
  browser = await chromium.launch({ headless: true, executablePath });
  context = await browser.newContext();
  context.on("page", (page) => {
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|did not match|server rendered/i.test(message.text())
      )
        browserErrors.push("Hydration error");
    });
  });
  await context.route("**/*", (route) => {
    const hostname = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(hostname)
      ? route.continue()
      : route.abort();
  });
});
after(async () => {
  await browser?.close();
  application?.kill("SIGTERM");
  if (backend) await new Promise((resolve) => backend.close(resolve));
  assert.deepEqual(
    browserErrors,
    [],
    "No browser exceptions or hydration errors",
  );
});

const draftKey = "jb-squeaky:employment-draft:v1";
async function fresh(page) {
  await page.goto(base + "/careers");
  await page.evaluate((key) => localStorage.removeItem(key), draftKey);
  await page.reload();
  await page.locator(".employment-form").waitFor();
}
async function savedDraft(page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "null"),
    draftKey,
  );
}
async function waitSaved(page) {
  await page.waitForFunction((key) => !!localStorage.getItem(key), draftKey);
  await page.waitForTimeout(450);
}
const control = (page, id) => page.locator(`[id="application-${id}"]`);
async function fillFields(page, fields, values, prefix = "") {
  for (const field of fields) {
    const value = values[field.id] ?? "";
    if (field.type === "checks")
      for (const option of field.options)
        await page
          .getByLabel(option, { exact: true })
          .setChecked(value.includes(option));
    else if (field.type === "select")
      await control(page, prefix + field.id).selectOption(value);
    else await control(page, prefix + field.id).fill(value);
  }
}
async function fillStep(page, step) {
  await fillFields(page, schema.applicationSteps[step].fields, answers);
  if (step === 3) {
    await page.getByRole("button", { name: "Add previous employer" }).click();
    await fillFields(page, schema.employerFields, employer, "employers.0.");
  }
  if (step === 6)
    for (let i = 0; i < 2; i++)
      await fillFields(
        page,
        schema.referenceFields,
        references[i],
        `references.${i}.`,
      );
}
async function review(page) {
  await fresh(page);
  for (let step = 0; step < 7; step++) {
    await fillStep(page, step);
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
}
async function acknowledge(page) {
  await page.locator("#application-accepted").check();
  await control(page, "acknowledgment").fill(answers.full_name);
  const token = await page
    .locator("input[name=application_token]")
    .inputValue();
  const issued = JSON.parse(
    Buffer.from(token.split(".")[0], "base64url").toString(),
  ).issued;
  await page.waitForTimeout(Math.max(0, 2100 - (Date.now() - issued)));
}
async function submit(page) {
  await page
    .getByRole("button", { name: "Submit Application", exact: true })
    .click();
}

for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
  test(`all eight steps reflow at ${width}px with normal and 200% text`, async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 900 });
    for (const scale of ["100%", "200%"]) {
      await fresh(page);
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, scale);
      for (let step = 0; step < 8; step++) {
        if (step < 7) await fillStep(page, step);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `Overflow at width ${width}, text ${scale}, step ${step + 1}: ${JSON.stringify(await page.locator("body *").evaluateAll((nodes) => nodes.filter((n) => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth + 1).map((n) => ({ tag: n.tagName, cls: n.className, text: n.textContent?.slice(0, 55), width: n.getBoundingClientRect().width }))))}`,
        );
        const bad = await page
          .locator(
            ".employment-form .field input,.employment-form .field select,.employment-form .field textarea,.application-review-heading button,.application-controls button",
          )
          .evaluateAll((nodes) =>
            nodes.some((node) => {
              const box = node.getBoundingClientRect();
              return box.left < 0 || box.right > innerWidth + 1;
            }),
          );
        assert.equal(
          bad,
          false,
          `Clipped control at ${width}px / ${scale} / step ${step + 1}`,
        );
        if (step < 7)
          await page.getByRole("button", { name: "Next", exact: true }).click();
      }
    }
    await page.close();
  });
}

test("Review does not submit early; acknowledgment exposes required semantics and errors", async () => {
  const page = await context.newPage();
  await review(page);
  assert.equal(await page.locator(".field-error").count(), 0);
  assert.equal(
    await page
      .locator("#application-accepted")
      .evaluate((node) => node.required),
    true,
  );
  assert.ok(
    await page
      .getByText(
        "Your latest availability time is on the following day (overnight).",
        { exact: true },
      )
      .isVisible(),
  );
  await submit(page);
  await page.locator("#application-accepted-error").waitFor();
  assert.equal(
    await page
      .locator("#application-accepted")
      .getAttribute("aria-describedby"),
    "application-accepted-error",
  );
  assert.equal(await page.locator(".application-success").count(), 0);
  await page.close();
});

test("future starts and equal times fail in the browser; overnight/past employment proceed", async () => {
  const page = await context.newPage();
  await fresh(page);
  await fillStep(page, 0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await fillStep(page, 1);
  await control(page, "latest_time").fill("17:00");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator("#application-latest_time-error").waitFor();
  assert.ok(
    (await page.locator("#application-latest_time-error").innerText()).includes(
      "different",
    ),
  );
  await control(page, "latest_time").fill("08:00");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await fillStep(page, 2);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await fillStep(page, 3);
  await control(page, "employers.0.from").fill(
    `${new Date().getUTCFullYear() + 1}-01`,
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator('[id="application-employers.0.from-error"]').waitFor();
  await control(page, "employers.0.from").fill("2020-01");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await control(page, "years_experience").waitFor();
  await page.close();
});

for (const afterSave of [false, true]) {
  test(`${afterSave ? "lost saved response" : "interrupted request"} retains the mounted form and retries with the original token`, async () => {
    const page = await context.newPage();
    await review(page);
    await acknowledge(page);
    const token = await page
      .locator("input[name=application_token]")
      .inputValue();
    const data = await page.locator("input[name=application]").inputValue();
    const beforeCount = saved.size;
    let interrupt = true;
    await page.route("**/careers", async (route) => {
      if (route.request().method() === "POST" && interrupt) {
        interrupt = false;
        if (afterSave) await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await submit(page);
    await page.locator(".employment-form .form-message").waitFor();
    assert.ok(await page.locator(".employment-form").isVisible());
    assert.equal(await page.locator(".application-success").count(), 0);
    assert.equal(
      await page.locator("input[name=application_token]").inputValue(),
      token,
    );
    assert.equal(
      await page.locator("input[name=application]").inputValue(),
      data,
    );
    assert.equal(saved.size, beforeCount + (afterSave ? 1 : 0));
    await submit(page);
    await page
      .getByRole("heading", { name: "Application received.", exact: true })
      .waitFor();
    assert.equal(saved.size, beforeCount + 1);
    const submissionId = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString(),
    ).id;
    assert.equal(
      await page.locator(".application-success strong").innerText(),
      saved.get(submissionId).id,
    );
    await page.close();
  });
}

test("temporary backend errors preserve data and allow a successful retry", async () => {
  const page = await context.newPage();
  await review(page);
  await acknowledge(page);
  const count = saved.size;
  mode = "error";
  try {
    await submit(page);
    await page.locator(".form-message").waitFor();
    assert.ok(await page.locator(".employment-form").isVisible());
    assert.equal(saved.size, count);
  } finally {
    mode = "success";
  }
  await submit(page);
  await page
    .getByRole("heading", { name: "Application received.", exact: true })
    .waitFor();
  assert.equal(saved.size, count + 1);
  await page.close();
});

test("Review controls and certification remain keyboard accessible", async () => {
  const page = await context.newPage();
  await review(page);
  const edit = page.getByRole("button", {
    name: "Edit Personal information",
    exact: true,
  });
  await edit.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await control(page, "full_name").inputValue(),
    answers.full_name,
  );
  for (let i = 0; i < 7; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).focus();
    await page.keyboard.press("Enter");
  }
  assert.equal(await page.locator(".field-error").count(), 0);
  await page.locator("#application-accepted").focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#application-accepted").isChecked(), true);
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "application-acknowledgment",
  );
  await page.keyboard.type(answers.full_name);
  await acknowledge(page);
  await page
    .getByRole("button", { name: "Submit Application", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "Application received.", exact: true })
    .waitFor();
  await page.close();
});

test("automatic draft writes are debounced; refresh flushes recent edits without tokens or URL data", async () => {
  const page = await context.newPage();
  await fresh(page);
  await page.evaluate((key) => {
    window.__draftWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === key) window.__draftWrites++;
      return original.call(this, k, v);
    };
  }, draftKey);
  const token = await page
    .locator("input[name=application_token]")
    .inputValue();
  for (const value of ["S", "Sy", "Synthetic draft"])
    await control(page, "full_name").fill(value);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__draftWrites), 0);
  await waitSaved(page);
  assert.equal(await page.evaluate(() => window.__draftWrites), 1);
  const stored = await savedDraft(page);
  assert.equal(stored.draft.answers.full_name, "Synthetic draft");
  assert.ok(!JSON.stringify(stored).includes(token));
  assert.equal(new URL(page.url()).search, "");
  await control(page, "full_name").fill("Synthetic refreshed immediately");
  await page.reload();
  await page
    .getByRole("button", { name: "Continue Application", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Continue Application", exact: true })
    .click();
  assert.equal(
    await control(page, "full_name").inputValue(),
    "Synthetic refreshed immediately",
  );
  assert.notEqual(
    await page.locator("input[name=application_token]").inputValue(),
    token,
  );
  await page.close();
});

test("all sections and three employers restore on Review; closing and reopening a tab preserves step", async () => {
  const page = await context.newPage();
  await review(page);
  await page
    .getByRole("button", { name: "Edit Employment history", exact: true })
    .click();
  for (let i = 1; i < 3; i++) {
    await page.getByRole("button", { name: "Add previous employer" }).click();
    await fillFields(
      page,
      schema.employerFields,
      { ...employer, name: `Synthetic employer ${i + 1}` },
      `employers.${i}.`,
    );
  }
  for (let i = 3; i < 7; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await acknowledge(page);
  await waitSaved(page);
  const original = await page.locator("input[name=application]").inputValue();
  await page.close();
  const returned = await context.newPage();
  await returned.goto(base + "/careers");
  await returned
    .getByRole("dialog", { name: "Continue your application?" })
    .waitFor();
  const first = await savedDraft(returned);
  await returned.waitForTimeout(500);
  assert.equal(
    (await savedDraft(returned)).savedAt,
    first.savedAt,
    "Opening recovery must not write or renew the draft",
  );
  await returned
    .getByRole("button", { name: "Continue Application", exact: true })
    .click();
  assert.match(
    await returned.locator(".application-step-count").innerText(),
    /Step 8/,
  );
  assert.deepEqual(
    JSON.parse(await returned.locator("input[name=application]").inputValue()),
    JSON.parse(original),
  );
  await returned
    .getByRole("button", { name: "Edit Personal information", exact: true })
    .click();
  assert.equal(
    await control(returned, "desired_pay").inputValue(),
    answers.desired_pay,
  );
  assert.equal(
    await control(returned, "pay_period").inputValue(),
    answers.pay_period,
  );
  await returned.close();
});

test("Start New and Discard Draft remove old answers without immediately resaving them", async () => {
  const page = await context.newPage();
  await fresh(page);
  await fillStep(page, 0);
  await waitSaved(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Start New Application", exact: true })
    .click();
  assert.equal(await control(page, "full_name").inputValue(), "");
  await page.waitForTimeout(500);
  assert.equal(await savedDraft(page), null);
  await fillStep(page, 0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await waitSaved(page);
  await page
    .getByRole("button", { name: "Discard Draft", exact: true })
    .click();
  assert.match(
    await page.locator(".application-step-count").innerText(),
    /Step 1/,
  );
  assert.equal(await control(page, "full_name").inputValue(), "");
  await page.waitForTimeout(500);
  assert.equal(await savedDraft(page), null);
  await page.reload();
  await page.locator(".employment-form").waitFor();
  assert.equal(await page.locator(".application-recovery").count(), 0);
  await page.close();
});

test("expired, malformed and unsupported drafts are removed and never restored", async () => {
  const page = await context.newPage();
  await fresh(page);
  await fillStep(page, 0);
  await waitSaved(page);
  const record = await savedDraft(page);
  await page.goto(base + "/about");
  for (const value of [
    "{broken",
    JSON.stringify({ ...record, version: 99 }),
    JSON.stringify({ ...record, createdAt: Date.now() - 7 * 86400000 - 1 }),
  ]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: draftKey,
      value,
    });
    await page.goto(base + "/careers");
    await page.locator(".employment-form").waitFor();
    assert.equal(await control(page, "full_name").inputValue(), "");
    assert.equal(await savedDraft(page), null);
    await page.goto(base + "/about");
  }
  await page.close();
});

for (const failure of ["SecurityError", "QuotaExceededError"]) {
  test(`application remains usable with ${failure} storage`, async () => {
    const isolated = await browser.newContext();
    await isolated.addInitScript((name) => {
      if (name === "SecurityError")
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Synthetic unavailable storage", name);
          },
        });
      else
        Storage.prototype.setItem = function () {
          throw new DOMException("Synthetic storage quota", name);
        };
    }, failure);
    const page = await isolated.newPage();
    await page.goto(base + "/careers");
    await page.locator(".employment-form").waitFor();
    for (let step = 0; step < 7; step++) {
      await fillStep(page, step);
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await acknowledge(page);
    await page
      .getByText(
        "Draft saving is unavailable on this device. Keep this tab open until you finish.",
        { exact: true },
      )
      .waitFor();
    await submit(page);
    await page
      .getByRole("heading", { name: "Application received.", exact: true })
      .waitFor();
    await isolated.close();
  });
}

test("confirmed success clears draft; failed submission keeps it until confirmation", async () => {
  const page = await context.newPage();
  await review(page);
  await acknowledge(page);
  await waitSaved(page);
  mode = "error";
  try {
    await submit(page);
    await page.locator(".employment-form .form-message").waitFor();
  } finally {
    mode = "success";
  }
  assert.ok((await savedDraft(page)).submissionUnconfirmed);
  assert.equal(
    (await savedDraft(page)).draft.answers.full_name,
    answers.full_name,
  );
  await submit(page);
  await page
    .getByRole("heading", { name: "Application received.", exact: true })
    .waitFor();
  await page.waitForTimeout(500);
  assert.equal(await savedDraft(page), null);
  await page.reload();
  await page.locator(".employment-form").waitFor();
  assert.equal(await page.locator(".application-recovery").count(), 0);
  assert.equal(await control(page, "full_name").inputValue(), "");
  await page.close();
});

test("reloaded unconfirmed submission cannot resubmit under a fresh signed token", async () => {
  const page = await context.newPage();
  await review(page);
  await acknowledge(page);
  const before = saved.size;
  let lost = true;
  await page.route("**/careers", async (r) => {
    if (r.request().method() === "POST" && lost) {
      lost = false;
      await r.fetch();
      return r.abort("failed");
    }
    return r.continue();
  });
  await submit(page);
  await page.locator(".employment-form .form-message").waitFor();
  assert.equal(saved.size, before + 1);
  await page.reload();
  await page
    .getByRole("button", { name: "Continue Application", exact: true })
    .click();
  await page
    .getByText(/A previous submission may already have been received/)
    .waitFor();
  await submit(page);
  await page.waitForTimeout(500);
  assert.equal(saved.size, before + 1);
  assert.equal(await page.locator(".application-success").count(), 0);
  await page.close();
});

for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
  test(`recovery prompt reflows and works by keyboard at ${width}px`, async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 800 });
    await fresh(page);
    await fillStep(page, 0);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await waitSaved(page);
    await page.reload();
    const region = page.getByRole("dialog", {
      name: "Continue your application?",
    });
    await region.waitFor();
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const button = page.getByRole("button", {
      name: "Continue Application",
      exact: true,
    });
    await button.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "Availability", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => document.activeElement.className),
      "application-step-heading",
    );
    await page.getByRole("button", { name: "Back", exact: true }).click();
    assert.equal(
      await control(page, "full_name").inputValue(),
      answers.full_name,
    );
    await page.close();
  });
}

test("navigation away preserves recent edits and quote submission remains unchanged", async () => {
  const page = await context.newPage();
  await fresh(page);
  await control(page, "full_name").fill("Synthetic navigation draft");
  await page.getByRole("link", { name: "About", exact: true }).first().click();
  await page.waitForURL("**/about");
  await page.goto(base + "/careers");
  await page
    .getByRole("button", { name: "Continue Application", exact: true })
    .click();
  assert.equal(
    await control(page, "full_name").inputValue(),
    "Synthetic navigation draft",
  );
  await page.goto(base + "/request-a-quote");
  const before = savedQuotes.length;
  for (const [id, value] of Object.entries({
    name: "Synthetic Quote Draft Regression",
    phone: "2765550199",
    email: "quote-local@example.com",
    location: "Richmond, VA",
    property_size: "1000 sq ft",
    preferred_timing: "Synthetic test",
    details: "Synthetic isolated regression only.",
  }))
    await page.locator("#" + id).fill(value);
  await page.locator("#service_type").selectOption("Commercial");
  await page.locator("#frequency").selectOption("One-time");
  await page.getByRole("button", { name: "Send Quote Request" }).click();
  await page
    .getByRole("heading", { name: "Request received.", exact: true })
    .waitFor();
  assert.equal(savedQuotes.length, before + 1);
  assert.equal(savedQuotes.at(-1).service_type, "Commercial");
  await page.close();
});

test("a draft expiring while recovery is open cannot be continued", async () => {
  const page = await context.newPage();
  await fresh(page);
  await fillStep(page, 0);
  await waitSaved(page);
  await page.reload();
  await page
    .getByRole("dialog", { name: "Continue your application?" })
    .waitFor();
  await page.evaluate(() => {
    const original = Date.now;
    Date.now = () => original() + 8 * 86400000;
  });
  await page
    .getByRole("button", { name: "Continue Application", exact: true })
    .click();
  await page.locator(".employment-form").waitFor();
  assert.equal(await control(page, "full_name").inputValue(), "");
  assert.equal(await savedDraft(page), null);
  await page.close();
});
