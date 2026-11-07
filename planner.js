"use strict";

/* Wires the AI trip planner form to planner-core.js. All state lives in
 * localStorage; nothing is sent anywhere except the OpenRouter call (to build
 * the plan) and the wa.me link (to send the visitor their own details). */

(function () {
  const STORAGE_KEY = "bandhan-trials:ai-plan";

  const REGION_NAMES = {
    "west-bengal": "West Bengal",
    sikkim: "Sikkim",
    "north-east": "North East India",
  };

  const state = {
    plan: null,
    input: null,
    contact: null,
    status: "idle", // idle | loading | ready | error
    error: null,
  };

  const els = {
    form: document.getElementById("trip-plan-form"),
    tabAI: document.getElementById("tab-plan-ai"),
    tabManual: document.getElementById("tab-plan-manual"),
    tabPlan: document.getElementById("tab-view-plan"),
    tabItinerary: document.getElementById("tab-view-itinerary"),
    errorAlert: document.getElementById("planner-error"),
    plannerPanel: document.getElementById("planner-panel"),
    resultPanel: document.getElementById("planner-result"),
    formError: document.getElementById("trip-form-error"),
    planHeading: document.getElementById("trip-plan-heading"),
    planDays: document.getElementById("trip-plan-days"),
    planTips: document.getElementById("trip-plan-tips"),
    whatsappLink: document.getElementById("planner-whatsapp"),
    regenerateBtn: document.getElementById("trip-regenerate-plan"),
    discardBtn: document.getElementById("trip-discard-plan"),
    submitBtn: document.getElementById("trip-submit-plan"),
  };

  function showError(message) {
    if (!message) {
      els.errorAlert.textContent = "";
      els.errorAlert.hidden = true;
      return;
    }
    els.errorAlert.textContent = message;
    els.errorAlert.hidden = false;
    els.errorAlert.focus();
  }

  function renderPlan() {
    if (!state.plan) {
      els.planDays.innerHTML = "";
      els.planTips.innerHTML = "";
      return;
    }

    els.planHeading.textContent = state.plan.title;
    els.planDays.innerHTML = "";

    const ol = document.createElement("ol");
    ol.className = "plan-days";

    for (const day of state.plan.days) {
      const li = document.createElement("li");
      li.className = "plan-day";

      const header = document.createElement("div");
      header.className = "plan-day-header";

      const dayNum = document.createElement("span");
      dayNum.className = "plan-day-number";
      dayNum.textContent = `Day ${day.day}`;

      const dayDate = document.createElement("span");
      dayDate.className = "plan-day-date";
      dayDate.textContent = day.date || "";

      const dayTitle = document.createElement("h3");
      dayTitle.className = "plan-day-title";
      dayTitle.textContent = day.title;

      header.appendChild(dayNum);
      header.appendChild(dayDate);
      header.appendChild(dayTitle);
      li.appendChild(header);

      const ul = document.createElement("ul");
      ul.className = "plan-stops";

      for (const stop of day.stops) {
        const stopLi = document.createElement("li");
        stopLi.className = "plan-stop";

        const timeSpan = document.createElement("p");
        timeSpan.className = "plan-stop-time";
        timeSpan.textContent =
          { morning: "Morning", afternoon: "Afternoon", evening: "Evening" }[
            stop.time
          ];

        const body = document.createElement("div");
        body.className = "plan-stop-body";

        const activity = document.createElement("p");
        activity.className = "plan-stop-activity";
        activity.textContent = stop.activity;
        body.appendChild(activity);

        if (stop.note) {
          const note = document.createElement("p");
          note.className = "plan-stop-note";
          note.textContent = stop.note;
          body.appendChild(note);
        }

        if (stop.regionSlug) {
          const region = document.createElement("p");
          region.className = "plan-stop-region";
          region.textContent = REGION_NAMES[stop.regionSlug] || stop.regionSlug;
          body.appendChild(region);
        }

        stopLi.appendChild(timeSpan);
        stopLi.appendChild(body);
        ul.appendChild(stopLi);
      }

      li.appendChild(ul);
      ol.appendChild(li);
    }

    els.planDays.appendChild(ol);

    if (state.plan.tips.length > 0) {
      const heading = document.createElement("h3");
      heading.className = "plan-tips-heading";
      heading.textContent = "Good to know";
      els.planTips.appendChild(heading);

      const tipsList = document.createElement("ul");
      tipsList.className = "plan-tips-list";
      for (const tip of state.plan.tips) {
        const tipLi = document.createElement("li");
        tipLi.textContent = tip;
        tipsList.appendChild(tipLi);
      }
      els.planTips.appendChild(tipsList);
    } else {
      els.planTips.innerHTML = "";
    }
  }

  async function handleGenerate(nextInput, nextContact) {
    showError(null);
    els.submitBtn.disabled = true;

    try {
      const plan = await plannerCore.generatePlan(nextInput, {
        apiKey: window.openRouterApiKey || "",
        fetchImpl: fetch,
      });

      state.plan = plan;
      state.input = nextInput;
      state.contact = nextContact;
      state.status = "ready";
      state.error = null;

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ input: nextInput, plan, contact: nextContact }),
      );

      els.plannerPanel.hidden = true;
      els.resultPanel.hidden = false;
      document.getElementById("trip-plan-heading").focus();
      renderPlan();
    } catch (caught) {
      state.status = "error";
      state.error =
        caught && typeof caught.message === "string"
          ? caught.message
          : "Something went wrong while planning. Please try again.";
      showError(state.error);
      els.plannerPanel.hidden = true;
      els.resultPanel.hidden = true;
    } finally {
      els.submitBtn.disabled = false;
    }
  }

  els.tabAI.addEventListener("click", () => {
    els.tabAI.setAttribute("aria-pressed", "true");
    els.tabManual.setAttribute("aria-pressed", "false");
    els.plannerPanel.hidden = false;
    els.resultPanel.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.tabManual.addEventListener("click", () => {
    els.tabAI.setAttribute("aria-pressed", "false");
    els.tabManual.setAttribute("aria-pressed", "true");
    els.plannerPanel.hidden = false;
    els.resultPanel.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.tabPlan.addEventListener("click", () => {
    els.tabPlan.setAttribute("aria-pressed", "true");
    els.tabItinerary.setAttribute("aria-pressed", "false");
    els.plannerPanel.hidden = true;
    els.resultPanel.hidden = false;
    if (state.plan) document.getElementById("trip-plan-heading").focus();
  });

  els.tabItinerary.addEventListener("click", () => {
    els.tabItinerary.setAttribute("aria-pressed", "true");
    els.tabPlan.setAttribute("aria-pressed", "false");
    els.plannerPanel.hidden = false;
    els.resultPanel.hidden = true;
  });

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(els.form);
    const input = {
      regions: formData.getAll("regions").filter(Boolean),
      startDate: formData.get("startDate") || "",
      days: Number(formData.get("days")) || 0,
      travellers: Number(formData.get("travellers")) || 0,
      budget: formData.get("budget") || "comfort",
      pace: formData.get("pace") || "balanced",
      interests: formData.getAll("interests").filter(Boolean),
      notes: formData.get("notes") || "",
    };
    const contact = {
      name: formData.get("name") || "",
      mobile: formData.get("mobile") || "",
      email: formData.get("email") || "",
    };

    if (!plannerCore.isValidInput(input) || !plannerCore.isValidContact(contact)) {
      return;
    }

    await handleGenerate(input, contact);
  });

  els.regenerateBtn.addEventListener("click", () => {
    if (state.input) {
      handleGenerate(state.input, state.contact);
    }
  });

  els.discardBtn.addEventListener("click", () => {
    state.plan = null;
    state.input = null;
    state.contact = null;
    state.status = "idle";
    state.error = null;
    els.plannerPanel.hidden = false;
    els.resultPanel.hidden = true;
    showError(null);
    renderPlan();
  });

  // Restore the last plan (and contact details) once the page loads.
  (function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const normalized = plannerCore.normalizeStored(JSON.parse(raw));
        if (normalized && normalized.plan) {
          state.plan = normalized.plan;
          state.input = normalized.input;
          state.contact = normalized.contact;
          state.status = "ready";
          els.plannerPanel.hidden = true;
          els.resultPanel.hidden = false;
          renderPlan();
        }
      }
    } catch {
      // Corrupt storage: leave the planner empty. Never crashes the page.
    }
  })();
})();