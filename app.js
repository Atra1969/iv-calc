/* IV Dosing Calculator — application logic.
   Data persists in localStorage. */

(() => {
  "use strict";

  const STORAGE_KEY = "iv-calc.library.v1";
  const STATE_KEY = "iv-calc.state.v1";

  // ----------- STATE -----------
  let library = loadLibrary();
  let state = Object.assign(
    { weightKg: null, unit: "kg", category: "All", search: "", currentMedId: null, mode: "bolus", concIdx: 0, dose: null },
    loadState()
  );

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_MEDS));
  }
  function saveLibrary() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  }
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveState() {
    const { weightKg, unit, category } = state;
    localStorage.setItem(STATE_KEY, JSON.stringify({ weightKg, unit, category }));
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
      const badges = [];
      if (m.type === "bolus" || m.type === "both" || m.bolus) badges.push(`<span class="badge bolus">Bolus</span>`);
      if (m.type === "infusion" || m.type === "both" || m.infusion) badges.push(`<span class="badge infusion">Drip</span>`);
      return `<button class="med-card" data-id="${m.id}">
        <div class="cat">${escapeHtml(m.category)}</div>
        <div class="name">${escapeHtml(m.name)}</div>
        <div class="badges">${badges.join("")}</div>
      </button>`;
    }).join("");
    $$(".med-card", grid).forEach(c => c.addEventListener("click", () => openCalc(c.dataset.id)));
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

  function openCalc(id) {
    const med = getMed(id);
    if (!med) return;
    state.currentMedId = id;
    const types = effectiveTypes(med);
    state.mode = types.includes("bolus") ? "bolus" : "infusion";
    state.concIdx = 0;

    calcName.textContent = med.name;
    calcCat.textContent = med.category;

    // Mode toggle: hide if only one mode
    calcModeSeg.style.display = types.length > 1 ? "" : "none";
    $$("button", calcModeSeg).forEach(b => {
      const active = b.dataset.mode === state.mode;
      b.classList.toggle("active", active);
      b.disabled = !types.includes(b.dataset.mode);
      b.style.opacity = b.disabled ? 0.4 : 1;
    });

    // Concentrations
    calcConc.innerHTML = (med.concentrations || []).map((c, i) =>
      `<option value="${i}">${escapeHtml(c.label)}</option>`).join("");

    // Initial dose from current mode default
    const cfg = med[state.mode];
    state.dose = cfg ? cfg.dose : null;
    calcDose.value = state.dose ?? "";

    updateCalc();
    if (typeof calcModal.showModal === "function") calcModal.showModal();
    else calcModal.setAttribute("open", "");
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
    state.mode = b.dataset.mode;
    $$("button", calcModeSeg).forEach(x => x.classList.toggle("active", x === b));
    const med = getMed(state.currentMedId);
    const cfg = med[state.mode];
    state.dose = cfg ? cfg.dose : null;
    calcDose.value = state.dose ?? "";
    updateCalc();
  }));

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
    const med = getMed(state.currentMedId);
    if (!med) return;
    const cfg = med[state.mode];
    if (!cfg) {
      calcResult.className = "result empty-state";
      calcResult.innerHTML = `<div>No ${state.mode} dose configured.</div>`;
      return;
    }
    const conc = (med.concentrations || [])[state.concIdx] || (med.concentrations || [])[0];
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

  // ---- core dosing math ----
  function compute() {
    const med = getMed(state.currentMedId);
    if (!med) return null;
    const cfg = med[state.mode];
    if (!cfg) return null;
    const conc = (med.concentrations || [])[state.concIdx] || (med.concentrations || [])[0];
    if (!conc) return null;
    const weight = state.weightKg;
    const dose = state.dose;
    if (dose === null || isNaN(dose)) return null;
    if (cfg.perKg && (!weight || weight <= 0)) {
      return { needsWeight: true, cfg, conc, med };
    }
    // total dose in cfg.doseUnit (per dose for bolus, per minute for infusion)
    const totalDose = cfg.perKg ? dose * weight : dose;

    // convert dose unit to concentration's mass unit (mg) where relevant
    // mg in concentration field is "amount per total mL" (mg, units, or mEq depending on isUnits)
    const concAmount = conc.mg;            // amount of drug in conc.mL volume
    const concVol = conc.mL;
    const concPerMl = concAmount / concVol; // amount per mL
    // figure out unit conversion factor between dose unit and concentration unit
    // concentration default unit:
    //   - normal drug: mg
    //   - isUnits true: 'units' or 'mEq' (carried in unitsLabel, default 'units')
    let concUnit = "mg";
    if (conc.isUnits) concUnit = conc.unitsLabel || "units";
    let doseInConcUnit = totalDose;
    const doseUnit = cfg.doseUnit;
    if (doseUnit !== concUnit) {
      // mass conversions
      if (doseUnit === "mcg" && concUnit === "mg") doseInConcUnit = totalDose / 1000;
      else if (doseUnit === "mg" && concUnit === "mcg") doseInConcUnit = totalDose * 1000;
      else if (doseUnit === "g" && concUnit === "mg") doseInConcUnit = totalDose * 1000;
      else if (doseUnit === "mg" && concUnit === "g") doseInConcUnit = totalDose / 1000;
      else if (doseUnit === "mcg" && concUnit === "g") doseInConcUnit = totalDose / 1e6;
      else if (doseUnit === "g" && concUnit === "mcg") doseInConcUnit = totalDose * 1e6;
      // else: incompatible units - just use raw value (volume calc may be wrong;
      // user should fix via edit)
    }

    let mL, perTimeLabel;
    if (state.mode === "bolus") {
      mL = doseInConcUnit / concPerMl;
    } else {
      // infusion: mL/time → convert to mL/hr if needed
      const mlPerTime = doseInConcUnit / concPerMl;
      if (cfg.perTime === "min") mL = mlPerTime * 60; // mL/hr
      else mL = mlPerTime;                            // already per hour
      perTimeLabel = "mL/hr";
    }

    // safety flags
    const flags = [];
    if (cfg.maxAbsolute && totalDose > cfg.maxAbsolute) {
      flags.push({ level: "danger", text: `Exceeds hard cap of ${fmt(cfg.maxAbsolute)} ${cfg.doseUnit}` });
    }
    if (cfg.max !== undefined && dose > cfg.max) {
      flags.push({ level: "warn", text: `Above typical max (${fmt(cfg.max)} ${cfg.doseUnit}${cfg.perKg ? "/kg" : ""}${state.mode==="infusion" ? "/"+cfg.perTime : ""})` });
    } else if (cfg.min !== undefined && dose < cfg.min) {
      flags.push({ level: "warn", text: `Below typical min (${fmt(cfg.min)} ${cfg.doseUnit}${cfg.perKg ? "/kg" : ""}${state.mode==="infusion" ? "/"+cfg.perTime : ""})` });
    }

    // concPerMl in display unit (matches dose unit)
    let concPerMlDisplay = concPerMl;
    let concDisplayUnit = concUnit;
    if (doseUnit !== concUnit) {
      if (doseUnit === "mcg" && concUnit === "mg") { concPerMlDisplay = concPerMl * 1000; concDisplayUnit = "mcg"; }
      else if (doseUnit === "mg" && concUnit === "mcg") { concPerMlDisplay = concPerMl / 1000; concDisplayUnit = "mg"; }
      else if (doseUnit === "g" && concUnit === "mg") { concPerMlDisplay = concPerMl / 1000; concDisplayUnit = "g"; }
      else if (doseUnit === "mg" && concUnit === "g") { concPerMlDisplay = concPerMl * 1000; concDisplayUnit = "mg"; }
      else if (doseUnit === "mcg" && concUnit === "g") { concPerMlDisplay = concPerMl * 1e6; concDisplayUnit = "mcg"; }
      else if (doseUnit === "g" && concUnit === "mcg") { concPerMlDisplay = concPerMl / 1e6; concDisplayUnit = "g"; }
    }

    return {
      cfg, conc, med, weight,
      dose, totalDose, totalDoseUnit: cfg.doseUnit,
      mL, perTimeLabel,
      concPerMl, concUnit,
      concPerMlDisplay, concDisplayUnit,
      flags
    };
  }

  function renderResult() {
    const r = compute();
    if (!r) {
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

    const isInfusion = state.mode === "infusion";
    const primaryNum = isInfusion ? r.mL : r.mL;
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

    if (typeof editModal.showModal === "function") editModal.showModal();
    else editModal.setAttribute("open", "");
  }
  function blankMed() {
    return {
      id: uid(), name: "", category: "Other", type: "bolus",
      concentrations: [{ label: "", mg: null, mL: 1 }],
      bolus: { dose: null, doseUnit: "mg", perKg: false, min: null, max: null, maxAbsolute: null, notes: "" },
      infusion: null,
      notes: ""
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
      })).filter(c => c.label && !isNaN(c.mg) && !isNaN(c.mL))
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

  // ----------- INIT -----------
  function init() {
    setUnit(state.unit || "kg");
    syncWeightInput();
    renderCats();
    renderGrid();
  }
  init();
})();
