const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("./planner-core.js");

const contact = {
  name: "Asha Saha",
  mobile: "+91 98765 43210",
  email: "asha@example.com",
};

function input(overrides = {}) {
  return {
    regions: ["west-bengal"],
    startDate: "2026-11-08",
    days: 2,
    travellers: 2,
    budget: "comfort",
    pace: "balanced",
    interests: ["tea"],
    notes: "",
    ...overrides,
  };
}

const rawPlan = {
  title: "Hills",
  summary: "Two slow days.",
  days: [
    {
      day: 1,
      title: "Arrive",
      stops: [
        {
          time: "morning",
          activity: "Walk",
          note: "In the pines",
          regionSlug: "west-bengal",
        },
      ],
    },
  ],
  tips: ["Carry cash"],
};

test("addDays rolls over month and year boundaries", () => {
  assert.equal(core.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(core.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(core.addDays("not-a-date", 1), "");
});

test("validates Indian mobile formats", () => {
  for (const value of [
    "9876543210",
    "+91 98765 43210",
    "098765 43210",
    "98765-43210",
    "(98765) 43210",
  ]) {
    assert.equal(core.isValidMobile(value), true, value);
  }
  for (const value of [
    "",
    "12345",
    "5876543210",
    "98765 4321",
    "+1 555 123 4567",
    "98765abc43210",
    "call 9876543210",
    "+91/9876543210",
    "9876543210 ext 12",
  ]) {
    assert.equal(core.isValidMobile(value), false, value);
  }
});

test("validates email addresses", () => {
  assert.equal(core.isValidEmail("asha@example.com"), true);
  assert.equal(core.isValidEmail("asha+trips@example.co.in"), true);
  assert.equal(core.isValidEmail("asha@example"), false);
  assert.equal(core.isValidEmail("not an email"), false);
  assert.equal(core.isValidEmail(""), false);
});

test("validates contact details", () => {
  assert.equal(core.isValidContact(contact), true);
  assert.equal(core.isValidContact({ ...contact, email: "" }), true);
  assert.equal(core.isValidContact({ ...contact, name: "  " }), false);
  assert.equal(core.isValidContact({ ...contact, mobile: "12345" }), false);
  assert.equal(core.isValidContact({ ...contact, email: "nope" }), false);
  assert.equal(core.isValidContact(null), false);
});

test("validates trip input", () => {
  assert.equal(core.isValidInput(input()), true);
  assert.equal(core.isValidInput(input({ regions: [] })), false);
  assert.equal(core.isValidInput(input({ regions: ["moon"] })), false);
  assert.equal(core.isValidInput(input({ days: 0 })), false);
  assert.equal(core.isValidInput(input({ days: 15 })), false);
  assert.equal(core.isValidInput(input({ travellers: 0 })), false);
  assert.equal(core.isValidInput(input({ interests: [] })), false);
  assert.equal(
    core.isValidInput(input({ notes: "x".repeat(core.MAX_NOTES + 1) })),
    false,
  );
});

test("builds a prompt from the chosen regions only", () => {
  const prompt = core.buildPrompt(
    input({ regions: ["sikkim"], interests: ["trekking"], notes: "Slow" }),
  );

  assert.match(prompt, /Sikkim/);
  assert.match(prompt, /Kanchenjunga/);
  assert.match(prompt, /trekking/);
  assert.match(prompt, /Slow/);
  assert.doesNotMatch(prompt, /Cloud Nest/);
});

test("parses a plan, derives dates and drops unusable stops", () => {
  const plan = core.parsePlan(
    {
      ...rawPlan,
      days: [
        {
          ...rawPlan.days[0],
          stops: [
            ...rawPlan.days[0].stops,
            { time: "noon", activity: "   ", note: "", regionSlug: "sikkim" },
          ],
        },
      ],
    },
    input(),
  );

  assert.equal(plan.days[0].date, "2026-11-08");
  assert.equal(plan.days[0].day, 1);
  assert.equal(plan.days[0].stops.length, 1);
});

test("rejects plans with no usable days or non-objects", () => {
  assert.equal(core.parsePlan({ title: "Hills", summary: "x", days: [] }, input()), null);
  assert.equal(core.parsePlan(null, input()), null);
  assert.equal(core.parsePlan("nope", input()), null);
});

test("formats the contact and full plan for WhatsApp", () => {
  const message = core.formatWhatsAppMessage(
    core.parsePlan(rawPlan, input()),
    contact,
  );

  assert.match(message, /Mobile: \+91 98765 43210/);
  assert.match(message, /Email: asha@example.com/);
  assert.match(message, /Trip: Hills/);
  assert.match(message, /Day 1 — 2026-11-08 — Arrive/);
  assert.match(message, /- Morning: Walk — In the pines/);
  assert.match(message, /Tips:/);
  assert.match(message, /- Carry cash/);
});

test("omits the email line when none was given", () => {
  const message = core.formatWhatsAppMessage(
    core.parsePlan(rawPlan, input()),
    { ...contact, email: "" },
  );

  assert.doesNotMatch(message, /Email:/);
});

test("builds a wa.me link to the main Bandhan Trails number", () => {
  const url = core.buildWhatsAppUrl(core.parsePlan(rawPlan, input()), contact);

  assert.ok(url.startsWith("https://wa.me/919477624057?text="));
  const text = decodeURIComponent(url.slice(url.indexOf("?text=") + 6));
  assert.ok(text.startsWith("Asha Saha\n\nMobile: +91 98765 43210"));
  assert.match(text, /Trip: Hills/);
});

test("normalizes a stored plan and rejects corrupt data", () => {
  const plan = core.parsePlan(rawPlan, input());
  const stored = core.normalizeStored({ input: input(), plan, contact });

  assert.deepEqual(stored.plan, plan);
  assert.deepEqual(stored.contact, contact);

  assert.equal(core.normalizeStored(null), null);
  assert.equal(core.normalizeStored({ input: input(), plan, contact: {} }), null);
});

test("generatePlan needs a key and never calls fetch without one", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
  };

  await assert.rejects(
    core.generatePlan(input(), { apiKey: "", fetchImpl }),
    (error) => error.kind === "missing-key",
  );
  assert.equal(called, false);
});

