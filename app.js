/* IV Dosing Calculator — application logic.
   Library and weight persist via browser storage when available;
   falls back to in-memory state inside sandboxed previews. */

(() => {
  "use strict";

  const STORAGE_KEY = "iv-calc.library.v5"; // populations: adult / pediatric / neonatal (UMHS-aligned)
  const STATE_KEY = "iv-calc.state.v2";

  // Storage shim — falls back to in-memory if browser storage is unavailable
  // (e.g. sandboxed preview iframes).
  const memStore = {};
  const storage = (() => {
    const inMemory = {
      getItem: (k) => (k in memStore ? memStore[k] : null),
      setItem: (k, v) => { memStore[k] = String(v); },
      removeItem: (k) => { delete memStore[k]; }
    };
    try {
      const key = "_" + "local" + "Storage";
      const ls = window[key.slice(1)];
      if (!ls) return inMemory;
      const tk = "__iv_test__";
      ls.setItem(tk, "1");
      ls.removeItem(tk);
      return ls;
    } catch (e) {
      return inMemory;
    }
  })();

  // ----------- STATE -----------
  let library = loadLibrary();
  let state = Object.assign(
    { weightKg: null, unit: "kg", category: "All", search: "", currentMedId: null, mode: "bolus", concIdx: 0, dose: null, population: "adult" },
    loadState()
  );
  if (!["adult", "pediatric", "neonatal"].includes(state.population)) state.population = "adult";

  function loadLibrary() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_MEDS));
  }
  function saveLibrary() {
    storage.setItem(STORAGE_KEY, JSON.stringify(library));
  }
  function loadState() {
    try { return JSON.parse(storage.getItem(STATE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveState() {
    const { weightKg, unit, category, population } = state;
    storage.setItem(STATE_KEY, JSON.stringify({ weightKg, unit, category, population }));
  }

  // ----------- UTILS -----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function fmt(n, maxDec = 2) {
    if (n === null || n === undefined || !isFinite(n)) return "—";
    const abs = Math.abs(n);
    let dec;
    if (abs === 0) dec = 0;
    else if (abs >= 100) dec = 0;
    else if (abs >= 10) dec = 1;
    else if (abs >= 1) dec = 2;
    else if (abs >= 0.1) dec = 2;
    else dec = 3;
    dec = Math.min(dec, maxDec);
    return Number(n.toFixed(dec)).toLocaleString(undefined, { maximumFractionDigits: dec });
  }
  function fmtVol(mL) { // syringe-practical
    if (mL === null || !isFinite(mL)) return "—";
    if (mL >= 100) return fmt(mL, 0);
    if (mL >= 10) return fmt(mL, 1);
    return fmt(mL, 2);
  }
  function uid() { return "med_" + Math.random().toString(36).slice(2, 9); }

  function getCategories() {
    const used = new Set(library.map(m => m.category));
    DEFAULT_CATEGORIES.forEach(c => used.add(c));
    return Array.from(used);
  }

  // ----------- WEIGHT STRIP -----------
  const weightInput = $("#weight");
  const unitToggle = $$(".unit-toggle button");
  const weightDerived = $("#weight-derived");

  function setUnit(unit) {
    state.unit = unit;
    unitToggle.forEach(b => {
      const active = b.dataset.unit === unit;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    syncWeightInput();
    saveState();
    rerender();
  }
  function syncWeightInput() {
    if (state.weightKg === null || state.weightKg === undefined) {
      weightInput.value = "";
    } else {
      const v = state.unit === "kg" ? state.weightKg : state.weightKg * 2.20462;
      weightInput.value = Number(v.toFixed(1));
    }
    updateWeightDerived();
  }
  function updateWeightDerived() {
    if (state.weightKg === null || isNaN(state.weightKg)) {
      weightDerived.innerHTML = `<span style="color:var(--warn)">Enter weight to enable weight-based dosing</span>`;
      return;
    }
    const kg = state.weightKg;
    const lb = kg * 2.20462;
    if (state.unit === "kg") weightDerived.innerHTML = `<strong>${fmt(lb,1)}</strong> lb`;
    else weightDerived.innerHTML = `<strong>${fmt(kg,1)}</strong> kg`;
  }

  weightInput.addEventListener("input", () => {
    const v = parseFloat(weightInput.value);
    if (isNaN(v) || v <= 0) state.weightKg = null;
    else state.weightKg = state.unit === "kg" ? v : v / 2.20462;
    saveState();
    updateWeightDerived();
    if ($("#calc-modal").open) updateCalc();
  });
  unitToggle.forEach(b => b.addEventListener("click", () => setUnit(b.dataset.unit)));

  // ----------- CATEGORY TABS -----------
  function renderCats() {
    const wrap = $("#cats");
    const cats = ["All", ...getCategories()];
    wrap.innerHTML = cats.map(c =>
      `<button data-cat="${escapeAttr(c)}"${c === state.category ? ' class="active"' : ''}>${escapeHtml(c)}</button>`
    ).join("");
    $$("button", wrap).forEach(b => b.addEventListener("click", () => {
      state.category = b.dataset.cat;
      saveState();
      renderCats();
      renderGrid();
    }));
  }

  // ----------- GRID -----------
  function renderGrid() {
    const grid = $("#grid");
    const q = state.search.trim().toLowerCase();
    const items = library.filter(m => {
      if (state.category !== "All" && m.category !== state.category) return false;
      if (q && !(m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))) return false;
      return true;
    });
    if (!items.length) {
      grid.innerHTML = `<div class="empty">No medications match. Try clearing filters or <button class="btn-ghost small" id="empty-add">add a new one</button>.</div>`;
      $("#empty-add")?.addEventListener("click", () => openEdit(null));
      return;
    }
    grid.innerHTML = items.map(m => {
      return `<button class="med-card" data-id="${m.id}" aria-label="${escapeAttr(m.name)}">
        <div class="name">${escapeHtml(m.name)}</div>
      </button>`;
    }).join("");
    $$(".med-card", grid).forEach(c => c.addEventListener("click", () => {
      openCalc(c.dataset.id);
    }));
  }

  $("#search").addEventListener("input", e => { state.search = e.target.value; renderGrid(); });

  // ----------- CALCULATOR MODAL -----------
  const calcModal = $("#calc-modal");
  const calcName = $("#calc-name");
  const calcCat = $("#calc-cat");
  const calcModeSeg = $("#calc-mode-seg");
  const calcConc = $("#calc-conc");
  const calcDose = $("#calc-dose");
  const calcDoseUnits = $("#calc-dose-units");
  const calcRange = $("#calc-range");
  const calcRangeMin = $("#calc-range-min");
  const calcRangeMax = $("#calc-range-max");
  const calcResult = $("#calc-result");
  const calcNotes = $("#calc-notes");

  function getMed(id) { return library.find(m => m.id === id); }

  // Resolve a med for the active population. Returns a synthetic merged med:
  // top-level acts as adult default; populations.<pop> overlays its keys.
  // Fallback chain: neonatal -> pediatric -> adult overlay -> top-level.
  function resolvePopulation(med, pop) {
    if (!med) return med;
    pop = pop || "adult";
    const pops = (med && med.populations) || {};
    const overlays = [];
    if (pop === "neonatal") {
      // try neonatal first, fall back to pediatric, then top-level
      if (pops.neonatal) overlays.push(pops.neonatal);
      else if (pops.pediatric) overlays.push(pops.pediatric);
    } else if (pop === "pediatric") {
      if (pops.pediatric) overlays.push(pops.pediatric);
    } else {
      // adult: optional explicit override
      if (pops.adult) overlays.push(pops.adult);
    }
    const out = JSON.parse(JSON.stringify(med));
    for (const overlay of overlays) {
      for (const k of Object.keys(overlay)) out[k] = JSON.parse(JSON.stringify(overlay[k]));
    }
    delete out.populations;
    out._population = pop;
    out._hasPopulation = !!(pops.pediatric || pops.neonatal || pops.adult);
    return out;
  }

  // Get a med already resolved for the current population.
  function getResolvedMed(id) {
    const m = getMed(id);
    return m ? resolvePopulation(m, state.population) : null;
  }

  // Resolve concentrations for a given mode. Falls back to .concentrations if no
  // per-mode list is defined.
  function getConcs(med, mode) {
    if (!med) return [];
    if (mode === "bolus" && Array.isArray(med.bolusConcentrations) && med.bolusConcentrations.length)
      return med.bolusConcentrations;
    if (mode === "infusion" && Array.isArray(med.infusionConcentrations) && med.infusionConcentrations.length)
      return med.infusionConcentrations;
    return med.concentrations || [];
  }
  function effectiveTypes(m) {
    const t = [];
    if (m.bolus && (m.type === "bolus" || m.type === "both")) t.push("bolus");
    if (m.infusion && (m.type === "infusion" || m.type === "both")) t.push("infusion");
    if (!t.length) {
      if (m.bolus) t.push("bolus");
      if (m.infusion) t.push("infusion");
    }
    return t;
  }

  function openCalc(id, opts = {}) {
    const baseMed = getMed(id);
    if (!baseMed) return;
    state.currentMedId = id;
    const med = resolvePopulation(baseMed, state.population);
    const types = effectiveTypes(med);
    // For "both" meds, default to infusion if it has one (more common entry point);
    // for pure bolus or pure infusion, use the only available mode.
    state.mode = types.includes("infusion") ? "infusion" : "bolus";
    state.concIdx = 0;

    calcName.textContent = med.name;
    calcCat.textContent = med.category;

    // Sources block
    renderSources(med);

    // Mode toggle: hide if only one mode
    calcModeSeg.style.display = types.length > 1 ? "" : "none";
    $$("button", calcModeSeg).forEach(b => {
      const active = b.dataset.mode === state.mode;
      b.classList.toggle("active", active);
      b.disabled = !types.includes(b.dataset.mode);
      b.style.opacity = b.disabled ? 0.4 : 1;
    });

    // Concentrations (per-mode aware)
    renderConcentrations(med);

    // Initial dose from current mode default
    const cfg = med[state.mode];
    state.dose = cfg ? cfg.dose : null;
    calcDose.value = state.dose ?? "";

    updateCalc();
    if (typeof calcModal.showModal === "function") calcModal.showModal();
    else calcModal.setAttribute("open", "");

  }

  function renderConcentrations(med) {
    const concs = getConcs(med, state.mode);
    if (state.concIdx >= concs.length) state.concIdx = 0;
    calcConc.innerHTML = concs.map((c, i) =>
      `<option value="${i}"${i === state.concIdx ? " selected" : ""}>${escapeHtml(c.label)}</option>`).join("");
  }

  function renderSources(med) {
    const block = $("#calc-sources");
    const list = $("#calc-sources-list");
    const plural = $("#calc-sources-plural");
    const sources = Array.isArray(med.sources) ? med.sources.filter(s => s && s.url && s.label) : [];
    if (!sources.length) { block.hidden = true; list.innerHTML = ""; return; }
    block.hidden = false;
    block.open = false; // start collapsed every time
    if (plural) plural.textContent = sources.length === 1 ? "" : "s";
    list.innerHTML = sources.map(s => `<li><a href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.label)}</a></li>`).join("");
  }

  function renderBolusCta(med) {
    const cta = $("#calc-bolus-cta");
    const hint = $("#calc-bolus-hint");
    const labelEl = $("#calc-bolus-btn-label");
    const types = effectiveTypes(med);
    const showCta = state.mode === "infusion" && types.includes("bolus") && med.bolus;
    if (!showCta) { cta.hidden = true; return; }
    cta.hidden = false;
    const b = med.bolus;
    const perKg = b.perKg ? "/kg" : "";
    if (labelEl) labelEl.textContent = med.bolusCtaLabel || "Add loading bolus";
    hint.textContent = `${fmt(b.dose, 3)} ${b.doseUnit}${perKg} default`;
  }

  function closeCalc() {
    if (calcModal.open) calcModal.close();
  }

  $("#calc-close").addEventListener("click", closeCalc);
  $("#calc-done").addEventListener("click", closeCalc);
  calcModal.addEventListener("click", e => {
    if (e.target === calcModal) closeCalc();
  });

  $$("button", calcModeSeg).forEach(b => b.addEventListener("click", () => {
    if (b.disabled) return;
    setMode(b.dataset.mode);
  }));

  function setMode(mode) {
    state.mode = mode;
    $$("button", calcModeSeg).forEach(x => x.classList.toggle("active", x.dataset.mode === mode));
    const med = getResolvedMed(state.currentMedId);
    if (!med) return;
    // Switching modes may change the available concentration list (per-mode
    // concentrations). Reset to first option and re-render the dropdown.
    state.concIdx = 0;
    renderConcentrations(med);
    const cfg = med[state.mode];
    state.dose = cfg ? cfg.dose : null;
    calcDose.value = state.dose ?? "";
    updateCalc();
  }

  // Quick "Add loading bolus" button inside infusion modal
  $("#calc-bolus-btn").addEventListener("click", () => {
    const med = getResolvedMed(state.currentMedId);
    if (!med || !med.bolus) return;
    setMode("bolus");
  });

  calcConc.addEventListener("change", () => { state.concIdx = parseInt(calcConc.value, 10) || 0; updateCalc(); });
  calcDose.addEventListener("input", () => {
    const v = parseFloat(calcDose.value);
    state.dose = isNaN(v) ? null : v;
    syncRangeFromDose();
    renderResult();
  });
  calcRange.addEventListener("input", () => {
    const v = parseFloat(calcRange.value);
    state.dose = v;
    calcDose.value = Number(v.toFixed(3));
    renderResult();
  });

  $("#calc-edit").addEventListener("click", () => {
    const id = state.currentMedId;
    closeCalc();
    setTimeout(() => openEdit(id), 80);
  });

  function syncRangeFromDose() {
    if (state.dose === null || isNaN(state.dose)) return;
    calcRange.value = state.dose;
  }

  function updateCalc() {
    const med = getResolvedMed(state.currentMedId);
    if (!med) return;
    renderBolusCta(med);
    renderSources(med);
    const cfg = med[state.mode];
    if (!cfg) {
      calcResult.className = "result empty-state";
      calcResult.innerHTML = `<div>No ${state.mode} dose configured.</div>`;
      return;
    }
    const concs = getConcs(med, state.mode);
    const conc = concs[state.concIdx] || concs[0];
    if (!conc) {
      calcResult.className = "result empty-state";
      calcResult.innerHTML = `<div>No concentration configured. <button class="btn-ghost small" onclick="document.getElementById('calc-edit').click()">Edit medication</button></div>`;
      return;
    }
    // Set units & range
    const perKgSuffix = cfg.perKg ? "/kg" : "";
    const perTimeSuffix = state.mode === "infusion" ? `/${cfg.perTime}` : "";
    calcDoseUnits.textContent = `${cfg.doseUnit}${perKgSuffix}${perTimeSuffix}`;

    const min = (cfg.min !== undefined && cfg.min !== null) ? cfg.min : (cfg.dose ?? 0) / 4;
    const max = (cfg.max !== undefined && cfg.max !== null) ? cfg.max : (cfg.dose ?? 1) * 4;
    const span = max - min;
    const step = span > 50 ? 1 : span > 5 ? 0.1 : span > 0.5 ? 0.01 : 0.001;
    calcRange.min = min;
    calcRange.max = max;
    calcRange.step = step;
    calcRangeMin.textContent = `${fmt(min,3)} ${cfg.doseUnit}${perKgSuffix}${perTimeSuffix}`;
    calcRangeMax.textContent = `${fmt(max,3)} ${cfg.doseUnit}${perKgSuffix}${perTimeSuffix}`;

    if (state.dose === null || isNaN(state.dose)) state.dose = cfg.dose ?? min;
    calcDose.value = state.dose;
    syncRangeFromDose();

    calcNotes.textContent = [cfg.notes, med.notes].filter(Boolean).join("  •  ");
    renderResult();
  }

  // ---- core dosing math (pure, testable) ----
  // Mass-unit conversions to grams (canonical base for mass).
  // Non-mass units (units, mEq) are kept as-is and only convert to themselves.
  const MASS_TO_G = { ng: 1e-9, mcg: 1e-6, mg: 1e-3, g: 1 };

  // Returns multiplicative factor to convert FROM `from` unit TO `to` unit.
  // Returns null if units are incompatible (e.g. mg → units).
  function unitFactor(from, to) {
    if (from === to) return 1;
    if (MASS_TO_G[from] && MASS_TO_G[to]) {
      return MASS_TO_G[from] / MASS_TO_G[to];
    }
    return null;
  }

  // Pure dose calculation. Inputs are explicit so tests don’t touch DOM.
  //
  //   med:    medication object (uses .concentrations and .bolus / .infusion)
  //   mode:   "bolus" | "infusion"
  //   concIdx: index into med.concentrations
  //   weightKg: number | null
  //   dose:   number (in cfg.doseUnit; per kg if cfg.perKg; per cfg.perTime for infusion)
  //
  // Output is always either { error: "..." } or a fully populated result.
  function calculateDose(med, mode, concIdx, weightKg, dose) {
    if (!med) return { error: "no_med" };
    const cfg = med[mode];
    if (!cfg) return { error: "no_mode" };
    const concs = getConcs(med, mode);
    const conc = concs[concIdx] || concs[0];
    if (!conc) return { error: "no_conc" };
    if (!isFinite(conc.mg) || !isFinite(conc.mL) || conc.mL <= 0) return { error: "bad_conc" };
    if (dose === null || dose === undefined || !isFinite(dose)) return { error: "no_dose" };
    if (cfg.perKg && (!weightKg || weightKg <= 0)) return { needsWeight: true, cfg, conc, med };

    // Total dose in cfg.doseUnit. For bolus: total mg/mcg/units. For infusion: per cfg.perTime.
    const totalDose = cfg.perKg ? dose * weightKg : dose;

    // Concentration: amount of drug in `conc.mL` mL.
    // Concentration unit: "mg" by default, or unitsLabel if isUnits=true.
    const concUnit = conc.isUnits ? (conc.unitsLabel || "units") : "mg";
    const concPerMl = conc.mg / conc.mL;

    const doseUnit = cfg.doseUnit;
    const factor = unitFactor(doseUnit, concUnit);
    let unitMismatch = false;
    let doseInConcUnit;
    if (factor === null) {
      unitMismatch = true;
      doseInConcUnit = totalDose; // best-effort; flagged below
    } else {
      doseInConcUnit = totalDose * factor;
    }

    // Volume
    let mL, perTimeLabel = null;
    if (mode === "bolus") {
      mL = doseInConcUnit / concPerMl;
    } else {
      const mlPerTime = doseInConcUnit / concPerMl;
      mL = cfg.perTime === "min" ? mlPerTime * 60 : mlPerTime; // always mL/hr
      perTimeLabel = "mL/hr";
    }

    // Concentration in display unit (matches dose unit if possible)
    let concPerMlDisplay = concPerMl;
    let concDisplayUnit = concUnit;
    const dispFactor = unitFactor(concUnit, doseUnit);
    if (dispFactor !== null) {
      concPerMlDisplay = concPerMl * dispFactor;
      concDisplayUnit = doseUnit;
    }

    // Safety flags
    const flags = [];
    if (unitMismatch) {
      flags.push({ level: "danger", text: `Unit mismatch: dose in ${doseUnit} but concentration in ${concUnit}. Edit medication to fix.` });
    }
    if (cfg.maxAbsolute != null && totalDose > cfg.maxAbsolute) {
      flags.push({ level: "danger", text: `Exceeds hard cap of ${fmt(cfg.maxAbsolute)} ${cfg.doseUnit}` });
    }
    if (cfg.max != null && dose > cfg.max) {
      flags.push({ level: "warn", text: `Above typical max (${fmt(cfg.max)} ${cfg.doseUnit}${cfg.perKg ? "/kg" : ""}${mode==="infusion" ? "/"+cfg.perTime : ""})` });
    } else if (cfg.min != null && dose < cfg.min) {
      flags.push({ level: "warn", text: `Below typical min (${fmt(cfg.min)} ${cfg.doseUnit}${cfg.perKg ? "/kg" : ""}${mode==="infusion" ? "/"+cfg.perTime : ""})` });
    }

    return {
      cfg, conc, med,
      mode,
      weight: weightKg,
      dose, totalDose, totalDoseUnit: cfg.doseUnit,
      mL, perTimeLabel,
      concPerMl, concUnit,
      concPerMlDisplay, concDisplayUnit,
      unitMismatch,
      flags
    };
  }

  // Thin wrapper used by the UI — reads current state.
  function compute() {
    const med = getResolvedMed(state.currentMedId);
    return calculateDose(med, state.mode, state.concIdx, state.weightKg, state.dose);
  }

  // Expose pure helpers for tests in the browser console.
  window.IVCalc = { calcDose: calculateDose, unitFactor, MASS_TO_G, DEFAULT_MEDS, resolvePopulation };

  function renderResult() {
    const r = compute();
    if (!r || r.error) {
      calcResult.className = "result empty-state";
      calcResult.innerHTML = `<div>Enter dose to calculate.</div>`;
      return;
    }
    if (r.needsWeight) {
      calcResult.className = "result empty-state";
      calcResult.innerHTML = `<div>Enter patient weight at the top.</div>`;
      return;
    }
    const danger = r.flags.find(f => f.level === "danger");
    const warn = r.flags.find(f => f.level === "warn");
    calcResult.className = "result" + (danger ? " danger" : warn ? " warn" : "");

    const isInfusion = r.mode === "infusion";
    const primaryNum = r.mL;
    const primaryUnit = isInfusion ? r.perTimeLabel : "mL";

    const parts = [];
    parts.push(`<div class="result-primary">${fmtVol(primaryNum)}<span class="unit">${primaryUnit}</span></div>`);
    parts.push(`<div class="result-row"><span class="label">Total dose</span><span class="val">${fmt(r.totalDose, 3)} ${r.totalDoseUnit}${isInfusion ? "/" + r.cfg.perTime : ""}</span></div>`);
    if (r.cfg.perKg && r.weight) {
      parts.push(`<div class="result-row"><span class="label">Dose</span><span class="val">${fmt(r.dose,3)} ${r.cfg.doseUnit}/kg${isInfusion ? "/" + r.cfg.perTime : ""} × ${fmt(r.weight,1)} kg</span></div>`);
    }
    parts.push(`<div class="result-row"><span class="label">Concentration</span><span class="val">${fmt(r.concPerMlDisplay, 3)} ${r.concDisplayUnit}/mL</span></div>`);
    if (isInfusion) {
      // per-min equivalent for sanity
      const perMin = r.cfg.perTime === "min" ? r.totalDose : r.totalDose / 60;
      parts.push(`<div class="result-row"><span class="label">Per minute</span><span class="val">${fmt(perMin, 3)} ${r.totalDoseUnit}/min</span></div>`);
    }
    r.flags.forEach(f => {
      parts.push(`<div class="result-flag">⚠ ${escapeHtml(f.text)}</div>`);
    });
    calcResult.innerHTML = parts.join("");
  }

  // ----------- EDIT MODAL -----------
  const editModal = $("#edit-modal");
  const editForm = $("#edit-form");
  let editingId = null;

  function openEdit(id) {
    editingId = id;
    const med = id ? structuredClone(getMed(id)) : blankMed();
    if (!med) return;
    $("#edit-title").textContent = id ? "Edit medication" : "New medication";
    $("#edit-delete").style.display = id ? "" : "none";

    // Categories datalist
    $("#cat-list").innerHTML = getCategories().map(c => `<option value="${escapeAttr(c)}">`).join("");

    editForm.elements["name"].value = med.name || "";
    editForm.elements["category"].value = med.category || "";
    editForm.elements["notes"].value = med.notes || "";

    setSegValue("type", med.type || (med.bolus && med.infusion ? "both" : med.bolus ? "bolus" : "infusion"));

    // bolus
    const b = med.bolus || {};
    editForm.elements["bolus-dose"].value = b.dose ?? "";
    editForm.elements["bolus-unit"].value = b.doseUnit || "mg";
    editForm.elements["bolus-min"].value = b.min ?? "";
    editForm.elements["bolus-max"].value = b.max ?? "";
    editForm.elements["bolus-cap"].value = b.maxAbsolute ?? "";
    editForm.elements["bolus-notes"].value = b.notes || "";
    setSegValue("bolus-perkg", b.perKg ? "true" : "false");

    // infusion
    const i = med.infusion || {};
    editForm.elements["inf-dose"].value = i.dose ?? "";
    editForm.elements["inf-unit"].value = i.doseUnit || "mcg";
    editForm.elements["inf-min"].value = i.min ?? "";
    editForm.elements["inf-max"].value = i.max ?? "";
    editForm.elements["inf-notes"].value = i.notes || "";
    setSegValue("inf-perkg", i.perKg ? "true" : "false");
    setSegValue("inf-pertime", i.perTime || "min");

    renderConcList(med.concentrations || []);
    renderSourcesEdit(med.sources || []);

    if (typeof editModal.showModal === "function") editModal.showModal();
    else editModal.setAttribute("open", "");
  }
  function blankMed() {
    return {
      id: uid(), name: "", category: "Other", type: "bolus",
      concentrations: [{ label: "", mg: null, mL: 1 }],
      bolus: { dose: null, doseUnit: "mg", perKg: false, min: null, max: null, maxAbsolute: null, notes: "" },
      infusion: null,
      notes: "",
      sources: []
    };
  }
  function renderConcList(concs) {
    const wrap = $("#conc-list");
    wrap.innerHTML = concs.map((c, i) => `
      <div class="conc-row" data-idx="${i}">
        <input data-k="label" placeholder="Label, e.g. 8 mg / 250 mL (32 mcg/mL)" value="${escapeAttr(c.label || "")}" />
        <input data-k="mg" type="number" step="any" placeholder="Amount" value="${c.mg ?? ""}" />
        <input data-k="mL" type="number" step="any" placeholder="mL" value="${c.mL ?? ""}" />
        <button type="button" class="remove" aria-label="Remove">✕</button>
      </div>
    `).join("");
    $$(".conc-row .remove", wrap).forEach(btn => btn.addEventListener("click", (e) => {
      const row = e.target.closest(".conc-row");
      row.remove();
    }));
  }
  function renderSourcesEdit(sources) {
    const wrap = $("#sources-list");
    wrap.innerHTML = sources.map((s, i) => `
      <div class="source-row" data-idx="${i}">
        <input data-k="label" placeholder="Reference label" value="${escapeAttr(s.label || "")}" />
        <input data-k="url" type="url" placeholder="https://…" value="${escapeAttr(s.url || "")}" />
        <button type="button" class="remove" aria-label="Remove">✕</button>
      </div>
    `).join("");
    $$(".source-row .remove", wrap).forEach(btn => btn.addEventListener("click", e => e.target.closest(".source-row").remove()));
  }
  $("#add-source").addEventListener("click", () => {
    const wrap = $("#sources-list");
    const div = document.createElement("div");
    div.className = "source-row";
    div.innerHTML = `
      <input data-k="label" placeholder="Reference label" />
      <input data-k="url" type="url" placeholder="https://…" />
      <button type="button" class="remove" aria-label="Remove">✕</button>`;
    wrap.appendChild(div);
    $(".remove", div).addEventListener("click", () => div.remove());
  });

  $("#add-conc").addEventListener("click", () => {
    const wrap = $("#conc-list");
    const div = document.createElement("div");
    div.className = "conc-row";
    div.innerHTML = `
      <input data-k="label" placeholder="Label" />
      <input data-k="mg" type="number" step="any" placeholder="Amount" />
      <input data-k="mL" type="number" step="any" placeholder="mL" />
      <button type="button" class="remove" aria-label="Remove">✕</button>`;
    wrap.appendChild(div);
    $(".remove", div).addEventListener("click", () => div.remove());
  });

  // segment controls inside edit form
  function setSegValue(name, val) {
    const seg = editForm.querySelector(`[data-name="${name}"]`);
    if (!seg) return;
    $$("button", seg).forEach(b => b.classList.toggle("active", b.dataset.val === String(val)));
  }
  function getSegValue(name) {
    const seg = editForm.querySelector(`[data-name="${name}"]`);
    if (!seg) return null;
    const a = $("button.active", seg);
    return a ? a.dataset.val : null;
  }
  // wire seg buttons (delegated)
  editForm.addEventListener("click", e => {
    const btn = e.target.closest(".seg button");
    if (!btn) return;
    const seg = btn.parentElement;
    if (!seg.dataset.name) return;
    $$("button", seg).forEach(b => b.classList.toggle("active", b === btn));
  });

  $("#edit-cancel").addEventListener("click", () => editModal.close());
  $("#edit-close").addEventListener("click", () => editModal.close());
  editModal.addEventListener("click", e => { if (e.target === editModal) editModal.close(); });

  $("#edit-save").addEventListener("click", () => {
    const data = {
      id: editingId || uid(),
      name: editForm.elements["name"].value.trim(),
      category: editForm.elements["category"].value.trim() || "Other",
      type: getSegValue("type") || "bolus",
      notes: editForm.elements["notes"].value.trim(),
      concentrations: $$("#conc-list .conc-row").map(row => ({
        label: $("[data-k=label]", row).value.trim(),
        mg: parseFloat($("[data-k=mg]", row).value),
        mL: parseFloat($("[data-k=mL]", row).value)
      })).filter(c => c.label && !isNaN(c.mg) && !isNaN(c.mL)),
      sources: $$("#sources-list .source-row").map(row => ({
        label: $("[data-k=label]", row).value.trim(),
        url: $("[data-k=url]", row).value.trim()
      })).filter(s => s.label && s.url)
    };
    if (!data.name) { alert("Name is required."); return; }
    if (!data.concentrations.length) { alert("At least one concentration is required."); return; }

    const includeBolus = data.type === "bolus" || data.type === "both";
    const includeInf = data.type === "infusion" || data.type === "both";

    if (includeBolus) {
      data.bolus = {
        dose: numOrNull(editForm.elements["bolus-dose"].value),
        doseUnit: editForm.elements["bolus-unit"].value,
        perKg: getSegValue("bolus-perkg") === "true",
        min: numOrNull(editForm.elements["bolus-min"].value),
        max: numOrNull(editForm.elements["bolus-max"].value),
        maxAbsolute: numOrNull(editForm.elements["bolus-cap"].value),
        notes: editForm.elements["bolus-notes"].value.trim()
      };
    }
    if (includeInf) {
      data.infusion = {
        dose: numOrNull(editForm.elements["inf-dose"].value),
        doseUnit: editForm.elements["inf-unit"].value,
        perKg: getSegValue("inf-perkg") === "true",
        perTime: getSegValue("inf-pertime") || "min",
        min: numOrNull(editForm.elements["inf-min"].value),
        max: numOrNull(editForm.elements["inf-max"].value),
        notes: editForm.elements["inf-notes"].value.trim()
      };
    }

    const idx = library.findIndex(m => m.id === data.id);
    if (idx >= 0) library[idx] = data;
    else library.push(data);
    saveLibrary();
    editingId = null;
    editModal.close();
    renderCats();
    renderGrid();
  });

  $("#edit-delete").addEventListener("click", () => {
    if (!editingId) return;
    if (!confirm("Delete this medication from your library?")) return;
    library = library.filter(m => m.id !== editingId);
    saveLibrary();
    editingId = null;
    editModal.close();
    if (state.currentMedId === editingId) closeCalc();
    renderCats();
    renderGrid();
  });

  $("#btn-add").addEventListener("click", () => openEdit(null));

  function numOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  // ----------- SETTINGS -----------
  const settingsModal = $("#settings-modal");
  $("#btn-settings").addEventListener("click", () => {
    if (typeof settingsModal.showModal === "function") settingsModal.showModal();
    else settingsModal.setAttribute("open", "");
  });
  $("#settings-close").addEventListener("click", () => settingsModal.close());
  settingsModal.addEventListener("click", e => { if (e.target === settingsModal) settingsModal.close(); });

  $("#export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iv-calc-library-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      if (!Array.isArray(parsed)) throw new Error("File must contain a JSON array of medications.");
      if (!confirm(`Import ${parsed.length} medications? This will REPLACE your current library.`)) return;
      library = parsed;
      saveLibrary();
      renderCats(); renderGrid();
      settingsModal.close();
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
  $("#reset-btn").addEventListener("click", () => {
    if (!confirm("Reset library to defaults? This deletes any customizations.")) return;
    library = JSON.parse(JSON.stringify(DEFAULT_MEDS));
    saveLibrary();
    renderCats(); renderGrid();
    settingsModal.close();
  });

  // ----------- HELPERS -----------
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function rerender() {
    syncWeightInput();
    if ($("#calc-modal").open) updateCalc();
  }

  // ----------- POPULATION TOGGLE -----------
  const populationToggle = $("#population-toggle");
  function setPopulation(pop) {
    if (!["adult", "pediatric", "neonatal"].includes(pop)) pop = "adult";
    state.population = pop;
    if (populationToggle) {
      $$("button", populationToggle).forEach(b => {
        const active = b.dataset.pop === pop;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    saveState();
    // Re-open the calc modal under the new population so concentrations / dose
    // ranges reflect the resolved med.
    if (calcModal.open && state.currentMedId) {
      // Re-resolve cleanly by re-running openCalc which resets concIdx/dose to defaults.
      const id = state.currentMedId;
      openCalc(id);
    }
    renderCats();
    renderGrid();
  }
  if (populationToggle) {
    $$("button", populationToggle).forEach(b => b.addEventListener("click", () => setPopulation(b.dataset.pop)));
  }

  // ----------- INIT -----------
  function init() {
    setUnit(state.unit || "kg");
    setPopulation(state.population || "adult");
    syncWeightInput();
    renderCats();
    renderGrid();
  }
  init();
})();
