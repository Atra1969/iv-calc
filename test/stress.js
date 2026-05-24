// Stress test for IV dose calculations.
// Loads the same meds.js used by the UI, copies the pure math from app.js,
// and verifies against independently-derived expected values.
//
// Run: node test/stress.js

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Load meds.js into a sandbox — they declare top-level `const` which we can't
// pull through `eval`, so use vm.runInThisContext on a wrapped form.
const medsSrc = fs.readFileSync(path.join(__dirname, "..", "meds.js"), "utf8");
const sandbox = {};
vm.runInNewContext(medsSrc + "\nthis.DEFAULT_MEDS = DEFAULT_MEDS; this.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;", sandbox);
const DEFAULT_MEDS = sandbox.DEFAULT_MEDS;

// ---- Pure math (mirror of app.js calcDose) ----
const MASS_TO_G = { ng: 1e-9, mcg: 1e-6, mg: 1e-3, g: 1 };
function unitFactor(from, to) {
  if (from === to) return 1;
  if (MASS_TO_G[from] && MASS_TO_G[to]) return MASS_TO_G[from] / MASS_TO_G[to];
  return null;
}
function getConcs(med, mode) {
  if (!med) return [];
  if (mode === "bolus" && Array.isArray(med.bolusConcentrations) && med.bolusConcentrations.length)
    return med.bolusConcentrations;
  if (mode === "infusion" && Array.isArray(med.infusionConcentrations) && med.infusionConcentrations.length)
    return med.infusionConcentrations;
  return med.concentrations || [];
}
// Mirror of app.js resolvePopulation. Merges populations.<pop> overlay onto a
// clone of the top-level med. Adult uses top-level by default.
function resolvePopulation(med, pop) {
  if (!med) return med;
  pop = pop || "adult";
  const pops = (med && med.populations) || {};
  const overlays = [];
  if (pop === "neonatal") {
    if (pops.pediatric) overlays.push(pops.pediatric);
    if (pops.neonatal) overlays.push(pops.neonatal);
  } else if (pop === "pediatric") {
    if (pops.pediatric) overlays.push(pops.pediatric);
  } else {
    if (pops.adult) overlays.push(pops.adult);
  }
  const out = JSON.parse(JSON.stringify(med));
  for (const overlay of overlays) {
    for (const k of Object.keys(overlay)) out[k] = JSON.parse(JSON.stringify(overlay[k]));
  }
  delete out.populations;
  return out;
}
function calcDose(med, mode, concIdx, weightKg, dose) {
  if (!med) return { error: "no_med" };
  const cfg = med[mode];
  if (!cfg) return { error: "no_mode" };
  const concs = getConcs(med, mode);
  const conc = concs[concIdx] || concs[0];
  if (!conc) return { error: "no_conc" };
  if (dose === null || dose === undefined || !isFinite(dose)) return { error: "no_dose" };
  if (cfg.perKg && (!weightKg || weightKg <= 0)) return { needsWeight: true };

  const totalDose = cfg.perKg ? dose * weightKg : dose;
  const concUnit = conc.isUnits ? (conc.unitsLabel || "units") : "mg";
  const concPerMl = conc.mg / conc.mL;
  const factor = unitFactor(cfg.doseUnit, concUnit);
  const doseInConcUnit = factor === null ? totalDose : totalDose * factor;

  let mL;
  if (mode === "bolus") mL = doseInConcUnit / concPerMl;
  else mL = cfg.perTime === "min" ? (doseInConcUnit / concPerMl) * 60 : (doseInConcUnit / concPerMl);

  return { totalDose, mL, concPerMl, concUnit, unitMismatch: factor === null };
}

// Pure inverse of calcDose: given a volume (mL for bolus, mL/hr for infusion),
// solve for the dose in cfg.doseUnit (per kg if cfg.perKg).  Mirror of
// solveDoseFromVolumePure() in app.js.
function solveDoseFromVolume(med, mode, concIdx, weightKg, mL) {
  if (!med) return { error: "no_med" };
  const cfg = med[mode];
  if (!cfg) return { error: "no_mode" };
  const concs = getConcs(med, mode);
  const conc = concs[concIdx] || concs[0];
  if (!conc) return { error: "no_conc" };
  if (!isFinite(mL) || mL < 0) return { error: "bad_volume" };
  if (cfg.perKg && (!weightKg || weightKg <= 0)) return { error: "need_weight" };

  const concUnit = conc.isUnits ? (conc.unitsLabel || "units") : "mg";
  const concPerMl = conc.mg / conc.mL;
  const factor = unitFactor(cfg.doseUnit, concUnit);
  if (factor === null) return { error: "unit_mismatch" };

  let totalDoseInConcUnit;
  if (mode === "bolus") totalDoseInConcUnit = mL * concPerMl;
  else {
    const mlPerTime = cfg.perTime === "min" ? mL / 60 : mL;
    totalDoseInConcUnit = mlPerTime * concPerMl;
  }
  const totalDose = totalDoseInConcUnit / factor;
  const dose = cfg.perKg ? totalDose / weightKg : totalDose;
  return { dose, totalDose };
}

// ---- Test harness ----
let pass = 0, fail = 0;
const failures = [];

function approx(a, b, tol = 1e-6) {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return diff / scale < tol;
}

function expect(label, actual, expected, tol = 1e-6) {
  const ok = approx(actual, expected, tol);
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(`FAIL ${label}\n      expected ${expected}\n      got      ${actual}\n      diff     ${(actual - expected).toExponential(3)}`);
  }
}

function findMed(id) {
  const m = DEFAULT_MEDS.find(x => x.id === id);
  if (!m) throw new Error("med not found: " + id);
  return m;
}