test("generatePlan posts a structured OpenRouter request", async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(rawPlan) } }],
      }),
    };
  };

  const plan = await core.generatePlan(input(), {
    apiKey: "test-key",
    fetchImpl,
  });

  assert.equal(plan.title, "Hills");
  assert.equal(captured.url, core.ENDPOINT);
  assert.equal(captured.init.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, core.DEFAULT_MODEL);
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.provider, { require_parameters: true });
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.messages[0].content, core.buildPrompt(input()));
});

test("generatePlan maps API, invalid and network failures", async () => {
  const response = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  await assert.rejects(
    core.generatePlan(input(), {
      apiKey: "k",
      fetchImpl: async () => response(429, {}),
    }),
    (error) => error.kind === "api" && /429/.test(error.message),
  );

  await assert.rejects(
    core.generatePlan(input(), {
      apiKey: "k",
      fetchImpl: async () => response(200, { choices: [] }),
    }),
    (error) => error.kind === "invalid",
  );

  await assert.rejects(
    core.generatePlan(input(), {
      apiKey: "k",
      fetchImpl: async () =>
        response(200, {
          choices: [{ message: { content: "not json" } }],
        }),
    }),
    (error) => error.kind === "invalid",
  );

  await assert.rejects(
    core.generatePlan(input(), {
      apiKey: "k",
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    }),
    (error) => error.kind === "network",
  );
});

test("generatePlan propagates AbortError", async () => {
  const abort = new Error("aborted");
  abort.name = "AbortError";

  await assert.rejects(
    core.generatePlan(input(), {
      apiKey: "k",
      fetchImpl: async () => {
        throw abort;
      },
    }),
    (error) => error.name === "AbortError",
  );
});