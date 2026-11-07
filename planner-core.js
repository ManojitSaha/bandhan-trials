"use strict";

/** Pure trip-plan logic for bandhan-trials. Exports as UMD so Node tests
 *  (require) and browser scripts (script tag) can both use it. */
(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
      ? define(factory)
      : (global.plannerCore = factory());
})(this, function () {
  const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
  const MAX_DAYS = 14;
  const MAX_TRAVELLERS = 12;
  const MAX_NOTES = 500;
  const MAX_NAME = 100;

  const REGION_SLUGS = ["west-bengal", "sikkim", "north-east"];
  const REGIONS = [
    {
      slug: "west-bengal",
      name: "West Bengal",
      summary:
        "The Darjeeling and Kalimpong hills rise out of the Bengal plains into terraced tea gardens, cinchona plantations and pine ridges. This is where Bandhan Trails began.",
      highlights: [
        "Mansong Cinchona Plantation and the old bridle paths around Kalimpong",
        "Darjeeling first-flush tea gardens and the Himalayan Railway",
        "Orange orchards and cardamom groves in the Sittong valley",
        "Sunrise over Kanchenjunga from the ridge above Kurseong",
      ],
      activities: [
        {
          id: "cinchona-plantation-walk",
          title: "Mansong cinchona plantation walk",
          description:
            "A gentle half-day walk through the old cinchona plantation above Kalimpong, with views into the Teesta valley.",
          durationHours: 3,
        },
        {
          id: "darjeeling-tea-morning",
          title: "Darjeeling tea-garden morning",
          description:
            "Join a plucking morning at a ridge tea garden, then taste first-flush leaves where they are grown.",
          durationHours: 4,
        },
        {
          id: "sittong-orchard-tour",
          title: "Sittong orange-orchard tour",
          description:
            "Walk the terraced orchards and cardamom groves of Sittong with the farming family that tends them.",
          durationHours: 2.5,
        },
      ],
      homestays: [
        {
          slug: "cloud-nest",
          name: "Cloud Nest",
          location: "Munsong, Kashyem, Kalimpong",
          summary:
            "Near Mansong Cinchona Plantation, Kalimpong 734301 — tea, valley and forest views.",
        },
      ],
    },
    {
      slug: "sikkim",
      name: "Sikkim",
      summary:
        "A small Himalayan state of monasteries, rhododendron forests and glacial valleys climbing towards Kanchenjunga.",
      highlights: [
        "Kanchenjunga sunrise from the Pelling and Yuksom ridges",
        "Gompas and prayer-flag passes on the old south Sikkim routes",
        "Rhododendron and orchid trails through the higher forests",
        "White-water rafting on the Teesta and Rangeet rivers",
      ],
      activities: [
        {
          id: "kanchenjunga-sunrise",
          title: "Kanchenjunga sunrise at Pelling",
          description:
            "An early start to watch first light break across Kanchenjunga from the Pelling ridge.",
          durationHours: 3,
        },
        {
          id: "teesta-rafting",
          title: "Teesta white-water rafting",
          description:
            "Thrills on the glacial waters of the Teesta river with experienced guides.",
          durationHours: 3,
        },
      ],
      homestays: [
        {
          slug: "ridgeview-demo",
          name: "Ridgeview Homestay",
          location: "Pelling, West Sikkim",
          summary: "Views across the Yuksom ridge toward Kanchenjunga.",
        },
      ],
    },
    {
      slug: "north-east",
      name: "North East India",
      summary:
        "Seven states of rainforest, river plains and living cultures, from the tea estates of Assam to the root bridges of Meghalaya.",
      highlights: [
        "Living root bridges and limestone caves in Meghalaya",
        "Rhino and elephant country around Kaziranga, Assam",
        "Tawang monastery and the high passes of Arunachal Pradesh",
      ],
      activities: [
        {
          id: "root-bridges",
          title: "Living root bridges of Meghalaya",
          description: "Walk the double-decker root bridge at Nongriat.",
          durationHours: 4,
        },
      ],
      homestays: [
        {
          slug: "riverbend-demo",
          name: "Riverbend Homestay",
          location: "Nongriat, Meghalaya",
          summary: "Beside the Umshiang river, beneath the root bridges.",
        },
      ],
    },
  ];

  const STOP_TIMES = ["morning", "afternoon", "evening"];
  const STOP_TIME_LABELS = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function isRegionSlug(value) {
    return typeof value === "string" && REGION_SLUGS.includes(value);
  }

  /** Formats a UTC date as `YYYY-MM-DD`. */
  function formatDate(date) {
    const year = date.getUTCFullYear().toString().padStart(4, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /** Adds whole days to an ISO date; returns `""` for anything invalid. */
  function addDays(isoDate, offset) {
    if (!DATE_PATTERN.test(isoDate)) return "";
    const [year, month, day] = isoDate.split("-").map(Number);
    const time = Date.UTC(year, month - 1, day);
    const date = new Date(time);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return "";
    }
    return formatDate(new Date(time + offset * 86_400_000));
  }

  function isValidMobile(value) {
    const trimmed = (value || "").trim();
    if (!/^\+?[0-9()\s-]+$/.test(trimmed)) return false;
    const digits = trimmed.replace(/\D/g, "");
    const national =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0")
          ? digits.slice(1)
          : digits;
    return /^[6-9]\d{9}$/.test(national);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
  }

  function isValidContact(value) {
    if (!isRecord(value)) return false;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const mobile = typeof value.mobile === "string" ? value.mobile.trim() : "";
    const email =
      typeof value.email === "string" ? value.email.trim() : null;
    if (name.length === 0 || name.length > MAX_NAME) return false;
    if (!isValidMobile(mobile)) return false;
    if (email === null || email.length > MAX_NOTES) return false;
    if (email.length > 0 && !isValidEmail(email)) return false;
    return true;
  }

  function isValidInput(value) {
    if (!isRecord(value)) return false;
    const {
      regions, startDate, days, travellers, budget, pace, interests, notes,
    } = value;
    if (
      !Array.isArray(regions) ||
      regions.length === 0 ||
      regions.length > REGION_SLUGS.length ||
      !regions.every(isRegionSlug) ||
      new Set(regions).size !== regions.length
    ) {
      return false;
    }
    if (typeof startDate !== "string" || addDays(startDate, 0) !== startDate) {
      return false;
    }
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > MAX_DAYS
    ) {
      return false;
    }
    if (
      typeof travellers !== "number" ||
      !Number.isInteger(travellers) ||
      travellers < 1 ||
      travellers > MAX_TRAVELLERS
    ) {
      return false;
    }
    if (!["budget", "comfort", "premium"].includes(budget)) return false;
    if (!["relaxed", "balanced", "active"].includes(pace)) return false;
    if (
      !Array.isArray(interests) ||
      interests.length === 0 ||
      new Set(interests).size !== interests.length
    ) {
      return false;
    }
    for (const interest of interests) {
      if (
        !["tea", "trekking", "monasteries", "wildlife", "food", "culture", "photography"].includes(
          interest,
        )
      ) {
        return false;
      }
    }
    return typeof notes === "string" && notes.length <= MAX_NOTES;
  }

  function regionMaterial(slug) {
    const region = REGIONS.find((entry) => entry.slug === slug);
    if (!region) return "";
    const lines = [
      `## ${region.name}`,
      region.summary,
      "Highlights:",
      ...region.highlights.map((highlight) => `- ${highlight}`),
      "Activities we arrange:",
      ...region.activities.map(
        (entry) => `- ${entry.title} (${entry.durationHours} h): ${entry.description}`,
      ),
      "Homestays:",
      ...region.homestays.map(
        (entry) => `- ${entry.name} — ${entry.location}. ${entry.summary}`,
      ),
    ];
    return lines.join("\n");
  }

  /** Builds the single prompt sent to OpenRouter — only chosen-region material. */
  function buildPrompt(input) {
    const chosen = REGIONS.filter((region) => input.regions.includes(region.slug));
    const interestLabels = input.interests.join(", ");
    const sections = [
      "You are a trip planner for Bandhan Trails, a homestay and travel company in West Bengal, Sikkim and North East India.",
      `Create a ${input.days}-day itinerary starting ${input.startDate} for ${input.travellers} traveller(s).`,
      `Regions: ${chosen.map((region) => region.name).join(", ")}.`,
      `Budget: ${input.budget}. Pace: ${input.pace}. Interests: ${interestLabels}.`,
      input.notes.trim().length > 0 ? `Traveller notes: ${input.notes.trim()}` : "",
      "Use only the places, activities and homestays listed below. Do not invent names or locations.",
      "Give each day 2-4 stops in morning, afternoon, evening order. Mention a listed homestay in a stop note where it fits.",
      "Return JSON only, matching the schema.",
      ...chosen.map((region) => regionMaterial(region.slug)),
    ];
    return sections.filter((section) => section.length > 0).join("\n\n");
  }

  const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
      title: { type: "string", maxLength: 120 },
      summary: { type: "string", maxLength: 600 },
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            day: { type: "integer" },
            title: { type: "string", maxLength: 120 },
            stops: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  time: { type: "string", enum: STOP_TIMES },
                  activity: { type: "string", maxLength: 200 },
                  note: { type: "string", maxLength: 400 },
                  regionSlug: { type: "string", enum: REGION_SLUGS },
                },
                required: ["time", "activity", "note", "regionSlug"],
              },
            },
          },
          required: ["day", "title", "stops"],
        },
      },
      tips: { type: "array", items: { type: "string", maxLength: 200 } },
    },
    required: ["title", "summary", "days", "tips"],
  };

  function trimmed(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }

  /** Normalises whatever the model returned into a `TripPlan`, or `null`. */
  function parsePlan(raw, input) {
    if (!isRecord(raw)) return null;
    const title = trimmed(raw.title, 120);
    const summary = trimmed(raw.summary, 600);
    if (title.length === 0 || summary.length === 0) return null;

    const rawDays = Array.isArray(raw.days) ? raw.days : [];
    const ordered = [];
    for (const entry of rawDays) {
      if (!isRecord(entry)) continue;
      const dayTitle = trimmed(entry.title, 120);
      const rawStops = Array.isArray(entry.stops) ? entry.stops : [];
      const stops = [];
      for (const candidate of rawStops) {
        if (!isRecord(candidate)) continue;
        const activity = trimmed(candidate.activity, 200);
        if (activity.length === 0 || !STOP_TIMES.includes(candidate.time)) {
          continue;
        }
        stops.push({
          time: candidate.time,
          activity,
          note: trimmed(candidate.note, 400),
          regionSlug: isRegionSlug(candidate.regionSlug)
            ? candidate.regionSlug
            : null,
        });
      }
      if (dayTitle.length === 0 || stops.length === 0) continue;
      const order =
        typeof entry.day === "number" && Number.isFinite(entry.day)
          ? entry.day
          : ordered.length + 1;
      ordered.push({ order, title: dayTitle, stops });
    }
    if (ordered.length === 0) return null;
    ordered.sort((a, b) => a.order - b.order);
    const days = ordered
      .slice(0, input.days)
      .map((entry, index) => ({
        day: index + 1,
        date: addDays(input.startDate, index),
        title: entry.title,
        stops: entry.stops,
      }));
    const tips = Array.isArray(raw.tips)
      ? raw.tips
          .map((tip) => trimmed(tip, 200))
          .filter((tip) => tip.length > 0)
          .slice(0, 5)
      : [];
    return { title, summary, days, tips };
  }

  /** Maps stops onto saved-itinerary inputs — none sent to the model. */
  function toItineraryInputs(plan) {
    return plan.days.flatMap((day) =>
      day.stops.map((stop) => ({
        activity: stop.activity,
        date: day.date,
        regionSlug: stop.regionSlug,
        tripName: plan.title,
      })),
    );
  }

  /** Renders contact details plus the whole plan as plain text for WhatsApp. */
  function formatWhatsAppMessage(plan, contact) {
    const lines = [`Mobile: ${contact.mobile.trim()}`];
    const email = contact.email.trim();
    if (email.length > 0) lines.push(`Email: ${email}`);
    lines.push("", `Trip: ${plan.title}`, plan.summary, "");
    for (const day of plan.days) {
      lines.push(`Day ${day.day} — ${day.date} — ${day.title}`);
      for (const stop of day.stops) {
        const note = stop.note.length > 0 ? ` — ${stop.note}` : "";
        lines.push(
          `- ${STOP_TIME_LABELS[stop.time]}: ${stop.activity}${note}`,
        );
      }
      lines.push("");
    }
    if (plan.tips.length > 0) {
      lines.push("Tips:", ...plan.tips.map((tip) => `- ${tip}`));
    }
    return lines.join("\n").trim();
  }

  /** Builds a `wa.me` deep link to +91 94776 24057 with the composed text. */
  function buildWhatsAppUrl(plan, contact) {
    const text = `${contact.name.trim()}\n\n${formatWhatsAppMessage(
      plan,
      contact,
    )}`;
    const encoded = encodeURIComponent(text);
    return `https://wa.me/919477624057?text=${encoded}`;
  }

  function isAbortError(error) {
    return (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
    );
  }

  const MISSING_KEY_MESSAGE =
    "Trip planning isn't set up yet. Add NEXT_PUBLIC_OPENROUTER_API_KEY to config.js and restart the dev server.";
  const NETWORK_MESSAGE =
    "Couldn't reach the trip planner service. Check your connection and try again.";
  const INVALID_MESSAGE =
    "The trip planner service sent back a plan we couldn't read. Try generating again.";

  /** Asks OpenRouter for a structured trip plan. Key is public by design. */
  async function generatePlan(input, options = {}) {
    const apiKey =
      options.apiKey ?? (typeof window !== "undefined" && window.openRouterApiKey
        ? window.openRouterApiKey
        : "") ?? "";
    if (apiKey.length === 0) {
      const error = new Error(MISSING_KEY_MESSAGE);
      error.kind = "missing-key";
      throw error;
    }
    const model = options.model || DEFAULT_MODEL;
    const fetchImpl = options.fetchImpl || fetch;
    let response;
    try {
      response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Title": "Bandhan Trails",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: buildPrompt(input) }],
          response_format: {
            type: "json_schema",
            json_schema: { name: "trip_plan", strict: true, schema: RESPONSE_SCHEMA },
          },
          provider: { require_parameters: true },
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: options.signal,
      });
    } catch (error) {
      if (isAbortError(error) || (options.signal && options.signal.aborted)) {
        throw error;
      }
      const error_ = new Error(NETWORK_MESSAGE);
      error_.kind = "network";
      throw error_;
    }
    if (!response.ok) {
      const error_ = new Error(
        `The trip planner service returned ${response.status}. Please try again.`,
      );
      error_.kind = "api";
      throw error_;
    }
    let data;
    try {
      data = await response.json();
    } catch {
      const error_ = new Error(INVALID_MESSAGE);
      error_.kind = "invalid";
      throw error_;
    }
    let text = "";
    if (isRecord(data) && Array.isArray(data.choices)) {
      const choice = data.choices[0];
      if (isRecord(choice) && isRecord(choice.message)) {
        const content = choice.message.content;
        if (typeof content === "string") {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .map((part) =>
              isRecord(part) && typeof part.text === "string"
                ? part.text
                : "",
            )
            .join("");
        }
      }
    }
    if (text.length === 0) {
      const error_ = new Error(INVALID_MESSAGE);
      error_.kind = "invalid";
      throw error_;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const error_ = new Error(INVALID_MESSAGE);
      error_.kind = "invalid";
      throw error_;
    }
    const plan = parsePlan(parsed, input);
    if (!plan) {
      const error_ = new Error(INVALID_MESSAGE);
      error_.kind = "invalid";
      throw error_;
    }
    return plan;
  }

  function normalizeStored(value) {
    if (!isRecord(value)) return null;
    const plan = parsePlan(value.plan, value.input);
    if (!plan) return null;
    const contact = value.contact !== undefined ? value.contact : null;
    if (contact !== null && !isValidContact(contact)) return null;
    const contactOut = contact
      ? {
          name: contact.name.trim(),
          mobile: contact.mobile.trim(),
          email: contact.email.trim(),
        }
      : null;
    return { input: value.input, plan, contact: contactOut };
  }

  return {
    ENDPOINT,
    DEFAULT_MODEL,
    MAX_DAYS,
    MAX_TRAVELLERS,
    MAX_NOTES,
    MAX_NAME,
    addDays,
    isValidMobile,
    isValidEmail,
    isValidContact,
    isValidInput,
    buildPrompt,
    parsePlan,
    toItineraryInputs,
    formatWhatsAppMessage,
    buildWhatsAppUrl,
    generatePlan,
    normalizeStored,
  };
});