// =================================================================
// CASE 1: Hand-calculated reference values for every default med.
// Each entry independently computes the expected mL/hr or mL.
// =================================================================
const CASES = [
  // ---- Pressors: bolus ----
  // Epi push-dose 10 mcg @ 10 mcg/mL = 1 mL
  { id: "epinephrine", mode: "bolus", concIdx: 0, w: null, dose: 10, expMl: 1, expTotal: 10 },
  // Epi push-dose 100 mcg @ 100 mcg/mL = 1 mL
  { id: "epinephrine", mode: "bolus", concIdx: 1, w: null, dose: 100, expMl: 1, expTotal: 100 },
  // Phenylephrine 100 mcg @ 100 mcg/mL = 1 mL
  { id: "phenylephrine", mode: "bolus", concIdx: 0, w: null, dose: 100, expMl: 1, expTotal: 100 },

  // ---- Pressors: infusion ----
  // Epi infusion 5 mg / 250 mL = 20 mcg/mL (UMHS 2023). Dose 0.05 mcg/kg/min × 70 kg = 3.5 mcg/min.
  // mL/min = 3.5/20 = 0.175. mL/hr = 10.5
  { id: "epinephrine", mode: "infusion", concIdx: 0, w: 70, dose: 0.05, expMl: 10.5, expTotal: 3.5 },
  // Norepi 16 mg / 250 mL = 64 mcg/mL (UMHS 2023 single std conc). 0.1 mcg/kg/min × 80 kg = 8 mcg/min → 8/64 mL/min → 7.5 mL/hr
  { id: "norepinephrine", mode: "infusion", concIdx: 0, w: 80, dose: 0.1, expMl: 7.5, expTotal: 8 },
  // Phenylephrine drip (UMHS adult: NOT per-kg; mcg/min) 10 mg / 250 mL = 40 mcg/mL.
  //   100 mcg/min → 2.5 mL/min → 150 mL/hr
  { id: "phenylephrine", mode: "infusion", concIdx: 0, w: null, dose: 100, expMl: 150, expTotal: 100 },
  //   200 mcg/mL conc, 100 mcg/min → 0.5 mL/min → 30 mL/hr
  { id: "phenylephrine", mode: "infusion", concIdx: 1, w: null, dose: 100, expMl: 30, expTotal: 100 },
  // Vasopressin 40 u / 40 mL = 1 u/mL (UMHS 2023). 0.04 u/min ÷ 1 = 0.04 mL/min → 2.4 mL/hr (NOT per kg)
  { id: "vasopressin", mode: "infusion", concIdx: 0, w: null, dose: 0.04, expMl: 2.4, expTotal: 0.04 },
  // Dopamine 800 mg / 250 mL = 3200 mcg/mL (UMHS 2023 std). 5 mcg/kg/min × 80 kg = 400 mcg/min → 400/3200 mL/min → 7.5 mL/hr
  { id: "dopamine", mode: "infusion", concIdx: 0, w: 80, dose: 5, expMl: 7.5, expTotal: 400 },
  // Dobutamine 1000 mg / 250 mL = 4000 mcg/mL (UMHS 2023 std). 5 × 80 = 400 mcg/min → 400/4000 mL/min → 6 mL/hr
  { id: "dobutamine", mode: "infusion", concIdx: 0, w: 80, dose: 5, expMl: 6, expTotal: 400 },

  // ---- Sedation ----
  // Ketamine induction 1.5 mg/kg × 80 kg = 120 mg @ 100 mg/mL = 1.2 mL
  // Ketamine concIdx 0 = 20 mg/mL (user protocol) → 120 mg / 20 = 6 mL
  { id: "ketamine", mode: "bolus", concIdx: 0, w: 80, dose: 1.5, expMl: 6, expTotal: 120 },
  // Ketamine 100 mg/mL at new concIdx 1
  { id: "ketamine", mode: "bolus", concIdx: 1, w: 80, dose: 1.5, expMl: 1.2, expTotal: 120 },
  // Ketamine 50 mg/mL at new concIdx 2: 120 mg → 2.4 mL
  { id: "ketamine", mode: "bolus", concIdx: 2, w: 80, dose: 1.5, expMl: 2.4, expTotal: 120 },
  // Ketamine drip 2500 mg / 250 mL = 10 mg/mL (UMHS 2023). 1 mg/kg/hr × 70 kg = 70 mg/hr → 7 mL/hr
  { id: "ketamine", mode: "infusion", concIdx: 0, w: 70, dose: 1, expMl: 7, expTotal: 70 },
  // (Etomidate removed Round 6 — deleted from library per user request.)
  // Propofol induction 1.5 mg/kg × 80 = 120 mg @ 10 mg/mL = 12 mL
  { id: "propofol", mode: "bolus", concIdx: 0, w: 80, dose: 1.5, expMl: 12, expTotal: 120 },
  // Propofol drip 10 mg/mL. 30 mcg/kg/min × 80 = 2400 mcg/min = 2.4 mg/min → 0.24 mL/min → 14.4 mL/hr
  { id: "propofol", mode: "infusion", concIdx: 0, w: 80, dose: 30, expMl: 14.4, expTotal: 2400 },
  // Midazolam bolus 1 mg/mL. 0.05 mg/kg × 80 = 4 mg → 4 mL
  { id: "midazolam", mode: "bolus", concIdx: 0, w: 80, dose: 0.05, expMl: 4, expTotal: 4 },
  // Midaz 5 mg/mL: 4 mg → 0.8 mL
  { id: "midazolam", mode: "bolus", concIdx: 1, w: 80, dose: 0.05, expMl: 0.8, expTotal: 4 },
  // Midaz drip (UMHS adult: NOT per-kg; mg/hr) 100 mg / 100 mL = 1 mg/mL.
  //   4 mg/hr → 4 mL/hr
  { id: "midazolam", mode: "infusion", concIdx: 0, w: null, dose: 4, expMl: 4, expTotal: 4 },
  // Precedex 4 mcg/mL. 0.5 mcg/kg/hr × 70 = 35 mcg/hr → 8.75 mL/hr
  { id: "dexmedetomidine", mode: "infusion", concIdx: 0, w: 70, dose: 0.5, expMl: 8.75, expTotal: 35 },

  // ---- Analgesics ----
  // Fentanyl bolus 50 mcg/mL. 1 mcg/kg × 70 = 70 mcg → 70/50 = 1.4 mL
  { id: "fentanyl", mode: "bolus", concIdx: 0, w: 70, dose: 1, expMl: 1.4, expTotal: 70 },
  // Fentanyl drip: concIdx 0 = 50 mcg/mL (user protocol, 1500/30) → 50 mcg/hr / 50 = 1 mL/hr
  { id: "fentanyl", mode: "infusion", concIdx: 0, w: null, dose: 50, expMl: 1, expTotal: 50 },
  // Fentanyl drip 10 mcg/mL premix at new concIdx 1 → 5 mL/hr
  { id: "fentanyl", mode: "infusion", concIdx: 1, w: null, dose: 50, expMl: 5, expTotal: 50 },
  // Morphine concIdx 0 = 10 mg/mL (user protocol) → 7 mg / 10 = 0.7 mL
  { id: "morphine", mode: "bolus", concIdx: 0, w: 70, dose: 0.1, expMl: 0.7, expTotal: 7 },
  // Morphine 1 mg/mL at new concIdx 1 → 7 mL
  { id: "morphine", mode: "bolus", concIdx: 1, w: 70, dose: 0.1, expMl: 7, expTotal: 7 },
  // Morphine 5 mg/mL at new concIdx 2 → 1.4 mL
  { id: "morphine", mode: "bolus", concIdx: 2, w: 70, dose: 0.1, expMl: 1.4, expTotal: 7 },
  // Hydromorphone 1 mg/mL. 0.015 × 70 = 1.05 mg → 1.05 mL
  { id: "hydromorphone", mode: "bolus", concIdx: 0, w: 70, dose: 0.015, expMl: 1.05, expTotal: 1.05 },
  // Ketorolac 30 mg/mL. 30 mg → 1 mL
  { id: "ketorolac", mode: "bolus", concIdx: 0, w: null, dose: 30, expMl: 1, expTotal: 30 },

  // ---- Paralytics ----
  // Roc 10 mg/mL. 1.2 mg/kg × 80 = 96 mg → 9.6 mL
  { id: "rocuronium", mode: "bolus", concIdx: 0, w: 80, dose: 1.2, expMl: 9.6, expTotal: 96 },
  // (Succinylcholine removed Round 6 — deleted from library per user request.)
  // Vec 1 mg/mL. 0.1 × 80 = 8 mg → 8 mL
  { id: "vecuronium", mode: "bolus", concIdx: 0, w: 80, dose: 0.1, expMl: 8, expTotal: 8 },

  // ---- Antiarrhythmics ----
  // Amio bolus 50 mg/mL. 150 mg → 3 mL
  { id: "amiodarone", mode: "bolus", concIdx: 0, w: null, dose: 150, expMl: 3, expTotal: 150 },
  // Amio premix 1.5 mg/mL: 150 mg → 100 mL
  { id: "amiodarone", mode: "bolus", concIdx: 1, w: null, dose: 150, expMl: 100, expTotal: 150 },
  // Amio drip 1.8 mg/mL. 1 mg/min → 1/1.8 mL/min → 60/1.8 = 33.333... mL/hr
  { id: "amiodarone", mode: "infusion", concIdx: 0, w: null, dose: 1, expMl: 60/1.8, expTotal: 1 },
  // Adenosine 3 mg/mL. 6 mg → 2 mL
  { id: "adenosine", mode: "bolus", concIdx: 0, w: null, dose: 6, expMl: 2, expTotal: 6 },
  // Lidocaine bolus 20 mg/mL. 1 mg/kg × 80 = 80 mg → 4 mL
  { id: "lidocaine", mode: "bolus", concIdx: 0, w: 80, dose: 1, expMl: 4, expTotal: 80 },
  // Lidocaine 10 mg/mL: 80 mg → 8 mL
  { id: "lidocaine", mode: "bolus", concIdx: 1, w: 80, dose: 1, expMl: 8, expTotal: 80 },
  // Lido drip 8 mg/mL. 2 mg/min → 0.25 mL/min → 15 mL/hr
  { id: "lidocaine", mode: "infusion", concIdx: 0, w: null, dose: 2, expMl: 15, expTotal: 2 },
  // Diltiazem bolus 5 mg/mL. 0.25 × 80 = 20 mg → 4 mL
  { id: "diltiazem", mode: "bolus", concIdx: 0, w: 80, dose: 0.25, expMl: 4, expTotal: 20 },
  // Dilt drip 1 mg/mL. 10 mg/hr → 10 mL/hr
  { id: "diltiazem", mode: "infusion", concIdx: 0, w: null, dose: 10, expMl: 10, expTotal: 10 },
  // Esmolol 10 mg/mL = 10000 mcg/mL. 50 mcg/kg/min × 80 = 4000 mcg/min → 4000/10000 = 0.4 mL/min → 24 mL/hr
  { id: "esmolol", mode: "infusion", concIdx: 0, w: 80, dose: 50, expMl: 24, expTotal: 4000 },
  // Atropine 0.1 mg/mL. 1 mg → 10 mL
  { id: "atropine", mode: "bolus", concIdx: 0, w: null, dose: 1, expMl: 10, expTotal: 1 },

  // ---- Anticonvulsants ----
  // Lorazepam 2 mg/mL. 0.1 × 80 = 8 mg → 4 mL  (note: cap is 4 mg/dose, but math math)
  { id: "lorazepam", mode: "bolus", concIdx: 0, w: 80, dose: 0.1, expMl: 4, expTotal: 8 },
  // Levetiracetam 100 mg/mL. 60 × 70 = 4200 mg → 42 mL
  { id: "levetiracetam", mode: "bolus", concIdx: 0, w: 70, dose: 60, expMl: 42, expTotal: 4200 },
  // Fosphenytoin 50 mg PE/mL. 20 × 70 = 1400 mg → 28 mL
  { id: "fosphenytoin", mode: "bolus", concIdx: 0, w: 70, dose: 20, expMl: 28, expTotal: 1400 },

  // ---- Reversal ----
  // Naloxone 0.4 mg/mL. 0.4 mg → 1 mL
  { id: "naloxone", mode: "bolus", concIdx: 0, w: null, dose: 0.4, expMl: 1, expTotal: 0.4 },
  // Naloxone 1 mg/mL: 0.4 mg → 0.4 mL
  { id: "naloxone", mode: "bolus", concIdx: 1, w: null, dose: 0.4, expMl: 0.4, expTotal: 0.4 },
  // Flumazenil 0.1 mg/mL. 0.2 mg → 2 mL
  { id: "flumazenil", mode: "bolus", concIdx: 0, w: null, dose: 0.2, expMl: 2, expTotal: 0.2 },
  // Calcium gluconate 100 mg/mL. 1000 mg → 10 mL
  { id: "calcium_gluconate", mode: "bolus", concIdx: 0, w: null, dose: 1000, expMl: 10, expTotal: 1000 },
  // Sodium bicarb 1 mEq/mL, 1 mEq/kg × 70 = 70 mEq → 70 mL
  { id: "sodium_bicarb", mode: "bolus", concIdx: 0, w: 70, dose: 1, expMl: 70, expTotal: 70 },

  // ---- Electrolytes ----
  // Mag 500 mg/mL. 2000 mg → 4 mL
  { id: "magnesium", mode: "bolus", concIdx: 0, w: null, dose: 2000, expMl: 4, expTotal: 2000 },
  // Mag premix 20 mg/mL: 2000 mg → 100 mL
  { id: "magnesium", mode: "bolus", concIdx: 1, w: null, dose: 2000, expMl: 100, expTotal: 2000 },
  // Potassium: 10 mEq/100 mL → 0.1 mEq/mL. 10 mEq/hr → 100 mL/hr
  { id: "potassium", mode: "infusion", concIdx: 0, w: null, dose: 10, expMl: 100, expTotal: 10 },
  // D50: 500 mg/mL. 25000 mg → 50 mL
  { id: "dextrose50", mode: "bolus", concIdx: 0, w: null, dose: 25000, expMl: 50, expTotal: 25000 },

  // ---- Other ----
  // Heparin bolus 100 u/mL. 80 u/kg × 80 = 6400 u → 64 mL
  { id: "heparin", mode: "bolus", concIdx: 0, w: 80, dose: 80, expMl: 64, expTotal: 6400 },
  // Heparin bolus 1000 u/mL: 6400 u → 6.4 mL
  { id: "heparin", mode: "bolus", concIdx: 1, w: 80, dose: 80, expMl: 6.4, expTotal: 6400 },
  // Heparin drip 100 u/mL. 18 u/kg/hr × 80 = 1440 u/hr → 14.4 mL/hr
  { id: "heparin", mode: "infusion", concIdx: 0, w: 80, dose: 18, expMl: 14.4, expTotal: 1440 },
  // TXA 100 mg/mL. 1000 mg → 10 mL
  { id: "tranexamic", mode: "bolus", concIdx: 0, w: null, dose: 1000, expMl: 10, expTotal: 1000 },
  // === User-protocol concentration tests (defaults must match carried concentrations) ===
  // Vecuronium infusion @ user-protocol 1 mg/mL = 1000 mcg/mL. 1 mcg/kg/min × 80 = 80 mcg/min → 80/1000 = 0.08 mL/min → 4.8 mL/hr
  { id: "vecuronium", mode: "infusion", concIdx: 0, w: 80, dose: 1, expMl: 4.8, expTotal: 80 },
  // Vecuronium infusion premix 200 mcg/mL at new concIdx 1
  { id: "vecuronium", mode: "infusion", concIdx: 1, w: 80, dose: 1, expMl: 24, expTotal: 80 },
  // 3% Saline (hypertonic): 3 mL/kg × 70 kg → 210 mL
  { id: "hypertonic_saline_3", mode: "bolus", concIdx: 0, w: 70, dose: 3, expMl: 210, expTotal: 210 },
  // Nicardipine 0.1 mg/mL. 5 mg/hr → 50 mL/hr
  { id: "nicardipine", mode: "infusion", concIdx: 0, w: null, dose: 5, expMl: 50, expTotal: 5 },
  // NTG 200 mcg/mL. 10 mcg/min → 0.05 mL/min → 3 mL/hr
  { id: "nitroglycerin", mode: "infusion", concIdx: 0, w: null, dose: 10, expMl: 3, expTotal: 10 },
  // NTG 400 mcg/mL: 10 mcg/min → 0.025 → 1.5 mL/hr
  { id: "nitroglycerin", mode: "infusion", concIdx: 1, w: null, dose: 10, expMl: 1.5, expTotal: 10 },
  // Labetalol 5 mg/mL. 10 mg → 2 mL
  { id: "labetalol", mode: "bolus", concIdx: 0, w: null, dose: 10, expMl: 2, expTotal: 10 },
  // Hydralazine 20 mg/mL. 10 mg → 0.5 mL
  { id: "hydralazine", mode: "bolus", concIdx: 0, w: null, dose: 10, expMl: 0.5, expTotal: 10 },
  // Zofran 2 mg/mL. 4 mg → 2 mL
  { id: "ondansetron", mode: "bolus", concIdx: 0, w: null, dose: 4, expMl: 2, expTotal: 4 },
  // Veletri 0.5 mg / 100 mL = 5,000 ng/mL. 50 kg × 25 ng/kg/min = 1250 ng/min → 15 mL/hr
  { id: "epoprostenol", mode: "infusion", concIdx: 0, w: 50, dose: 25, expMl: 15, expTotal: 1250 },
  // Veletri 1.5 mg / 100 mL = 15,000 ng/mL. 70 kg × 10 ng/kg/min = 700 ng/min → 2.8 mL/hr
  { id: "epoprostenol", mode: "infusion", concIdx: 1, w: 70, dose: 10, expMl: 2.8, expTotal: 700 },
  // Alprostadil 2 mcg/mL. 3 kg neonate × 0.05 mcg/kg/min = 0.15 mcg/min → 4.5 mL/hr
  { id: "alprostadil", mode: "infusion", concIdx: 0, w: 3, dose: 0.05, expMl: 4.5, expTotal: 0.15 },
  // Alprostadil 10 mcg/mL. 4 kg × 0.1 mcg/kg/min = 0.4 mcg/min → 2.4 mL/hr
  { id: "alprostadil", mode: "infusion", concIdx: 2, w: 4, dose: 0.1, expMl: 2.4, expTotal: 0.4 },
  // THAM 0.3 M, 70 kg × 5 mL/kg = 350 mL
  { id: "tham", mode: "bolus", concIdx: 0, w: 70, dose: 5, expMl: 350, expTotal: 350 },
];

