// Default medication library for adult emergency / critical care IV dosing.
// All values are reasonable starting defaults derived from common references
// (ACLS, ASHP, ENA, common flight/critical-care formularies).
// Users can edit, add, or remove any medication at runtime.
//
// Schema:
//   id            : stable identifier
//   name          : display name
//   category      : group tab (Pressors, Sedation, Paralytics, Analgesics,
//                   Antiarrhythmics, Anticonvulsants, Reversal, Electrolytes, Other)
//   type          : "bolus" | "infusion" | "both"
//   concentrations: [{ label, mg, mL }]   -- mass per volume (final concentration)
//                   For unit drugs (heparin, insulin), mg field carries units; isUnits=true
//   bolus         : { dose, doseUnit, perKg, min, max, maxAbsolute, notes }
//                   doseUnit examples: "mg", "mcg", "units", "mEq"
//                   perKg true => dose is per kg
//   infusion      : { dose, doseUnit, perKg, perTime, min, max, notes }
//                   doseUnit: "mcg" | "mg" | "units" | "mEq"
//                   perTime: "min" | "hr"
//   notes         : free text shown under the calculator

const DEFAULT_MEDS = [
  // ---------------- PRESSORS / INOTROPES ----------------
  {
    id: "epinephrine_push",
    name: "Epinephrine (push-dose)",
    category: "Pressors",
    type: "bolus",
    concentrations: [
      { label: "10 mcg/mL (1 mg in 100 mL)", mg: 0.01, mL: 1 },
      { label: "100 mcg/mL (cardiac arrest 1:10,000)", mg: 0.1, mL: 1 }
    ],
    bolus: {
      dose: 10, doseUnit: "mcg", perKg: false,
      min: 5, max: 20, maxAbsolute: 100,
      notes: "Push-dose pressor: 5–20 mcg IV q1–5 min titrated to MAP."
    },
    notes: "Cardiac arrest dose: 1 mg (0.01 mg/kg peds) IV/IO q3–5 min."
  },
  {
    id: "epinephrine_drip",
    name: "Epinephrine (infusion)",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "8 mg / 250 mL (32 mcg/mL)", mg: 8, mL: 250 },
      { label: "4 mg / 250 mL (16 mcg/mL)", mg: 4, mL: 250 }
    ],
    infusion: {
      dose: 0.1, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.01, max: 1.0,
      notes: "Typical 0.01–1 mcg/kg/min. Titrate to MAP ≥ 65."
    }
  },
  {
    id: "norepinephrine",
    name: "Norepinephrine",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "4 mg / 250 mL (16 mcg/mL)", mg: 4, mL: 250 },
      { label: "8 mg / 250 mL (32 mcg/mL)", mg: 8, mL: 250 }
    ],
    infusion: {
      dose: 0.1, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.01, max: 3.0,
      notes: "First-line for septic shock. Typical 0.01–3 mcg/kg/min."
    }
  },
  {
    id: "phenylephrine_push",
    name: "Phenylephrine (push-dose)",
    category: "Pressors",
    type: "bolus",
    concentrations: [
      { label: "100 mcg/mL", mg: 0.1, mL: 1 }
    ],
    bolus: {
      dose: 100, doseUnit: "mcg", perKg: false,
      min: 50, max: 200, maxAbsolute: 500,
      notes: "50–200 mcg IV q1–5 min. Pure alpha — caution in bradycardia."
    }
  },
  {
    id: "phenylephrine_drip",
    name: "Phenylephrine (infusion)",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "20 mg / 250 mL (80 mcg/mL)", mg: 20, mL: 250 }
    ],
    infusion: {
      dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.1, max: 9.0,
      notes: "Typical 0.1–9 mcg/kg/min."
    }
  },
  {
    id: "vasopressin",
    name: "Vasopressin",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "20 units / 100 mL (0.2 u/mL)", mg: 20, mL: 100, isUnits: true }
    ],
    infusion: {
      dose: 0.04, doseUnit: "units", perKg: false, perTime: "min",
      min: 0.01, max: 0.07,
      notes: "Fixed dose 0.01–0.07 units/min (commonly 0.04). Not titrated."
    }
  },
  {
    id: "dopamine",
    name: "Dopamine",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "400 mg / 250 mL (1600 mcg/mL)", mg: 400, mL: 250 },
      { label: "800 mg / 250 mL (3200 mcg/mL)", mg: 800, mL: 250 }
    ],
    infusion: {
      dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 2, max: 20,
      notes: "2–20 mcg/kg/min. >10 = predominant alpha."
    }
  },
  {
    id: "dobutamine",
    name: "Dobutamine",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "500 mg / 250 mL (2000 mcg/mL)", mg: 500, mL: 250 }
    ],
    infusion: {
      dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 2.5, max: 20,
      notes: "Inotrope. 2.5–20 mcg/kg/min."
    }
  },

  // ---------------- SEDATION / INDUCTION ----------------
  {
    id: "ketamine_induction",
    name: "Ketamine (induction)",
    category: "Sedation",
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL", mg: 100, mL: 1 },
      { label: "50 mg/mL", mg: 50, mL: 1 },
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    bolus: {
      dose: 1.5, doseUnit: "mg", perKg: true,
      min: 1, max: 2, maxAbsolute: 200,
      notes: "RSI induction: 1–2 mg/kg IV. Onset 30–60 sec."
    }
  },
  {
    id: "ketamine_drip",
    name: "Ketamine (infusion)",
    category: "Sedation",
    type: "infusion",
    concentrations: [
      { label: "500 mg / 250 mL (2 mg/mL)", mg: 500, mL: 250 }
    ],
    infusion: {
      dose: 1, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 0.5, max: 4,
      notes: "Analgosedation 0.5–4 mg/kg/hr."
    }
  },
  {
    id: "etomidate",
    name: "Etomidate",
    category: "Sedation",
    type: "bolus",
    concentrations: [
      { label: "2 mg/mL", mg: 2, mL: 1 }
    ],
    bolus: {
      dose: 0.3, doseUnit: "mg", perKg: true,
      min: 0.2, max: 0.4, maxAbsolute: 40,
      notes: "RSI induction: 0.3 mg/kg IV. Hemodynamically neutral."
    }
  },
  {
    id: "propofol_induction",
    name: "Propofol (induction)",
    category: "Sedation",
    type: "bolus",
    concentrations: [
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    bolus: {
      dose: 1.5, doseUnit: "mg", perKg: true,
      min: 1, max: 2.5, maxAbsolute: 200,
      notes: "Induction 1–2.5 mg/kg. Reduce in shock/elderly."
    }
  },
  {
    id: "propofol_drip",
    name: "Propofol (infusion)",
    category: "Sedation",
    type: "infusion",
    concentrations: [
      { label: "10 mg/mL (undiluted)", mg: 1000, mL: 100 }
    ],
    infusion: {
      dose: 30, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 5, max: 80,
      notes: "Sedation 5–80 mcg/kg/min. Watch for PRIS at high/long doses."
    }
  },
  {
    id: "midazolam_bolus",
    name: "Midazolam (bolus)",
    category: "Sedation",
    type: "bolus",
    concentrations: [
      { label: "1 mg/mL", mg: 1, mL: 1 },
      { label: "5 mg/mL", mg: 5, mL: 1 }
    ],
    bolus: {
      dose: 0.05, doseUnit: "mg", perKg: true,
      min: 0.02, max: 0.1, maxAbsolute: 5,
      notes: "0.02–0.1 mg/kg IV slow push. Status epilepticus: 0.2 mg/kg IM."
    }
  },
  {
    id: "midazolam_drip",
    name: "Midazolam (infusion)",
    category: "Sedation",
    type: "infusion",
    concentrations: [
      { label: "100 mg / 100 mL (1 mg/mL)", mg: 100, mL: 100 }
    ],
    infusion: {
      dose: 0.05, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 0.02, max: 0.2,
      notes: "0.02–0.2 mg/kg/hr."
    }
  },
  {
    id: "dexmedetomidine",
    name: "Dexmedetomidine (Precedex)",
    category: "Sedation",
    type: "infusion",
    concentrations: [
      { label: "200 mcg / 50 mL (4 mcg/mL)", mg: 0.2, mL: 50 },
      { label: "400 mcg / 100 mL (4 mcg/mL)", mg: 0.4, mL: 100 }
    ],
    infusion: {
      dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "hr",
      min: 0.2, max: 1.5,
      notes: "0.2–1.5 mcg/kg/hr. Optional load 1 mcg/kg over 10 min."
    }
  },

  // ---------------- ANALGESICS ----------------
  {
    id: "fentanyl_bolus",
    name: "Fentanyl (bolus)",
    category: "Analgesics",
    type: "bolus",
    concentrations: [
      { label: "50 mcg/mL", mg: 0.05, mL: 1 }
    ],
    bolus: {
      dose: 1, doseUnit: "mcg", perKg: true,
      min: 0.5, max: 3, maxAbsolute: 200,
      notes: "Analgesia 0.5–1 mcg/kg. RSI pretreatment 3 mcg/kg."
    }
  },
  {
    id: "fentanyl_drip",
    name: "Fentanyl (infusion)",
    category: "Analgesics",
    type: "infusion",
    concentrations: [
      { label: "2500 mcg / 250 mL (10 mcg/mL)", mg: 2.5, mL: 250 }
    ],
    infusion: {
      dose: 1, doseUnit: "mcg", perKg: true, perTime: "hr",
      min: 0.5, max: 5,
      notes: "0.5–5 mcg/kg/hr."
    }
  },
  {
    id: "morphine",
    name: "Morphine",
    category: "Analgesics",
    type: "bolus",
    concentrations: [
      { label: "1 mg/mL", mg: 1, mL: 1 },
      { label: "5 mg/mL", mg: 5, mL: 1 }
    ],
    bolus: {
      dose: 0.1, doseUnit: "mg", perKg: true,
      min: 0.05, max: 0.2, maxAbsolute: 10,
      notes: "0.05–0.2 mg/kg IV."
    }
  },
  {
    id: "hydromorphone",
    name: "Hydromorphone (Dilaudid)",
    category: "Analgesics",
    type: "bolus",
    concentrations: [
      { label: "1 mg/mL", mg: 1, mL: 1 }
    ],
    bolus: {
      dose: 0.015, doseUnit: "mg", perKg: true,
      min: 0.01, max: 0.02, maxAbsolute: 2,
      notes: "0.01–0.02 mg/kg IV q2–4h."
    }
  },
  {
    id: "ketorolac",
    name: "Ketorolac (Toradol)",
    category: "Analgesics",
    type: "bolus",
    concentrations: [
      { label: "30 mg/mL", mg: 30, mL: 1 }
    ],
    bolus: {
      dose: 30, doseUnit: "mg", perKg: false,
      min: 15, max: 30, maxAbsolute: 30,
      notes: "15–30 mg IV. Reduce to 15 mg if >65 yo or <50 kg."
    }
  },

  // ---------------- PARALYTICS ----------------
  {
    id: "rocuronium",
    name: "Rocuronium",
    category: "Paralytics",
    type: "bolus",
    concentrations: [
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    bolus: {
      dose: 1.2, doseUnit: "mg", perKg: true,
      min: 0.6, max: 1.2, maxAbsolute: 150,
      notes: "RSI 1.2 mg/kg. Maintenance 0.1–0.2 mg/kg."
    }
  },
  {
    id: "succinylcholine",
    name: "Succinylcholine",
    category: "Paralytics",
    type: "bolus",
    concentrations: [
      { label: "20 mg/mL", mg: 20, mL: 1 }
    ],
    bolus: {
      dose: 1.5, doseUnit: "mg", perKg: true,
      min: 1, max: 2, maxAbsolute: 200,
      notes: "RSI 1.5 mg/kg IV (2 mg/kg in obese, IBW dosing). Avoid in hyperK, burns >24h, denervation."
    }
  },
  {
    id: "vecuronium",
    name: "Vecuronium",
    category: "Paralytics",
    type: "bolus",
    concentrations: [
      { label: "1 mg/mL (reconstituted)", mg: 1, mL: 1 }
    ],
    bolus: {
      dose: 0.1, doseUnit: "mg", perKg: true,
      min: 0.08, max: 0.15, maxAbsolute: 15,
      notes: "0.08–0.15 mg/kg IV."
    }
  },

  // ---------------- ANTIARRHYTHMICS ----------------
  {
    id: "amiodarone_bolus",
    name: "Amiodarone (bolus)",
    category: "Antiarrhythmics",
    type: "bolus",
    concentrations: [
      { label: "50 mg/mL", mg: 50, mL: 1 },
      { label: "150 mg / 100 mL (1.5 mg/mL)", mg: 150, mL: 100 }
    ],
    bolus: {
      dose: 150, doseUnit: "mg", perKg: false,
      min: 150, max: 300, maxAbsolute: 300,
      notes: "Stable VT/SVT: 150 mg over 10 min. Pulseless VT/VF: 300 mg IV push, then 150 mg."
    }
  },
  {
    id: "amiodarone_drip",
    name: "Amiodarone (infusion)",
    category: "Antiarrhythmics",
    type: "infusion",
    concentrations: [
      { label: "900 mg / 500 mL (1.8 mg/mL)", mg: 900, mL: 500 }
    ],
    infusion: {
      dose: 1, doseUnit: "mg", perKg: false, perTime: "min",
      min: 0.5, max: 1,
      notes: "1 mg/min × 6 hr, then 0.5 mg/min × 18 hr."
    }
  },
  {
    id: "adenosine",
    name: "Adenosine",
    category: "Antiarrhythmics",
    type: "bolus",
    concentrations: [
      { label: "3 mg/mL", mg: 3, mL: 1 }
    ],
    bolus: {
      dose: 6, doseUnit: "mg", perKg: false,
      min: 6, max: 12, maxAbsolute: 12,
      notes: "6 mg rapid IV push, then 12 mg if needed. Follow with 20 mL flush."
    }
  },
  {
    id: "lidocaine_bolus",
    name: "Lidocaine (bolus)",
    category: "Antiarrhythmics",
    type: "bolus",
    concentrations: [
      { label: "20 mg/mL (2%)", mg: 20, mL: 1 },
      { label: "10 mg/mL (1%)", mg: 10, mL: 1 }
    ],
    bolus: {
      dose: 1, doseUnit: "mg", perKg: true,
      min: 1, max: 1.5, maxAbsolute: 100,
      notes: "VT/VF: 1–1.5 mg/kg IV; repeat 0.5–0.75 mg/kg q5–10 min (max 3 mg/kg)."
    }
  },
  {
    id: "lidocaine_drip",
    name: "Lidocaine (infusion)",
    category: "Antiarrhythmics",
    type: "infusion",
    concentrations: [
      { label: "2 g / 250 mL (8 mg/mL)", mg: 2000, mL: 250 }
    ],
    infusion: {
      dose: 2, doseUnit: "mg", perKg: false, perTime: "min",
      min: 1, max: 4,
      notes: "1–4 mg/min."
    }
  },
  {
    id: "diltiazem_bolus",
    name: "Diltiazem (bolus)",
    category: "Antiarrhythmics",
    type: "bolus",
    concentrations: [
      { label: "5 mg/mL", mg: 5, mL: 1 }
    ],
    bolus: {
      dose: 0.25, doseUnit: "mg", perKg: true,
      min: 0.2, max: 0.35, maxAbsolute: 25,
      notes: "0.25 mg/kg IV over 2 min; may repeat 0.35 mg/kg in 15 min."
    }
  },
  {
    id: "diltiazem_drip",
    name: "Diltiazem (infusion)",
    category: "Antiarrhythmics",
    type: "infusion",
    concentrations: [
      { label: "125 mg / 125 mL (1 mg/mL)", mg: 125, mL: 125 }
    ],
    infusion: {
      dose: 10, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 5, max: 15,
      notes: "5–15 mg/hr."
    }
  },
  {
    id: "esmolol_drip",
    name: "Esmolol (infusion)",
    category: "Antiarrhythmics",
    type: "infusion",
    concentrations: [
      { label: "10 mg/mL", mg: 2500, mL: 250 }
    ],
    infusion: {
      dose: 50, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 50, max: 200,
      notes: "Load 500 mcg/kg over 1 min, then 50–200 mcg/kg/min."
    }
  },
  {
    id: "atropine",
    name: "Atropine",
    category: "Antiarrhythmics",
    type: "bolus",
    concentrations: [
      { label: "0.1 mg/mL", mg: 0.1, mL: 1 }
    ],
    bolus: {
      dose: 1, doseUnit: "mg", perKg: false,
      min: 0.5, max: 1, maxAbsolute: 3,
      notes: "Bradycardia 0.5–1 mg q3–5 min, max 3 mg. Organophosphate: 2–6 mg, double q5min."
    }
  },

  // ---------------- ANTICONVULSANTS ----------------
  {
    id: "lorazepam",
    name: "Lorazepam (Ativan)",
    category: "Anticonvulsants",
    type: "bolus",
    concentrations: [
      { label: "2 mg/mL", mg: 2, mL: 1 },
      { label: "4 mg/mL", mg: 4, mL: 1 }
    ],
    bolus: {
      dose: 0.1, doseUnit: "mg", perKg: true,
      min: 0.05, max: 0.1, maxAbsolute: 4,
      notes: "Status epilepticus 0.1 mg/kg IV (max 4 mg/dose), may repeat × 1."
    }
  },
  {
    id: "levetiracetam",
    name: "Levetiracetam (Keppra)",
    category: "Anticonvulsants",
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL", mg: 100, mL: 1 }
    ],
    bolus: {
      dose: 60, doseUnit: "mg", perKg: true,
      min: 20, max: 60, maxAbsolute: 4500,
      notes: "Status epilepticus 60 mg/kg IV (max 4.5 g) over 10 min."
    }
  },
  {
    id: "fosphenytoin",
    name: "Fosphenytoin",
    category: "Anticonvulsants",
    type: "bolus",
    concentrations: [
      { label: "50 mg PE/mL", mg: 50, mL: 1 }
    ],
    bolus: {
      dose: 20, doseUnit: "mg", perKg: true,
      min: 15, max: 20, maxAbsolute: 1500,
      notes: "Load 20 mg PE/kg IV at ≤150 mg PE/min."
    }
  },

  // ---------------- REVERSAL ----------------
  {
    id: "naloxone",
    name: "Naloxone (Narcan)",
    category: "Reversal",
    type: "bolus",
    concentrations: [
      { label: "0.4 mg/mL", mg: 0.4, mL: 1 },
      { label: "1 mg/mL", mg: 1, mL: 1 }
    ],
    bolus: {
      dose: 0.4, doseUnit: "mg", perKg: false,
      min: 0.04, max: 2, maxAbsolute: 10,
      notes: "0.04–0.4 mg IV q2–3 min titrated to RR. Full reversal 2 mg."
    }
  },
  {
    id: "flumazenil",
    name: "Flumazenil",
    category: "Reversal",
    type: "bolus",
    concentrations: [
      { label: "0.1 mg/mL", mg: 0.1, mL: 1 }
    ],
    bolus: {
      dose: 0.2, doseUnit: "mg", perKg: false,
      min: 0.1, max: 0.2, maxAbsolute: 1,
      notes: "0.2 mg IV over 15 sec; may repeat to max 1 mg. Caution: chronic benzo use."
    }
  },
  {
    id: "calcium_gluconate",
    name: "Calcium Gluconate",
    category: "Reversal",
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL (10%)", mg: 100, mL: 1 }
    ],
    bolus: {
      dose: 1000, doseUnit: "mg", perKg: false,
      min: 1000, max: 3000, maxAbsolute: 3000,
      notes: "HyperK / CCB tox: 1–3 g IV (1 amp = 1 g). Slow push."
    }
  },
  {
    id: "sodium_bicarb",
    name: "Sodium Bicarbonate",
    category: "Reversal",
    type: "bolus",
    concentrations: [
      { label: "1 mEq/mL (8.4%)", mg: 1, mL: 1, isUnits: true, unitsLabel: "mEq" }
    ],
    bolus: {
      dose: 1, doseUnit: "mEq", perKg: true,
      min: 0.5, max: 2, maxAbsolute: 100,
      notes: "TCA tox / severe acidosis 1–2 mEq/kg IV."
    }
  },

  // ---------------- ELECTROLYTES ----------------
  {
    id: "magnesium",
    name: "Magnesium Sulfate",
    category: "Electrolytes",
    type: "bolus",
    concentrations: [
      { label: "500 mg/mL (50%)", mg: 500, mL: 1 },
      { label: "2 g / 100 mL (20 mg/mL)", mg: 2000, mL: 100 }
    ],
    bolus: {
      dose: 2000, doseUnit: "mg", perKg: false,
      min: 1000, max: 4000, maxAbsolute: 4000,
      notes: "Torsades / severe asthma: 2 g IV over 10–20 min. Eclampsia: 4–6 g load."
    }
  },
  {
    id: "potassium",
    name: "Potassium Chloride (peripheral)",
    category: "Electrolytes",
    type: "infusion",
    concentrations: [
      { label: "10 mEq / 100 mL", mg: 10, mL: 100, isUnits: true, unitsLabel: "mEq" }
    ],
    infusion: {
      dose: 10, doseUnit: "mEq", perKg: false, perTime: "hr",
      min: 10, max: 20,
      notes: "Peripheral max 10 mEq/hr; central up to 20 mEq/hr (with monitoring)."
    }
  },
  {
    id: "dextrose50",
    name: "Dextrose 50%",
    category: "Electrolytes",
    type: "bolus",
    concentrations: [
      { label: "0.5 g/mL (D50)", mg: 500, mL: 1 }
    ],
    bolus: {
      dose: 25000, doseUnit: "mg", perKg: false,
      min: 12500, max: 25000, maxAbsolute: 25000,
      notes: "Hypoglycemia: 25 g IV (50 mL of D50)."
    }
  },

  // ---------------- ANTICOAGULATION / OTHER ----------------
  {
    id: "heparin_bolus",
    name: "Heparin (bolus)",
    category: "Other",
    type: "bolus",
    concentrations: [
      { label: "100 units/mL", mg: 100, mL: 1, isUnits: true, unitsLabel: "units" },
      { label: "1000 units/mL", mg: 1000, mL: 1, isUnits: true, unitsLabel: "units" }
    ],
    bolus: {
      dose: 80, doseUnit: "units", perKg: true,
      min: 60, max: 80, maxAbsolute: 5000,
      notes: "ACS: 60 u/kg (max 4000). VTE: 80 u/kg. Per institutional protocol."
    }
  },
  {
    id: "heparin_drip",
    name: "Heparin (infusion)",
    category: "Other",
    type: "infusion",
    concentrations: [
      { label: "25,000 units / 250 mL (100 u/mL)", mg: 25000, mL: 250, isUnits: true, unitsLabel: "units" }
    ],
    infusion: {
      dose: 18, doseUnit: "units", perKg: true, perTime: "hr",
      min: 12, max: 18,
      notes: "VTE 18 u/kg/hr; ACS 12 u/kg/hr. Adjust per aPTT/anti-Xa."
    }
  },
  {
    id: "tranexamic",
    name: "Tranexamic Acid (TXA)",
    category: "Other",
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL", mg: 100, mL: 1 }
    ],
    bolus: {
      dose: 1000, doseUnit: "mg", perKg: false,
      min: 1000, max: 1000, maxAbsolute: 1000,
      notes: "Trauma: 1 g IV over 10 min, then 1 g over 8 hr. Within 3 hr of injury."
    }
  },
  {
    id: "nicardipine",
    name: "Nicardipine",
    category: "Other",
    type: "infusion",
    concentrations: [
      { label: "25 mg / 250 mL (0.1 mg/mL)", mg: 25, mL: 250 }
    ],
    infusion: {
      dose: 5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 5, max: 15,
      notes: "Start 5 mg/hr, titrate by 2.5 mg/hr q5–15 min, max 15 mg/hr."
    }
  },
  {
    id: "nitroglycerin",
    name: "Nitroglycerin",
    category: "Other",
    type: "infusion",
    concentrations: [
      { label: "50 mg / 250 mL (200 mcg/mL)", mg: 50, mL: 250 },
      { label: "100 mg / 250 mL (400 mcg/mL)", mg: 100, mL: 250 }
    ],
    infusion: {
      dose: 10, doseUnit: "mcg", perKg: false, perTime: "min",
      min: 5, max: 200,
      notes: "Start 5–10 mcg/min, titrate q3–5 min. Max 200 mcg/min."
    }
  },
  {
    id: "labetalol",
    name: "Labetalol (bolus)",
    category: "Other",
    type: "bolus",
    concentrations: [
      { label: "5 mg/mL", mg: 5, mL: 1 }
    ],
    bolus: {
      dose: 10, doseUnit: "mg", perKg: false,
      min: 10, max: 20, maxAbsolute: 80,
      notes: "10–20 mg IV over 2 min; double q10 min to max 80 mg per dose (300 mg cumulative)."
    }
  },
  {
    id: "hydralazine",
    name: "Hydralazine",
    category: "Other",
    type: "bolus",
    concentrations: [
      { label: "20 mg/mL", mg: 20, mL: 1 }
    ],
    bolus: {
      dose: 10, doseUnit: "mg", perKg: false,
      min: 5, max: 20, maxAbsolute: 20,
      notes: "5–20 mg IV q4–6h."
    }
  },
  {
    id: "ondansetron",
    name: "Ondansetron (Zofran)",
    category: "Other",
    type: "bolus",
    concentrations: [
      { label: "2 mg/mL", mg: 2, mL: 1 }
    ],
    bolus: {
      dose: 4, doseUnit: "mg", perKg: false,
      min: 4, max: 8, maxAbsolute: 16,
      notes: "4 mg IV; up to 8 mg. Max 16 mg/dose (QT prolongation)."
    }
  }
];

const DEFAULT_CATEGORIES = [
  "Pressors",
  "Sedation",
  "Analgesics",
  "Paralytics",
  "Antiarrhythmics",
  "Anticonvulsants",
  "Reversal",
  "Electrolytes",
  "Other"
];
