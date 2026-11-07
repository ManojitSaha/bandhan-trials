# AI Trip Planner for bandhan-trials — Implementation Plan

**Goal:** Add a "Plan your trip" section to the static Bandhan Trails site: visitor details + trip preferences, a Gemini plan via OpenRouter, localStorage restore, and a WhatsApp hand-off to +91 94776 24057.

**Scope:** AI planner + WhatsApp only. No manual itinerary builder or save-to-itinerary (the site has no itinerary UI).

**Architecture:** Dependency-free vanilla JS. `planner-core.js` holds pure logic (validation, prompt, schema, parsing, WhatsApp formatting, fetch) and exports via UMD so Node can test it. `planner.js` wires the DOM. `config.js` (gitignored) holds the OpenRouter key; `config.example.js` is committed. Styles live in `styles.css`.

**Spec:** this document plus the approved design in conversation (2026-11-07).

## Constraints

- Name required, max 100; mobile required (Indian 10-digit 6–9, optional +91/0, spaces/dashes/parentheses); email optional, max 200.
- Contact details never enter the prompt.
- Model: `google/gemini-2.5-flash-lite` via `https://openrouter.ai/api/v1/chat/completions`, strict JSON schema, `require_parameters`.
- Plan persists under `bandhan-trials:ai-plan`.
- WhatsApp link uses `https://wa.me/919477624057?text=` and includes name, mobile, optional email and the whole plan.
- No new dependencies; no build step.

## Tasks

1. **Core logic + Node tests.** `planner-core.js` (UMD), `planner-core.test.js` (`node:test`). Validators, date math, prompt, schema, parser, WhatsApp message/URL, `generatePlan`, `normalizeStored`.
2. **Markup.** `index.html`: nav link, `#planner` section with the form and result container, script tags.
3. **DOM wiring.** `planner.js`: read/validate form, loading/error states, generate, render plan with DOM APIs, restore/prefill from localStorage, regenerate/reset.
4. **Styles.** `styles.css`: planner section, fields, chips, plan cards, secondary/ghost buttons, responsive rules.
5. **Config + docs.** `.gitignore`, `config.example.js`, local gitignored `config.js`, README setup/testing notes.
6. **Verify.** `node --test planner-core.test.js`, live OpenRouter smoke test, local server check, `git diff --check`.
7. **Publish.** Commit, push branch to `origin`, open PR against `upstream` (`mayukh-chr/bandhan-trials`).