console.log(`\n=== Pass 1: ${CASES.length} hand-calculated reference cases (adult) ===`);
for (const c of CASES) {
  const med = resolvePopulation(findMed(c.id), "adult");
  const r = calcDose(med, c.mode, c.concIdx, c.w, c.dose);
  if (r.error) { fail++; failures.push(`FAIL ${c.id}/${c.mode}: error ${r.error}`); continue; }
  if (r.needsWeight) { fail++; failures.push(`FAIL ${c.id}/${c.mode}: needsWeight`); continue; }
  expect(`${c.id} ${c.mode} #${c.concIdx} mL`, r.mL, c.expMl, 1e-9);
  expect(`${c.id} ${c.mode} #${c.concIdx} totalDose`, r.totalDose, c.expTotal, 1e-9);
  if (r.unitMismatch) { fail++; failures.push(`FAIL ${c.id}: unexpected unit mismatch`); }
}

// =================================================================
// CASE 1b: UMHS pediatric hand-calculated reference cases.
// Uses resolvePopulation(med, "pediatric") to overlay UMHS PICU dosing.
// =================================================================
const PED_CASES = [
  // Pediatric epi 10 kg @ 0.05 mcg/kg/min, 16 mcg/mL conc → 0.5 mcg/min × 60 / 16 = 1.875 mL/hr
  { id: "epinephrine", mode: "infusion", concIdx: 0, w: 10, dose: 0.05, expMl: 1.875, expTotal: 0.5 },
  // Pediatric propofol 20 kg @ 100 mcg/kg/min, 10 mg/mL = 10000 mcg/mL → 2000 mcg/min × 60 / 10000 = 12 mL/hr
  { id: "propofol", mode: "infusion", concIdx: 0, w: 20, dose: 100, expMl: 12, expTotal: 2000 },
  // Pediatric fentanyl 10 kg @ 1 mcg/kg/hr; after reorder, concIdx 0 = 50 mcg/mL (user protocol) → 10/50 = 0.2 mL/hr
  { id: "fentanyl", mode: "infusion", concIdx: 0, w: 10, dose: 1, expMl: 0.2, expTotal: 10 },
  // Same case, original 10 mcg/mL premix at new concIdx 1
  { id: "fentanyl", mode: "infusion", concIdx: 1, w: 10, dose: 1, expMl: 1, expTotal: 10 },
  // Pediatric nicardipine 20 kg @ 1 mcg/kg/min, 0.1 mg/mL = 100 mcg/mL → 20 mcg/min × 60 / 100 = 12 mL/hr
  { id: "nicardipine", mode: "infusion", concIdx: 0, w: 20, dose: 1, expMl: 12, expTotal: 20 },
  // Pediatric midazolam 15 kg @ 50 mcg/kg/hr, 1 mg/mL = 1000 mcg/mL → 750 mcg/hr / 1000 = 0.75 mL/hr
  { id: "midazolam", mode: "infusion", concIdx: 0, w: 15, dose: 50, expMl: 0.75, expTotal: 750 },
];
console.log(`\n=== Pass 1b: ${PED_CASES.length} UMHS pediatric reference cases ===`);
for (const c of PED_CASES) {
  const med = resolvePopulation(findMed(c.id), "pediatric");
  const r = calcDose(med, c.mode, c.concIdx, c.w, c.dose);
  if (r.error) { fail++; failures.push(`FAIL ped ${c.id}/${c.mode}: error ${r.error}`); continue; }
  if (r.needsWeight) { fail++; failures.push(`FAIL ped ${c.id}/${c.mode}: needsWeight`); continue; }
  expect(`ped ${c.id} ${c.mode} #${c.concIdx} mL`, r.mL, c.expMl, 1e-9);
  expect(`ped ${c.id} ${c.mode} #${c.concIdx} totalDose`, r.totalDose, c.expTotal, 1e-9);
}

// =================================================================
// CASE 1c: Neonatal fall-through tests.
// Neonatal med without explicit neonatal block should fall back to pediatric
// (or to top-level if neither exists).
// =================================================================
const NEO_CASES = [
  // Neonatal alprostadil 3 kg @ 0.05 mcg/kg/min, 2 mcg/mL → 0.15 mcg/min × 60 / 2 = 4.5 mL/hr
  // Whether explicit neonatal block exists or it falls through to peds/top-level,
  // alprostadil's dosing is identical for neonates.
  { id: "alprostadil", mode: "infusion", concIdx: 0, w: 3, dose: 0.05, expMl: 4.5, expTotal: 0.15 },
];
console.log(`\n=== Pass 1c: ${NEO_CASES.length} neonatal cases ===`);
for (const c of NEO_CASES) {
  const med = resolvePopulation(findMed(c.id), "neonatal");
  const r = calcDose(med, c.mode, c.concIdx, c.w, c.dose);
  if (r.error) { fail++; failures.push(`FAIL neo ${c.id}/${c.mode}: error ${r.error}`); continue; }
  if (r.needsWeight) { fail++; failures.push(`FAIL neo ${c.id}/${c.mode}: needsWeight`); continue; }
  expect(`neo ${c.id} ${c.mode} #${c.concIdx} mL`, r.mL, c.expMl, 1e-9);
  expect(`neo ${c.id} ${c.mode} #${c.concIdx} totalDose`, r.totalDose, c.expTotal, 1e-9);
}

// =================================================================
// CASE 1d: Resolver structural tests — verify overlay merges per spec.
// =================================================================
console.log(`\n=== Pass 1d: resolver structural tests ===`);
{
  const epi = findMed("epinephrine");
  const adult = resolvePopulation(epi, "adult");
  const ped = resolvePopulation(epi, "pediatric");
  // Adult infusion default 0.1 mcg/kg/min
  if (adult.infusion && adult.infusion.dose === 0.1) pass++;
  else { fail++; failures.push(`adult epi infusion.dose expected 0.1, got ${adult.infusion && adult.infusion.dose}`); }
  // Pediatric overlay should change infusion default to 0.05 mcg/kg/min
  if (ped.infusion && ped.infusion.dose === 0.05) pass++;
  else { fail++; failures.push(`ped epi infusion.dose expected 0.05, got ${ped.infusion && ped.infusion.dose}`); }
  // Resolver must strip the `populations` key from output
  if (adult.populations === undefined && ped.populations === undefined) pass++;
  else { fail++; failures.push(`resolver should strip .populations`); }
  // Bolus block must survive (not present in pediatric overlay → falls through to top-level)
  if (ped.bolus && ped.bolus.dose === 10) pass++;
  else { fail++; failures.push(`ped epi bolus.dose expected 10 (from top-level), got ${ped.bolus && ped.bolus.dose}`); }
}
{
  // Neonatal fallback: drug with no neonatal block should use pediatric values.
  const epi = findMed("epinephrine");
  const neo = resolvePopulation(epi, "neonatal");
  if (neo.infusion && neo.infusion.dose === 0.05) pass++;
  else { fail++; failures.push(`neo epi (fallback) infusion.dose expected 0.05, got ${neo.infusion && neo.infusion.dose}`); }
}
{
  // Drug with NO populations block at all should resolve to identical top-level for any pop.
  const tham = findMed("tham");
  if (tham) {
    const adult = resolvePopulation(tham, "adult");
    const ped = resolvePopulation(tham, "pediatric");
    if (JSON.stringify(adult) === JSON.stringify(ped)) pass++;
    else { fail++; failures.push(`tham adult/ped should be identical (no populations override)`); }
  }
}

// =================================================================
// CASE 2: Property tests with random inputs.
// For each med, sample many doses; reverse the math; ensure consistency.
// =================================================================
console.log(`\n=== Pass 2: random property tests ===`);
let propRuns = 0;
function rand(min, max) { return min + Math.random() * (max - min); }

for (const baseMed of DEFAULT_MEDS) {
  for (const pop of ["adult", "pediatric", "neonatal"]) {
    const med = resolvePopulation(baseMed, pop);
    for (const mode of ["bolus", "infusion"]) {
      const cfg = med[mode];
      if (!cfg) continue;
      const concs = getConcs(med, mode);
      for (let ci = 0; ci < concs.length; ci++) {
        for (let trial = 0; trial < 10; trial++) {
          const w = cfg.perKg ? rand(2, 200) : null;
          const dose = rand(cfg.min ?? 0.001, cfg.max ?? 100);
          const r = calcDose(med, mode, ci, w, dose);
          if (r.error) { fail++; failures.push(`prop ${med.id}/${pop}/${mode}: ${r.error}`); continue; }
          if (r.needsWeight) { fail++; failures.push(`prop ${med.id}/${pop}/${mode}: needs weight`); continue; }
          if (!isFinite(r.mL) || r.mL <= 0) {
            fail++; failures.push(`prop ${med.id}/${pop}/${mode}: bad mL ${r.mL}`); continue;
          }
          // Verify totalDose math
          const expTotal = cfg.perKg ? dose * w : dose;
          expect(`prop ${med.id}/${pop}/${mode} totalDose`, r.totalDose, expTotal, 1e-9);

          // Verify reverse math: given mL output, recompute dose and check round-trip
          const concPerMl = concs[ci].mg / concs[ci].mL;
          let mlPerTime;
          if (mode === "bolus") mlPerTime = r.mL;
          else mlPerTime = cfg.perTime === "min" ? r.mL / 60 : r.mL;
          const doseInConc = mlPerTime * concPerMl;
          const concUnit = concs[ci].isUnits ? (concs[ci].unitsLabel || "units") : "mg";
          const factor = unitFactor(cfg.doseUnit, concUnit);
          if (factor !== null) {
            const reverseTotal = doseInConc / factor;
            expect(`prop ${med.id}/${pop}/${mode} reverse total`, reverseTotal, expTotal, 1e-9);
          }
          // Verify mL is consistent with concentration & total dose
          if (factor !== null && mode === "bolus") {
            expect(`prop ${med.id}/${pop}/bolus mL→dose`, (r.mL * concPerMl) / factor, expTotal, 1e-9);
          }
          propRuns++;
        }
      }
    }
  }
}

// =================================================================
// CASE 3: Unit conversion table — explicit checks
// =================================================================
console.log(`\n=== Pass 3: unit conversion table ===`);
expect("mcg→mg", unitFactor("mcg", "mg"), 1e-3);
expect("mg→mcg", unitFactor("mg", "mcg"), 1000);
expect("g→mg", unitFactor("g", "mg"), 1000);
expect("mg→g", unitFactor("mg", "g"), 1e-3);
expect("mcg→g", unitFactor("mcg", "g"), 1e-6);
expect("g→mcg", unitFactor("g", "mcg"), 1e6);
expect("mg→mg (identity)", unitFactor("mg", "mg"), 1);
if (unitFactor("mg", "units") !== null) { fail++; failures.push("FAIL mg→units should be null"); } else pass++;
if (unitFactor("units", "mg") !== null) { fail++; failures.push("FAIL units→mg should be null"); } else pass++;
if (unitFactor("mEq", "mg") !== null) { fail++; failures.push("FAIL mEq→mg should be null"); } else pass++;

// =================================================================
// CASE 4: Mixed-unit dosing (e.g. dose in mcg but conc labeled in mg).
// Build a synthetic med to verify a synthetic conversion.
// =================================================================
console.log(`\n=== Pass 4: cross-unit synthetic cases ===`);
// "drug X" 8 mg in 250 mL = 32 mcg/mL. Dose 0.1 mcg/kg/min × 80 kg = 8 mcg/min.
//  Expected mL/hr = (8 / 32) * 60 = 15 mL/hr
const synthA = {
  id: "synth_a", name: "synth A",
  concentrations: [{ label: "8 mg / 250 mL", mg: 8, mL: 250 }],
  infusion: { dose: 0.1, doseUnit: "mcg", perKg: true, perTime: "min", min: 0.01, max: 1 }
};
{
  const r = calcDose(synthA, "infusion", 0, 80, 0.1);
  expect("synthA mL/hr", r.mL, 15, 1e-9);
  expect("synthA totalDose", r.totalDose, 8, 1e-9); // 8 mcg/min
}
// "drug Y" 1 g in 500 mL = 2 mg/mL = 2000 mcg/mL. Dose 50 mcg/kg/min × 80 = 4000 mcg/min
//  Expected mL/hr = 4000/2000 * 60 = 120
const synthB = {
  id: "synth_b", name: "synth B",
  concentrations: [{ label: "1 g / 500 mL", mg: 1, mL: 500 }], // BUT we'd need 'g' as conc unit
  // The schema only supports mg or units. So encode 1 g as 1000 mg:
};
synthB.concentrations[0].mg = 1000;
synthB.infusion = { dose: 50, doseUnit: "mcg", perKg: true, perTime: "min", min: 1, max: 200 };
{
  const r = calcDose(synthB, "infusion", 0, 80, 50);
  expect("synthB mL/hr", r.mL, 120, 1e-9);
}

// Heparin-like: dose units & conc units = "units". Verify direct identity.
const synthC = {
  id: "synth_c", name: "synth C heparin",
  concentrations: [{ label: "25,000 u / 250 mL", mg: 25000, mL: 250, isUnits: true, unitsLabel: "units" }],
  infusion: { dose: 18, doseUnit: "units", perKg: true, perTime: "hr", min: 12, max: 18 }
};
{
  const r = calcDose(synthC, "infusion", 0, 80, 18);
  // 18 u/kg/hr × 80 = 1440 u/hr; conc 25000/250 = 100 u/mL → 14.4 mL/hr
  expect("synthC heparin mL/hr", r.mL, 14.4, 1e-9);
  expect("synthC heparin total u/hr", r.totalDose, 1440, 1e-9);
}

// Mismatched units detection (mg dose vs units conc) — should flag, not silently break
const synthD = {
  id: "synth_d", name: "synth D mismatch",
  concentrations: [{ label: "100 u/mL", mg: 100, mL: 1, isUnits: true, unitsLabel: "units" }],
  bolus: { dose: 5, doseUnit: "mg", perKg: false, min: 1, max: 10 }
};
{
  const r = calcDose(synthD, "bolus", 0, null, 5);
  if (!r.unitMismatch) { fail++; failures.push("FAIL synthD: should report unit mismatch"); }
  else pass++;
}

// =================================================================
// CASE 5: Edge cases
// =================================================================
console.log(`\n=== Pass 5: edge cases ===`);
// Zero weight on perKg
{
  const r = calcDose(findMed("norepinephrine"), "infusion", 0, 0, 0.1);
  if (!r.needsWeight) { fail++; failures.push("zero-weight should require weight"); } else pass++;
}
// Null weight on non-perKg
{
  const r = calcDose(findMed("vasopressin"), "infusion", 0, null, 0.04);
  // 40 u / 40 mL = 1 u/mL; 0.04 u/min → 2.4 mL/hr
  expect("vasopressin no-weight mL/hr", r.mL, 2.4, 1e-9);
}
// Negative weight on perKg
{
  const r = calcDose(findMed("norepinephrine"), "infusion", 0, -10, 0.1);
  if (!r.needsWeight) { fail++; failures.push("neg weight should require weight"); } else pass++;
}
// Concentration with mL > 1 (premix bag) — already tested via amio bolus 1.5 mg/mL
// Tiny weight (3 kg neonate) round trip
{
  const r = calcDose(findMed("epinephrine"), "infusion", 0, 3, 0.1);
  // 0.1 × 3 = 0.3 mcg/min; 20 mcg/mL (UMHS 2023) → 0.015 mL/min → 0.9 mL/hr
  expect("3kg epi drip", r.mL, 0.9, 1e-9);
}
// Massive dose (>= cap) still computes
{
  // Use concIdx 1 (100 mg/mL after user-protocol reorder) so this exercises a high-conc oversized case.
  const r = calcDose(findMed("ketamine"), "bolus", 1, 200, 5);
  // 5 × 200 = 1000 mg / 100 mg/mL = 10 mL
  expect("oversized ketamine still computes", r.mL, 10, 1e-9);
  if (r.totalDose <= findMed("ketamine").bolus.maxAbsolute) {
    fail++; failures.push("ketamine over-cap totalDose should exceed cap");
  } else pass++;
}

// =================================================================
// CASE 6: Reverse-calc round trips.
// For every forward case (adult + pediatric), feed the computed mL into
// solveDoseFromVolume() and confirm it returns the original dose.  This
// validates the inverse function against every dose/mode/concentration/
// per-kg/units permutation in the library.
// =================================================================
console.log(`\n=== Pass 6: reverse-calc round trips ===`);
for (const c of CASES) {
  const med = findMed(c.id);
  const forward = calcDose(med, c.mode, c.concIdx, c.w, c.dose);
  if (forward.error || forward.needsWeight) continue;
  const back = solveDoseFromVolume(med, c.mode, c.concIdx, c.w, forward.mL);
  if (back.error) {
    fail++; failures.push(`FAIL reverse ${c.id}/${c.mode}: ${back.error}`);
    continue;
  }
  expect(`reverse ${c.id} ${c.mode} #${c.concIdx} dose`, back.dose, c.dose, 1e-9);
}
for (const c of PED_CASES) {
  const med = resolvePopulation(findMed(c.id), "pediatric");
  const forward = calcDose(med, c.mode, c.concIdx, c.w, c.dose);
  if (forward.error || forward.needsWeight) continue;
  const back = solveDoseFromVolume(med, c.mode, c.concIdx, c.w, forward.mL);
  if (back.error) {
    fail++; failures.push(`FAIL reverse ped ${c.id}/${c.mode}: ${back.error}`);
    continue;
  }
  expect(`reverse ped ${c.id} ${c.mode} #${c.concIdx} dose`, back.dose, c.dose, 1e-9);
}
// Spot-check a few extreme volumes solve correctly.
{
  // Vasopressin 40u/40mL = 1u/mL: 2.4 mL/hr → 0.04 u/min
  const r = solveDoseFromVolume(findMed("vasopressin"), "infusion", 0, null, 2.4);
  expect("reverse vasopressin 2.4 mL/hr", r.dose, 0.04, 1e-9);
}
{
  // Norepi 16mg/250mL = 64 mcg/mL, 80kg: 7.5 mL/hr → 0.1 mcg/kg/min
  const r = solveDoseFromVolume(findMed("norepinephrine"), "infusion", 0, 80, 7.5);
  expect("reverse norepi 7.5 mL/hr 80kg", r.dose, 0.1, 1e-9);
}
{
  // Epi bolus 10 mcg/mL: 1 mL → 10 mcg
  const r = solveDoseFromVolume(findMed("epinephrine"), "bolus", 0, null, 1);
  expect("reverse epi bolus 1 mL", r.dose, 10, 1e-9);
}
{
  // Reverse with zero volume → zero dose (defensive)
  const r = solveDoseFromVolume(findMed("norepinephrine"), "infusion", 0, 70, 0);
  expect("reverse norepi 0 mL/hr", r.dose, 0, 1e-9);
}
{
  // Reverse requires weight on perKg meds
  const r = solveDoseFromVolume(findMed("norepinephrine"), "infusion", 0, null, 7.5);
  if (r.error !== "need_weight") {
    fail++; failures.push("reverse norepi w/o weight should require weight");
  } else pass++;
}

// ---- Summary ----
console.log(`\n=== RESULTS ===`);
console.log(`Property test runs: ${propRuns}`);
console.log(`PASSED: ${pass}`);
console.log(`FAILED: ${fail}`);
if (fail) {
  console.log(`\n--- Failures ---\n${failures.slice(0, 25).join("\n")}`);
  if (failures.length > 25) console.log(`... and ${failures.length - 25} more`);
  process.exit(1);
} else {
  console.log("\nAll tests passed.");
}
