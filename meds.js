// Default medication library for the IV Dosing Calculator.
// Each med may have:
//   id, name, category, type ("bolus" | "infusion" | "both")
//   concentrations: [{ label, mg, mL, isUnits?, unitsLabel? }]
//                   (used for both modes by default)
//   bolusConcentrations / infusionConcentrations:
//                   per-mode concentration lists (override concentrations)
//   bolus: { dose, doseUnit, perKg, min, max, maxAbsolute, notes }
//   infusion: { dose, doseUnit, perKg, perTime ("min" | "hr"),
//               min, max, notes }
//   bolusCtaLabel: text for the bolus CTA shown inside infusion modal
//                  (defaults to "Add loading bolus")
//   sources: [{ label, url }]
//   notes: free text shown in the modal footer
//
//   populations: {
//     adult:     { ...partial-med override... },
//     pediatric: { ...partial-med override... },  // UMHS PICU < 50 kg
//     neonatal:  { ...partial-med override... }   // optional; falls back to pediatric
//   }
//   The top-level fields act as the "adult" default. populations.adult is
//   only needed if adult differs from top-level (rare). The resolver merges
//   the population object onto a clone of the top-level med, picking
//   concentrations / bolus / infusion / notes / sources / type from whichever
//   is more specific.

// UMHS guideline citations — used as "source of truth" for many drugs.
const UMHS_ADULT_SRC = { label: "UMHS Adult ICU Continuous Infusion Guidelines (2023)", url: "refs/umhs-adult-icu-2023.pdf" };
const UMHS_PEDS_SRC  = { label: "UMHS PICU Continuous Infusion Guidelines (2023)", url: "refs/umhs-picu-2023.pdf" };
const UMHS_NICU_SRC  = { label: "UMHS Brandon NICU IV Medication Guidelines (2023)", url: "refs/umhs-nicu-2023.pdf" };
const UMHS_MCHC_SRC  = { label: "UMHS Michigan Congenital Heart Center IV Guidelines (2021)", url: "refs/umhs-mchc-2021.pdf" };
const UMHS_ARDS_SRC  = { label: "UMHS ARDS Management Guideline — Appendix B-1 (THAM 0.3 M, Figure 6)", url: "refs/umhs-ards-b1-2024.pdf" };
const UMHS_TOX_SRC   = { label: "UMHS Survival Flight Clinical Guideline E-4: Toxicologic Emergencies (rev. Nov 2023)", url: "refs/umhs-toxicologic-emergencies-e4-2024.pdf" };

const DEFAULT_MEDS = [
  // ---------------- PRESSORS ----------------
  {
    id: "epinephrine",
    name: "Epinephrine",
    category: "Pressors",
    type: "both",
    bolusLabel: "Push Dose Pressor",
    bolusConcentrations: [
      { label: "10 mcg/mL (1 mg in 100 mL)", mg: 0.01, mL: 1 },
      { label: "100 mcg/mL (cardiac arrest 1:10,000)", mg: 0.1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "5 mg / 250 mL (20 mcg/mL)", mg: 5, mL: 250 }
    ],
    bolus: {
      dose: 10, doseUnit: "mcg", perKg: false,
      min: 5, max: 20, maxAbsolute: 100,
      notes: "Push-dose pressor: 5–20 mcg IV q1–5 min titrated to MAP."
    },
    infusion: {
      dose: 0.1, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.01, max: 1.0,
      notes: "Adult typical 0.01–1 mcg/kg/min (UMHS). CVICU max 0.2. Titrate to MAP ≥ 65."
    },
    // (Removed bolusCtaLabel "Push-dose pressor" in Round 6b — the Bolus mode
    // tab already reads "Push Dose Pressor" so the CTA banner was redundant.)
    hideBolusCta: true,
    code: {
      role: "Cardiac arrest (ACLS/PALS)",
      adult: { dose: 1, unit: "mg", perKg: false, route: "IV/IO", repeat: "q3–5 min" },
      pediatric: { dose: 0.01, unit: "mg", perKg: true, max: 1, route: "IV/IO", repeat: "q3–5 min", concPreferred: 1 },
      concHint: "Use 1:10,000 (100 mcg/mL) for code dosing."
    },
    notes: "Cardiac arrest dose: 1 mg (0.01 mg/kg peds) IV/IO q3–5 min.  •  MCHC (cardiac): 0.01–0.1 mcg/kg/min, hard max 4 mcg/kg/min. Vesicant — central line preferred.",
    sources: [
      { label: "AHA ACLS 2020 Guidelines", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      { label: "FDA Epinephrine PI (DailyMed)", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=epinephrine+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusionConcentrations: [
          { label: "4 mg / 250 mL (16 mcg/mL)", mg: 4, mL: 250 },
          { label: "8 mg / 250 mL (32 mcg/mL)", mg: 8, mL: 250 }
        ],
        infusion: {
          dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.01, max: 4,
          notes: "UMHS PICU: 0.01–4 mcg/kg/min. Start 0.05 mcg/kg/min; titrate."
        },
        notes: "Pediatric (UMHS PICU <50 kg). Cardiac arrest 0.01 mg/kg IV/IO."
      },
      neonatal: {
        infusion: {
          dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.05, max: 2,
          notes: "UMHS NICU: 0.05–1 mcg/kg/min, hard max 2."
        },
        notes: "UMHS NICU: 0.05–1 mcg/kg/min, hard max 2. Titrate by 0.01–0.02 mcg/kg/min q5–10 min to MAP. Vesicant — extravasation: call Pharmacy."
      }
    }
  },
  {
    id: "norepinephrine",
    name: "Norepinephrine",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "16 mg / 250 mL (64 mcg/mL) — double-strength", mg: 16, mL: 250 },
      { label: "8 mg / 250 mL (32 mcg/mL) — standard premix", mg: 8, mL: 250 },
      { label: "4 mg / 250 mL (16 mcg/mL) — peripheral", mg: 4, mL: 250 },
    ],
    infusion: {
      dose: 0.1, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.01, max: 1,
      notes: "Adult (UMHS): 0.01–1 mcg/kg/min. First-line for septic shock."
    },
    notes: "MCHC (cardiac): 0.01–0.1 mcg/kg/min, hard max 2. Concentrations >0.01 mg/mL must run via central line.",
    sources: [
      { label: "Surviving Sepsis Campaign 2021", url: "https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-guidelines-2021" },
      { label: "FDA Norepinephrine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=norepinephrine+bitartrate" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.01, max: 2,
          notes: "UMHS PICU: 0.01–2 mcg/kg/min."
        }
      },
      neonatal: {
        infusion: {
          dose: 0.1, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.05, max: 2,
          notes: "UMHS NICU: 0.05–1 mcg/kg/min, hard max 2."
        },
        notes: "UMHS NICU: 0.05–1 mcg/kg/min, hard max 2. Titrate q5–10 min by 0.01–0.02 mcg/kg/min. Vesicant."
      }
    }
  },
  {
    id: "phenylephrine",
    name: "Phenylephrine",
    category: "Pressors",
    type: "both",
    bolusLabel: "Push Dose Pressor",
    bolusConcentrations: [
      { label: "100 mcg/mL (push-dose syringe)", mg: 0.1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "10 mg / 250 mL (40 mcg/mL)", mg: 10, mL: 250 },
      { label: "50 mg / 250 mL (200 mcg/mL)", mg: 50, mL: 250 }
    ],
    bolus: {
      dose: 100, doseUnit: "mcg", perKg: false,
      min: 50, max: 200, maxAbsolute: 500,
      notes: "Push-dose: 50–200 mcg IV q1–5 min. Pure alpha — caution in bradycardia."
    },
    infusion: {
      dose: 100, doseUnit: "mcg", perKg: false, perTime: "min",
      min: 50, max: 300,
      notes: "UMHS adult: 50–300 mcg/min (NOT per-kg in adults). Titrate to MAP ≥ 65."
    },
    // (Removed bolusCtaLabel in Round 6b — see Epi note above.)
    hideBolusCta: true,
    notes: "MCHC (cardiac): peds bolus 5–20 mcg/kg q10–15 min PRN; infusion 0.05–5 mcg/kg/min (max 5). Adult ≥50kg 50–300 mcg/min. Central line preferred.",
    sources: [
      { label: "FDA Phenylephrine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=phenylephrine+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        bolus: {
          dose: 10, doseUnit: "mcg", perKg: true,
          min: 5, max: 20, maxAbsolute: 500,
          notes: "UMHS PICU bolus: 5–20 mcg/kg IV."
        },
        infusion: {
          dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.05, max: 5,
          notes: "UMHS PICU <50 kg: 0.05–5 mcg/kg/min."
        }
      }
    }
  },
  {
    id: "vasopressin",
    name: "Vasopressin",
    category: "Pressors",
    type: "infusion",
    // Two clinical protocols share this drug. The modal shows a Shock / DI
    // toggle so the nurse can swap between them without leaving the tile.
    variants: [
      { id: "shock", label: "Shock", default: true },
      { id: "di",    label: "Diabetes Insipidus" }
    ],
    concentrations: [
      { label: "40 units / 40 mL (1 unit/mL)", mg: 40, mL: 40, isUnits: true, unitsLabel: "units" }
    ],
    infusion: {
      dose: 0.04, doseUnit: "units", perKg: false, perTime: "min",
      min: 0.01, max: 0.08,
      notes: "Adult (UMHS): 0.01–0.03 u/min (sepsis max 0.06; cardiac max 0.08)."
    },
    notes: "MCHC (cardiac shock, peds <50kg): 0.0001–0.003 unit/kg/min. NOTE: SHOCK and DI dosing are DIFFERENT. DI dosing: 0.25–10 milliunit/kg/hr (separate indication).",
    sources: [
      { label: "Surviving Sepsis Campaign 2021", url: "https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-guidelines-2021" },
      { label: "FDA Vasostrict (vasopressin) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=vasopressin" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        concentrations: [
          { label: "1 unit / 100 mL (0.01 u/mL)", mg: 1, mL: 100, isUnits: true, unitsLabel: "units" },
          { label: "5 units / 100 mL (0.05 u/mL)", mg: 5, mL: 100, isUnits: true, unitsLabel: "units" }
        ],
        infusion: {
          dose: 0.0005, doseUnit: "units", perKg: true, perTime: "min",
          min: 0.0001, max: 0.003,
          notes: "UMHS PICU cardiac shock: 0.0001–0.003 u/kg/min."
        }
      },
      neonatal: {
        infusion: {
          dose: 0.0001, doseUnit: "units", perKg: true, perTime: "min",
          min: 0.0001, max: 0.003,
          notes: "UMHS NICU: 0.0001–0.002 u/kg/min, hard max 0.003."
        },
        notes: "UMHS NICU (cardiac shock): 0.0001–0.002 unit/kg/min, hard max 0.003. Titrate q15–20 min by 0.0001–0.0002 unit/kg/min. Vesicant."
      }
    },
    // ----- DI variant overlay -----
    // When the modal's variant toggle is set to "di", these fields take
    // precedence over the shock-protocol defaults above. Same drug, totally
    // different math: milliunits/kg/hr, not units/min.
    variantOverrides: {
      di: {
        concentrations: [
          { label: "100 milliunits/mL (10 units / 100 mL NS)", mg: 0.1, mL: 1, isUnits: true, unitsLabel: "milliunits" },
          { label: "500 milliunits/mL (50 units / 100 mL NS)", mg: 0.5, mL: 1, isUnits: true, unitsLabel: "milliunits" }
        ],
        infusion: {
          dose: 0.5, doseUnit: "milliunits", perKg: true, perTime: "hr",
          min: 0.25, max: 40,
          notes: "MCHC (DI): 0.25–10 milliunit/kg/hr (hard max 40). Highly variable — titrate by serum/urine sodium, osmolality, fluid balance, urine output."
        },
        notes: "DI dosing is DIFFERENT from shock dosing — use this protocol only for central DI (post-pituitary surgery, brain death/donor management). Vesicant — extravasation: call Pharmacy.",
        populations: {
          pediatric: {
            infusion: {
              dose: 0.5, doseUnit: "milliunits", perKg: true, perTime: "hr",
              min: 0.25, max: 40,
              notes: "PICU central DI: 0.25–10 milliunit/kg/hr; titrate to UOP / serum Na / osmolality."
            }
          },
          neonatal: {
            infusion: {
              dose: 0.25, doseUnit: "milliunits", perKg: true, perTime: "hr",
              min: 0.1, max: 10,
              notes: "NICU central DI: 0.1–1.0 milliunit/kg/hr initial; hard max 10."
            }
          }
        }
      }
    }
  },
  {
    id: "dopamine",
    name: "Dopamine",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "800 mg / 250 mL (3200 mcg/mL)", mg: 800, mL: 250 },
      { label: "800 mg / 500 mL (1600 mcg/mL) — double-strength", mg: 800, mL: 500 },
      { label: "200 mg / 250 mL (800 mcg/mL)", mg: 200, mL: 250 },
    ],
    infusion: {
      dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 2, max: 20,
      notes: "Adult (UMHS): 2–20 mcg/kg/min. β at 5–10, α at >10."
    },
    notes: "MCHC: low 1–5, intermediate 5–15, high >15 mcg/kg/min. Vesicant — central line preferred; phentolamine for extravasation.",
    sources: [
      { label: "FDA Dopamine HCl PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=dopamine+hydrochloride" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 2.5, max: 25,
          notes: "UMHS PICU: 2.5–20 mcg/kg/min, hard max 25."
        }
      },
      neonatal: {
        notes: "UMHS NICU: 2.5–20 mcg/kg/min, hard max 25. Titrate q5–10 min by 2.5–5 mcg/kg/min to MAP."
      }
    }
  },
  {
    id: "dobutamine",
    name: "Dobutamine",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "1000 mg / 250 mL (4000 mcg/mL) — double-strength", mg: 1000, mL: 250 },
      { label: "500 mg / 250 mL (2000 mcg/mL)", mg: 500, mL: 250 },
      { label: "250 mg / 250 mL (1000 mcg/mL)", mg: 250, mL: 250 },
    ],
    infusion: {
      dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 1, max: 20,
      notes: "Adult (UMHS): 1–20 mcg/kg/min (CVICU max 10). Inotrope."
    },
    notes: "MCHC: 2.5–20 mcg/kg/min, hard max 25. Titrate q5 min by 2.5–5 mcg/kg/min. Vesicant.",
    sources: [
      { label: "FDA Dobutamine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=dobutamine" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 2.5, max: 25,
          notes: "UMHS PICU: 2.5–20 mcg/kg/min, hard max 25."
        }
      },
      neonatal: {
        notes: "UMHS NICU: 2.5–20 mcg/kg/min, hard max 25. Titrate q5–10 min by 2.5–5 mcg/kg/min to MAP. Vesicant."
      }
    }
  },
  {
    id: "milrinone",
    name: "Milrinone",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "20 mg / 100 mL (200 mcg/mL) standard premix", mg: 20, mL: 100 },
      { label: "40 mg / 200 mL (200 mcg/mL)", mg: 40, mL: 200 },
      { label: "50 mg / 250 mL (200 mcg/mL)", mg: 50, mL: 250 },
    ],
    infusion: {
      dose: 0.25, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.125, max: 0.75,
      notes: "Adult (UMHS): 0.125–0.25 mcg/kg/min, max 0.75. Inodilator. Renal dose adjust."
    },
    notes: "MCHC: 0.3–0.75 mcg/kg/min, hard max 1. 125 mg/250 mL (0.5 mg/mL) restricted to home-therapy continuation only.",
    sources: [
      { label: "FDA Primacor (milrinone) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=milrinone" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.3, max: 1,
          notes: "UMHS PICU: 0.3–0.75 mcg/kg/min, hard max 1."
        }
      },
      neonatal: {
        notes: "UMHS NICU: 0.3–0.75 mcg/kg/min, hard max 1. Renally eliminated — monitor for accumulation in renal dysfunction. Side effect: hypotension."
      }
    }
  },
  {
    id: "epoprostenol",
    name: "Epoprostenol (Veletri/Flolan)",
    category: "Respiratory",
    type: "infusion",
    concentrations: [
      { label: "0.5 mg / 100 mL (5,000 ng/mL)", mg: 0.5, mL: 100 },
      { label: "1.5 mg / 100 mL (15,000 ng/mL)", mg: 1.5, mL: 100 },
      { label: "3 mg / 100 mL (30,000 ng/mL)", mg: 3, mL: 100 }
    ],
    infusion: {
      dose: 2, doseUnit: "ng", perKg: true, perTime: "min",
      min: 1, max: 50,
      notes: "Pulmonary HTN: start 2 ng/kg/min, titrate by 1–2 ng/kg/min q15min. Maintenance 25–40 ng/kg/min. Abrupt withdrawal can cause rebound PH crisis — never interrupt infusion."
    },
    notes: "MCHC: 2–20 ng/kg/min, hard max 125. Start 2–3 ng/kg/min; increase by 1–2 ng/kg/min based on response. Must be 0.22-micron filtered. Dedicated line, protect from light. Change syringe q72h. NEVER stop/pause infusion.",
    sources: [
      { label: "FDA Veletri PI (DailyMed)", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=epoprostenol" },
      { label: "UToledo Epoprostenol Administration Guideline", url: "https://www.utoledo.edu/policies/utmc/nursing/guidelines/general/pdfs/Guideline%20General%20-%20Epoprostenol%20Veletri-Flolan%20Administration.pdf" },
      { label: "CHEST Pulmonary Hypertension Guideline 2014", url: "https://journal.chestnet.org/article/S0012-3692(14)60475-7/fulltext" },
      UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 2, doseUnit: "ng", perKg: true, perTime: "min",
          min: 2, max: 125,
          notes: "UMHS PICU: start 2–3 ng/kg/min, titrate. Hard max 125 ng/kg/min."
        }
      },
      neonatal: {
        notes: "UMHS NICU: same as MCHC — 2–20 ng/kg/min, hard max 125. Filter 0.22 micron, dedicated line, never interrupt."
      }
    }
  },
  {
    id: "alprostadil",
    name: "Alprostadil (Prostaglandin E1)",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "500 mcg / 250 mL D5W (2 mcg/mL)", mg: 0.5, mL: 250 },
      { label: "500 mcg / 100 mL D5W (5 mcg/mL)", mg: 0.5, mL: 100 },
      { label: "200 mcg / 20 mL D5W (10 mcg/mL)", mg: 0.2, mL: 20 }
    ],
    infusion: {
      dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.01, max: 0.4,
      notes: "Neonatal ductal-dependent CHD: start 0.05–0.1 mcg/kg/min, taper to lowest effective (0.01–0.4). Watch for apnea, hypotension, fever — be ready to intubate."
    },
    notes: "MCHC: 0.03–0.2 mcg/kg/min (hard max 0.4). Central line. If <1 mL/hr, co-infuse D10W (or D5W) WITHOUT heparin. If >1 mL/hr, no co-infusion fluid needed. DO NOT TITRATE.",
    sources: [
      { label: "FDA Prostin VR (alprostadil) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=alprostadil+injection" },
      { label: "ANMF Alprostadil Monograph 2024", url: "https://www.anmfonline.org/wp-content/uploads/2024/10/Alprostadil_ANMFv2.0_20241017-1.pdf" },
      { label: "AHA Pediatric Pulmonary Hypertension 2015", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000329" },
      UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.03, max: 0.4,
          notes: "UMHS PICU: 0.03–0.2 mcg/kg/min, hard max 0.4."
        }
      },
      neonatal: {
        infusion: {
          dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.03, max: 0.4,
          notes: "Neonatal ductal-dependent CHD: 0.03–0.2 mcg/kg/min, taper to lowest effective. Hard max 0.4."
        }
      ,
        notes: "UMHS NICU: 0.03–0.2 mcg/kg/min (hard max 0.4). Central line. If <1 mL/hr, co-infuse D10W (or D5W) WITH heparin. Common SE: apnea, fever — be ready to intubate."
      }
    }
  },
  {
    id: "isoproterenol",
    name: "Isoproterenol",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "2 mg / 250 mL (8 mcg/mL)", mg: 2, mL: 250 }
    ],
    infusion: {
      dose: 2, doseUnit: "mcg", perKg: false, perTime: "min",
      min: 0.5, max: 10,
      notes: "Adult (UMHS): 0.5–10 mcg/min. Chronotropy/inotropy."
    },
    notes: "MCHC peds <50kg: 0.01–2 mcg/kg/min, hard max 2. Adult ≥50kg: 2–10 mcg/min, hard max 11. Concentrations >0.01 mg/mL must run via central line. Vesicant.",
    sources: [
      { label: "FDA Isuprel (isoproterenol) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=isoproterenol" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.01, max: 2,
          notes: "UMHS PICU <50 kg: 0.01–2 mcg/kg/min."
        }
      }
    }
  },
  {
    id: "angiotensin2",
    name: "Angiotensin II (Giapreza)",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "2.5 mg / 250 mL (10,000 ng/mL)", mg: 2.5, mL: 250 }
    ],
    infusion: {
      dose: 20, doseUnit: "ng", perKg: true, perTime: "min",
      min: 5, max: 80,
      notes: "Adult (UMHS): start 20 ng/kg/min, max 80 ng/kg/min for first 3 hr; maintenance max 40 ng/kg/min. Refractory vasodilatory shock."
    },
    sources: [
      { label: "FDA Giapreza PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=angiotensin+ii" },
      UMHS_ADULT_SRC
    ]
  },

  // ---------------- SEDATION ----------------
  {
    id: "ketamine",
    name: "Ketamine",
    category: "Sedation",
    type: "both",
    bolusConcentrations: [
      { label: "20 mg/mL (per user protocol)", mg: 20, mL: 1 },
      { label: "100 mg/mL", mg: 100, mL: 1 },
      { label: "50 mg/mL", mg: 50, mL: 1 },
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "2500 mg / 250 mL (10 mg/mL)", mg: 2500, mL: 250 }
    ],
    bolus: {
      dose: 1.5, doseUnit: "mg", perKg: true,
      min: 1, max: 2, maxAbsolute: 200,
      notes: "RSI induction: 1–2 mg/kg IV. Onset 30–60 sec."
    },
    infusion: {
      dose: 0.4, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 0.2, max: 1.2,
      notes: "Adult (UMHS): 0.2–0.6 mg/kg/hr; max 1.2 (status asthmaticus 2.5)."
    },
    bolusCtaLabel: "Induction bolus",
    notes: "MCHC: bolus 0.5–2 mg/kg over 1–3 min; infusion 5–20 mcg/kg/min (hard max 80). Must use PCTU/PICU profile in Alaris device.",
    sources: [
      { label: "FDA Ketamine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=ketamine+hydrochloride" },
      { label: "Brown EM Lit – RSI Drugs", url: "https://www.aliem.com/rapid-sequence-intubation-medications/" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        bolus: {
          dose: 1.5, doseUnit: "mg", perKg: true,
          min: 0.5, max: 2, maxAbsolute: 200,
          notes: "UMHS PICU bolus: 0.5–2 mg/kg IV."
        },
        infusion: {
          dose: 10, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 5, max: 80,
          notes: "UMHS PICU: 5–20 mcg/kg/min, hard max 80."
        }
      }
    }
  },
  {
    id: "propofol",
    name: "Propofol",
    category: "Sedation",
    type: "both",
    concentrations: [
      { label: "10 mg/mL (Diprivan)", mg: 10, mL: 1 }
    ],
    bolus: {
      dose: 1.5, doseUnit: "mg", perKg: true,
      min: 1, max: 2.5, maxAbsolute: 200,
      notes: "Induction 1–2.5 mg/kg. Reduce in shock/elderly."
    },
    infusion: {
      dose: 30, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 5, max: 80,
      notes: "Adult (UMHS): 5–20 mcg/kg/min, hard max 80. Watch for PRIS at high/long doses."
    },
    bolusCtaLabel: "Induction bolus",
    notes: "MCHC: load 0.5–3 mg/kg; infusion 10–150 mcg/kg/min. Restricted ≤12 hr in <18 yo (anesthesia approval for longer). Triglycerides if >24 hr. Avoid prolonged-QT. Discard infusion AND tubing q12h. No diluent — straight drug. Vesicant.",
    sources: [
      { label: "FDA Propofol PI (Diprivan)", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=propofol" },
      { label: "PADIS Guidelines (SCCM 2018)", url: "https://www.sccm.org/Clinical-Resources/Guidelines/Guidelines/Guidelines-for-the-Prevention-and-Management-of-Pa" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        bolus: {
          dose: 2, doseUnit: "mg", perKg: true,
          min: 0.5, max: 3, maxAbsolute: 200,
          notes: "UMHS PICU induction: 0.5–3 mg/kg IV."
        },
        infusion: {
          dose: 50, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 10, max: 150,
          notes: "UMHS PICU: 10–150 mcg/kg/min. PRIS risk — limit duration."
        }
      }
    }
  },
  {
    id: "midazolam",
    name: "Midazolam",
    category: "Sedation",
    secondaryCategories: ["Anticonvulsants"],
    type: "both",
    bolusConcentrations: [
      { label: "1 mg/mL", mg: 1, mL: 1 },
      { label: "5 mg/mL", mg: 5, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "100 mg / 100 mL (1 mg/mL)", mg: 100, mL: 100 },
      { label: "150 mg / 30 mL (5 mg/mL)", mg: 150, mL: 30 }
    ],
    bolus: {
      dose: 0.05, doseUnit: "mg", perKg: true,
      min: 0.02, max: 0.2, maxAbsolute: 5,
      notes: "0.02–0.1 mg/kg IV slow push (UMHS PICU load 0.05–0.2). Status epilepticus IM 0.2 mg/kg."
    },
    infusion: {
      dose: 4, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 2, max: 30,
      notes: "Adult (UMHS): 2–10 mg/hr, hard max 30 mg/hr."
    },
    notes: "MCHC: peds <50kg bolus 0.05–0.2 mg/kg over 2 min (max 4 mg). Infusion <50kg: 10–150 mcg/kg/hr (hard max 300). Adult ≥50kg: 1–10 mg/hr (1 mg/mL conc only), hard max 20.",
    sources: [
      { label: "FDA Midazolam PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=midazolam" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 50, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 10, max: 300,
          notes: "UMHS PICU: 10–150 mcg/kg/hr, hard max 300."
        }
      },
      neonatal: {
        infusion: {
          dose: 50, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 20, max: 300,
          notes: "UMHS NICU: 20–200 mcg/kg/hr, hard max 300."
        },
        notes: "UMHS NICU: load 0.05–0.2 mg/kg over 2 min; infusion 20–200 mcg/kg/hr (hard max 300). For refractory seizures use EEG burst-suppression orderable."
      }
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
      dose: 0.4, doseUnit: "mcg", perKg: true, perTime: "hr",
      min: 0.2, max: 1.5,
      notes: "Adult (UMHS): 0.2–0.5 mcg/kg/hr, max 1.5 (CICU max 0.7). Optional load 1 mcg/kg over 10 min."
    },
    notes: "MCHC: 0.2–2 mcg/kg/hr, hard max 3. Loading doses NOT recommended. SE: bradycardia, hypotension.",
    sources: [
      { label: "FDA Precedex PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=dexmedetomidine" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 0.1, max: 3,
          notes: "UMHS PICU: 0.1–2 mcg/kg/hr, hard max 3."
        }
      },
      neonatal: {
        infusion: {
          dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 0.1, max: 2.5,
          notes: "UMHS NICU: 0.1–2 mcg/kg/hr, hard max 2.5. No loading dose."
        },
        notes: "UMHS NICU: 0.1–2 mcg/kg/hr, hard max 2.5. NO loading dose — bradycardia/hypotension risk."
      }
    }
  },
  {
    id: "pentobarbital",
    name: "Pentobarbital",
    category: "Anticonvulsants",
    type: "infusion",
    concentrations: [
      { label: "50 mg/mL (vial)", mg: 50, mL: 1 }
    ],
    infusion: {
      dose: 1, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 0.25, max: 15,
      notes: "UMHS PICU: 0.25–7.5 mg/kg/hr, hard max 15. Refractory status epilepticus / ICP."
    },
    notes: "MCHC: load 1–2 mg/kg over 20 min; infusion 0.25–7.5 mg/kg/hr (hard max 15). Tubing/stopcock q24h. Does NOT need to be filtered.",
    sources: [
      { label: "FDA Nembutal (pentobarbital) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=pentobarbital" },
      UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
]
  ,
    populations: {
      neonatal: {
        notes: "UMHS NICU: load 1–5 mg/kg over 20 min; infusion 0.5–10 mg/kg/hr (hard max 15). Change tubing/stopcock q24h."
      }
    }
  },

  // ---------------- ANALGESICS ----------------
  {
    id: "fentanyl",
    name: "Fentanyl",
    category: "Analgesics",
    type: "both",
    bolusConcentrations: [
      { label: "50 mcg/mL", mg: 0.05, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "1500 mcg / 30 mL (50 mcg/mL) — per user protocol", mg: 1.5, mL: 30 },
      { label: "2500 mcg / 250 mL (10 mcg/mL)", mg: 2.5, mL: 250 }
    ],
    bolus: {
      dose: 1, doseUnit: "mcg", perKg: true,
      min: 0.5, max: 3, maxAbsolute: 200,
      notes: "Analgesia 0.5–1 mcg/kg. RSI pretreatment 3 mcg/kg."
    },
    infusion: {
      dose: 25, doseUnit: "mcg", perKg: false, perTime: "hr",
      min: 12.5, max: 200,
      notes: "Adult (UMHS): 12.5–50 mcg/hr, hard max 200."
    },
    notes: "MCHC: peds <50kg 0.5–3 mcg/kg/hr (hard max 10); adult ≥50kg 25–200 mcg/hr (hard max 400). Push too fast → chest-wall rigidity. 50 mcg/mL has no diluent.",
    sources: [
      { label: "FDA Fentanyl Citrate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=fentanyl+citrate+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 1, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 0.5, max: 10,
          notes: "UMHS PICU <50 kg: 0.5–3 mcg/kg/hr, hard max 10."
        }
      },
      neonatal: {
        notes: "UMHS NICU: load 0.5–5 mcg/kg slow IV push (<5 mcg/kg over 3–5 min; ≥5 mcg/kg over 5–10 min). Infusion 1–5 mcg/kg/hr (hard max 10). Pushing too fast → chest-wall rigidity."
      }
    }
  },
  {
    id: "morphine",
    name: "Morphine",
    category: "Analgesics",
    type: "both",
    bolusConcentrations: [
      { label: "10 mg/mL (per user protocol)", mg: 10, mL: 1 },
      { label: "1 mg/mL", mg: 1, mL: 1 },
      { label: "5 mg/mL", mg: 5, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "150 mg / 30 mL (5 mg/mL)", mg: 150, mL: 30 },
      { label: "100 mg / 100 mL (1 mg/mL)", mg: 100, mL: 100 }
    ],
    bolus: {
      dose: 0.1, doseUnit: "mg", perKg: true,
      min: 0.05, max: 0.2, maxAbsolute: 10,
      notes: "0.05–0.2 mg/kg IV."
    },
    infusion: {
      dose: 3, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 2, max: 20,
      notes: "Adult (UMHS): 2–4 mg/hr, hard max 20."
    },
    notes: "MCHC: peds <50kg load 0.1–0.3 mg/kg over 5 min, infusion 10–150 mcg/kg/hr (hard max 300). Adult ≥50kg: 1–5 mg/hr (hard max 20). MCA/11W use 0.05 mg/mL concentration.",
    sources: [
      { label: "FDA Morphine Sulfate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=morphine+sulfate+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 30, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 10, max: 300,
          notes: "UMHS PICU <50 kg: 10–150 mcg/kg/hr, hard max 300."
        }
      },
      neonatal: {
        infusion: {
          dose: 50, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 20, max: 300,
          notes: "UMHS NICU: 20–200 mcg/kg/hr, hard max 300."
        },
        notes: "UMHS NICU: load 0.1–0.3 mg/kg over 5 min; infusion 20–200 mcg/kg/hr (hard max 300)."
      }
    }
  },
  {
    id: "hydromorphone",
    name: "Hydromorphone (Dilaudid)",
    category: "Analgesics",
    type: "both",
    bolusConcentrations: [
      { label: "1 mg/mL", mg: 1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "75 mg / 30 mL (2.5 mg/mL)", mg: 75, mL: 30 },
      { label: "50 mg / 100 mL (0.5 mg/mL)", mg: 50, mL: 100 }
    ],
    bolus: {
      dose: 0.015, doseUnit: "mg", perKg: true,
      min: 0.01, max: 0.02, maxAbsolute: 2,
      notes: "0.01–0.02 mg/kg IV q2–4h."
    },
    infusion: {
      dose: 0.5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 0.25, max: 3,
      notes: "Adult (UMHS): 0.25–0.5 mg/hr, hard max 3."
    },
    notes: "MCHC: peds <50kg 5–20 mcg/kg/hr (hard max 45); adult ≥50kg 0.25–3 mg/hr (hard max 5). ~7–10× potency of morphine. Restricted to mechanically ventilated, opioid-tolerant patients.",
    sources: [
      { label: "FDA Dilaudid PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=hydromorphone" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        infusion: {
          dose: 10, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 5, max: 45,
          notes: "UMHS PICU <50 kg: 5–20 mcg/kg/hr, hard max 45."
        }
      }
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
    },
    sources: [
      { label: "FDA Ketorolac PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=ketorolac" }
    ]
  },

  // ---------------- PARALYTICS ----------------
  {
    id: "rocuronium",
    name: "Rocuronium",
    category: "Paralytics",
    type: "both",
    bolusConcentrations: [
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "100 mg / 100 mL (1 mg/mL)", mg: 100, mL: 100 }
    ],
    bolus: {
      dose: 1.2, doseUnit: "mg", perKg: true,
      min: 0.6, max: 1.2, maxAbsolute: 150,
      notes: "RSI 1.2 mg/kg. Maintenance bolus 0.1–0.2 mg/kg."
    },
    infusion: {
      dose: 8, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 5, max: 12,
      notes: "Pediatric continuous infusion 5–12 mcg/kg/min (UMHS PICU). Adults rarely use continuous roc."
    },
    notes: "MCHC: bolus 1 mg/kg IV over 5–10 sec; infusion 5–12 mcg/kg/min (hard max 12). Vesicant.",
    sources: [
      { label: "FDA Zemuron (rocuronium) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=rocuronium" },
      UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
]
  ,
    populations: {
      neonatal: {
        notes: "UMHS NICU: 5–10 mcg/kg/min, hard max 12. Monitor patient movement/activity. Vesicant."
      }
    }
  },
  {
    id: "vecuronium",
    name: "Vecuronium",
    category: "Paralytics",
    type: "both",
    bolusConcentrations: [
      { label: "1 mg/mL (10 mg in 10 mL reconstituted) — per user protocol", mg: 1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "10 mg / 10 mL (1 mg/mL) reconstituted — per user protocol", mg: 10, mL: 10 },
      { label: "50 mg / 250 mL (200 mcg/mL)", mg: 50, mL: 250 }
    ],
    bolus: {
      dose: 0.1, doseUnit: "mg", perKg: true,
      min: 0.08, max: 0.15, maxAbsolute: 15,
      notes: "0.08–0.15 mg/kg IV load."
    },
    infusion: {
      dose: 1, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.5, max: 2,
      notes: "Adult (UMHS): 1 mcg/kg/min, hard max 2. UMHS PICU 0.5–2 mcg/kg/min."
    },
    notes: "MCHC: bolus 0.1 mg/kg IV over 5–10 sec; infusion 0.5–2 mcg/kg/min (hard max 4). No diluent — straight drug. Vesicant.",
    sources: [
      { label: "FDA Vecuronium PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=vecuronium" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ]
  },
  {
    id: "cisatracurium",
    name: "Cisatracurium (Nimbex)",
    category: "Paralytics",
    type: "both",
    bolusConcentrations: [
      { label: "2 mg/mL", mg: 2, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "200 mg / 100 mL (2 mg/mL)", mg: 200, mL: 100 }
    ],
    bolus: {
      dose: 0.1, doseUnit: "mg", perKg: true,
      min: 0.1, max: 0.2, maxAbsolute: 20,
      notes: "Load 0.1–0.2 mg/kg IV."
    },
    infusion: {
      dose: 3, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 1, max: 10,
      notes: "Adult (UMHS): 3 mcg/kg/min, hard max 10. ARDS / status asthmaticus."
    },
    notes: "MCHC: bolus 0.1 mg/kg then infusion 1–10 mcg/kg/min (hard max 13). 2 mg/mL has no diluent — straight drug.",
    sources: [
      { label: "FDA Nimbex PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=cisatracurium" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 3, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 1, max: 13,
          notes: "UMHS PICU: 1–10 mcg/kg/min, hard max 13."
        }
      },
      neonatal: {
        notes: "UMHS NICU: load 0.1 mg/kg then 1–10 mcg/kg/min (hard max 13). Dose adjust per movement/activity."
      }
    }
  },
  {
    id: "atracurium",
    name: "Atracurium",
    category: "Paralytics",
    type: "both",
    bolusConcentrations: [
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "1000 mg / 100 mL (10 mg/mL)", mg: 1000, mL: 100 }
    ],
    bolus: {
      dose: 0.3, doseUnit: "mg", perKg: true,
      min: 0.3, max: 0.5, maxAbsolute: 50,
      notes: "Load 0.3–0.5 mg/kg IV."
    },
    infusion: {
      dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 5, max: 30,
      notes: "Adult (UMHS): start 5 mcg/kg/min, hard max 30."
    },
    sources: [
      { label: "FDA Atracurium PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=atracurium" },
      UMHS_ADULT_SRC
    ]
  },

  // ---------------- ANTIARRHYTHMICS ----------------
  {
    id: "amiodarone",
    name: "Amiodarone",
    category: "Antiarrhythmics",
    type: "both",
    bolusConcentrations: [
      { label: "50 mg/mL (vial)", mg: 50, mL: 1 },
      { label: "150 mg / 100 mL (1.5 mg/mL)", mg: 150, mL: 100 }
    ],
    infusionConcentrations: [
      { label: "900 mg / 500 mL (1.8 mg/mL)", mg: 900, mL: 500 },
      { label: "600 mg / 500 mL (1.2 mg/mL)", mg: 600, mL: 500 }
    ],
    bolus: {
      dose: 150, doseUnit: "mg", perKg: false,
      min: 150, max: 300, maxAbsolute: 300,
      notes: "Stable VT/SVT: 150 mg over 10 min. Pulseless VT/VF: 300 mg IV push, then 150 mg."
    },
    infusion: {
      dose: 1, doseUnit: "mg", perKg: false, perTime: "min",
      min: 0.5, max: 1,
      notes: "Adult (UMHS): 1 mg/min × 6 hr, then 0.5 mg/min × 18 hr. Hard max 1 mg/min."
    },
    notes: "MCHC peds <50kg or <18 yo: load 5 mg/kg over 60 min (max 150 mg, may repeat to 15 mg/kg/day or 450 mg/day); infusion 5–15 mcg/kg/min (hard max 20). Adult ≥50kg: 150 mg over 60 min, then 1 mg/min × 6 hr → 0.5 mg/min × 96 hr (hard max 2 mg/min). MUST be 0.22-micron filtered. Conc >2 mg/mL → central line. Loading MUST be over 60 min to avoid hypotension. Diluent: D5W preferred.",
    code: {
      role: "VF/pulseless VT, refractory VT (ACLS/PALS)",
      adult: { dose: 300, unit: "mg", perKg: false, route: "IV/IO push", repeat: "May repeat 150 mg × 1" },
      pediatric: { dose: 5, unit: "mg", perKg: true, max: 300, route: "IV/IO", repeat: "May repeat × 2, total ≤ 15 mg/kg/day" },
      concHint: "Push undiluted from 50 mg/mL vial for arrest; dilute in D5W for stable arrhythmias."
    },
    sources: [
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      { label: "FDA Amiodarone PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=amiodarone+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        bolus: {
          dose: 5, doseUnit: "mg", perKg: true,
          min: 5, max: 5, maxAbsolute: 300,
          notes: "UMHS PICU load: 5 mg/kg IV."
        },
        infusion: {
          dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 5, max: 20,
          notes: "UMHS PICU <50 kg: 5–15 mcg/kg/min, hard max 20."
        }
      }
    }
  },
  {
    id: "adenosine",
    name: "Adenosine",
    category: "_codeOnly",
    codeOnly: true,
    type: "bolus",
    concentrations: [
      { label: "3 mg/mL", mg: 3, mL: 1 }
    ],
    bolus: {
      dose: 6, doseUnit: "mg", perKg: false,
      min: 6, max: 12, maxAbsolute: 12,
      notes: "6 mg rapid IV push, then 12 mg if needed. Follow with 20 mL flush."
    },
    code: {
      role: "SVT (narrow-complex regular tachycardia)",
      adult: { dose: 6, unit: "mg", perKg: false, route: "Rapid IV push + 20 mL flush", repeat: "12 mg × 2 if no response" },
      pediatric: { dose: 0.1, unit: "mg", perKg: true, max: 6, route: "Rapid IV push + flush", repeat: "0.2 mg/kg (max 12 mg) × 1" },
      concHint: "3 mg/mL prefilled syringe; give as close to the heart as possible."
    },
    sources: [
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      { label: "FDA Adenoscan/Adenocard PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=adenosine+injection" }
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 0.1, doseUnit: "mg", perKg: true,
          min: 0.1, max: 0.3, maxAbsolute: 12,
          notes: "Pediatric SVT: 0.1 mg/kg (max 6 mg) IV; may double to 0.2 mg/kg (max 12 mg)."
        }
      }
    }
  },
  {
    id: "lidocaine",
    name: "Lidocaine",
    category: "Antiarrhythmics",
    type: "both",
    bolusConcentrations: [
      { label: "20 mg/mL (2%)", mg: 20, mL: 1 },
      { label: "10 mg/mL (1%)", mg: 10, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "2 g / 250 mL (8 mg/mL)", mg: 2000, mL: 250 }
    ],
    bolus: {
      dose: 1, doseUnit: "mg", perKg: true,
      min: 0.5, max: 1.5, maxAbsolute: 100,
      notes: "VT/VF: 1–1.5 mg/kg IV; repeat 0.5–0.75 mg/kg q5–10 min (max 3 mg/kg)."
    },
    infusion: {
      dose: 2, doseUnit: "mg", perKg: false, perTime: "min",
      min: 0.5, max: 4,
      notes: "Adult (UMHS): 0.5–4 mg/min."
    },
    notes: "MCHC: peds <50kg load 1 mg/kg over 2 min, infusion 20–50 mcg/kg/min (hard max 80). Adult ≥50kg: 0.5–4 mg/min (hard max 5). Conc >4 mg/mL → central line. Therapeutic 1.5–5 mcg/mL.",
    code: {
      role: "VF/pulseless VT alternative (ACLS/PALS)",
      adult: { dose: 1.5, unit: "mg", perKg: true, max: 100, route: "IV/IO", repeat: "0.5–0.75 mg/kg q5–10 min, total ≤ 3 mg/kg" },
      pediatric: { dose: 1, unit: "mg", perKg: true, max: 100, route: "IV/IO", repeat: "May repeat q5–10 min, total ≤ 3 mg/kg" },
      concHint: "Use 20 mg/mL preservative-free for arrest."
    },
    sources: [
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      { label: "FDA Lidocaine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=lidocaine+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 30, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 20, max: 80,
          notes: "UMHS PICU <50 kg: 20–50 mcg/kg/min, hard max 80."
        }
      },
      neonatal: {
        notes: "UMHS NICU (VF/pulseless VT/shock): 1 mg/kg over 2 min, repeat once if delay >15 min; infusion 20–50 mcg/kg/min (hard max 80). Therapeutic 1.5–5 mcg/mL."
      }
    }
  },
  {
    id: "diltiazem",
    name: "Diltiazem",
    category: "Antiarrhythmics",
    type: "both",
    bolusConcentrations: [
      { label: "5 mg/mL (vial)", mg: 5, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "125 mg / 125 mL (1 mg/mL)", mg: 125, mL: 125 },
      { label: "100 mg / 100 mL (1 mg/mL)", mg: 100, mL: 100 }
    ],
    bolus: {
      dose: 0.25, doseUnit: "mg", perKg: true,
      min: 0.2, max: 0.35, maxAbsolute: 25,
      notes: "0.25 mg/kg IV over 2 min; may repeat 0.35 mg/kg in 15 min (max 25 mg)."
    },
    infusion: {
      dose: 5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 5, max: 15,
      notes: "Adult (UMHS): 5–15 mg/hr."
    },
    notes: "MCHC: load 0.25 mg/kg IV over 2 min (max 25 mg); may repeat with 0.35 mg/kg after 15 min. Peds <50kg infusion 0.05–0.2 mg/kg/hr (hard max 0.3). Adult ≥50kg: 5–15 mg/hr (hard max 20).",
    sources: [
      { label: "FDA Cardizem (diltiazem) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=diltiazem+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.1, doseUnit: "mg", perKg: true, perTime: "hr",
          min: 0.05, max: 0.3,
          notes: "UMHS PICU <50 kg: 0.05–0.2 mg/kg/hr, hard max 0.3."
        }
      }
    }
  },
  {
    id: "procainamide",
    name: "Procainamide",
    category: "Antiarrhythmics",
    type: "both",
    bolusConcentrations: [
      { label: "100 mg/mL", mg: 100, mL: 1 },
      { label: "500 mg/mL", mg: 500, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "2 g / 250 mL (8 mg/mL)", mg: 2000, mL: 250 }
    ],
    bolus: {
      dose: 17, doseUnit: "mg", perKg: true,
      min: 15, max: 18, maxAbsolute: 1500,
      notes: "Load 15–18 mg/kg IV (max 1500 mg) over 30 min."
    },
    infusion: {
      dose: 2, doseUnit: "mg", perKg: false, perTime: "min",
      min: 1, max: 4,
      notes: "Adult (UMHS): 1–4 mg/min."
    },
    notes: "MCHC peds <50kg: load 7–15 mg/kg over 30–60 min (max 1500 mg); infusion 20–80 mcg/kg/min (hard max 100, max 2000 mg/24hr). Adult ≥50kg: load 10–17 mg/kg @ 20–50 mg/min OR 100 mg q5min until arrhythmia controlled, hypotension, or QRS widens >50%. Adult infusion 1–4 mg/min (hard max 6). Check PROC/NAPA levels q6–12h. Toxicity PROC >12, NAPA >40 mcg/mL.",
    sources: [
      { label: "FDA Procainamide PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=procainamide" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        infusion: {
          dose: 30, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 20, max: 80,
          notes: "UMHS PICU <50 kg: 20–80 mcg/kg/min."
        }
      }
    }
  },
  {
    id: "atropine",
    name: "Atropine",
    category: "Toxicology",
    type: "bolus",
    concentrations: [
      { label: "0.1 mg/mL", mg: 0.1, mL: 1 },
      { label: "0.4 mg/mL (1 mg / 2.5 mL prefilled)", mg: 0.4, mL: 1 },
      { label: "1 mg/mL (organophosphate kit)", mg: 1, mL: 1 },
    ],
    bolus: {
      dose: 1, doseUnit: "mg", perKg: false,
      min: 0.5, max: 1, maxAbsolute: 3,
      notes: "Bradycardia 0.5–1 mg q3–5 min, max 3 mg. Organophosphate: 2–6 mg, double q5min."
    },
    code: {
      role: "Symptomatic bradycardia (ACLS/PALS)",
      adult: { dose: 1, unit: "mg", perKg: false, route: "IV/IO", repeat: "q3–5 min, total ≤ 3 mg" },
      pediatric: { dose: 0.02, unit: "mg", perKg: true, min: 0.1, max: 0.5, route: "IV/IO", repeat: "May repeat × 1" },
      concHint: "PALS minimum dose 0.1 mg, single max 0.5 mg."
    },
    sources: [
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      UMHS_TOX_SRC
    ],
    notes: "Cholinergic crisis / organophosphate / nerve agent: adult 1–5 mg IV (mild–mod 1–2 mg, severe 3–5 mg), double q3–5 min until bronchial secretions controlled; peds 0.05–0.1 mg/kg q5–10 min, double escalating. Once stable: infusion 10–20% of cumulative atropinizing dose per hr (UMHS Tox E-4).",
    populations: {
      pediatric: {
        bolus: {
          dose: 0.05, doseUnit: "mg", perKg: true,
          min: 0.02, max: 0.1, maxAbsolute: 5,
          notes: "Pediatric bradycardia: 0.02 mg/kg IV (min 0.1 mg, max 1 mg/dose). Cholinergic crisis: 0.05–0.1 mg/kg IV, double q5–10 min until secretions controlled (UMHS Tox E-4)."
        }
      }
    }
  },

  // ---------------- ANTIHYPERTENSIVES ----------------
  {
    id: "esmolol",
    name: "Esmolol",
    category: "Antihypertensives",
    type: "both",
    concentrations: [
      { label: "10 mg/mL (2500 mg / 250 mL)", mg: 2500, mL: 250 },
      { label: "20 mg/mL (premix)", mg: 2000, mL: 100 }
    ],
    bolus: {
      dose: 500, doseUnit: "mcg", perKg: true,
      min: 250, max: 500, maxAbsolute: 80000,
      notes: "Loading dose: 500 mcg/kg IV over 1 min before titrating drip."
    },
    infusion: {
      dose: 50, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 25, max: 300,
      notes: "Adult (UMHS): 25–50 mcg/kg/min start, hard max 300."
    },
    notes: "MCHC: load 50–500 mcg/kg over 1 min; infusion 50–250 mcg/kg/min (hard max 800). No diluent — straight drug.",
    sources: [
      { label: "FDA Brevibloc (esmolol) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=esmolol" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        bolus: {
          dose: 250, doseUnit: "mcg", perKg: true,
          min: 50, max: 500, maxAbsolute: 80000,
          notes: "UMHS PICU load: 50–500 mcg/kg IV over 1 min."
        },
        infusion: {
          dose: 100, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 50, max: 800,
          notes: "UMHS PICU: 50–250 mcg/kg/min, hard max 800."
        }
      },
      neonatal: {
        notes: "UMHS NICU: load 50–500 mcg/kg over 1 min; infusion 50–250 mcg/kg/min (hard max 800). MD order required for each dose change. No diluent."
      }
    }
  },
  {
    id: "nicardipine",
    name: "Nicardipine",
    category: "Antihypertensives",
    type: "infusion",
    concentrations: [
      { label: "25 mg / 250 mL (0.1 mg/mL)", mg: 25, mL: 250 },
      { label: "20 mg / 200 mL (0.1 mg/mL)", mg: 20, mL: 200 },
      { label: "40 mg / 200 mL (0.2 mg/mL)", mg: 40, mL: 200 }
    ],
    infusion: {
      dose: 5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 2.5, max: 15,
      notes: "Adult (UMHS): 2.5–5 mg/hr start, titrate by 2.5 mg/hr q5–15 min, hard max 15 mg/hr."
    },
    notes: "MCHC peds <50kg: 0.5–5 mcg/kg/min (hard max 6). Adult ≥50kg or ≥18 yo: 5–15 mg/hr (hard max 15). Conc >0.2 mg/mL → central line. Change peripheral site q12h. Risk of phlebitis/extravasation peripherally.",
    sources: [
      { label: "FDA Cardene IV (nicardipine) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=nicardipine" },
      { label: "Neurocritical Care Society BP Guidelines", url: "https://www.neurocriticalcare.org/Portals/0/NCS%20Guidelines%20Documents/NCS%20Hypertension%20in%20ICH%20Guidelines.pdf" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 1, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.5, max: 6,
          notes: "UMHS PICU <50 kg: 0.5–5 mcg/kg/min, hard max 6."
        }
      },
      neonatal: {
        infusion: {
          dose: 1, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.5, max: 5,
          notes: "UMHS NICU: 0.5–2 mcg/kg/min, hard max 5."
        },
        notes: "UMHS NICU: 0.5–2 mcg/kg/min, hard max 5. Conc >0.2 mg/mL → central line. Rotate peripheral site q12h."
      }
    }
  },
  {
    id: "labetalol",
    name: "Labetalol",
    category: "Antihypertensives",
    type: "both",
    bolusConcentrations: [
      { label: "5 mg/mL (vial)", mg: 5, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "1 mg/mL (200 mg / 200 mL)", mg: 200, mL: 200 },
      { label: "2 mg/mL (500 mg / 250 mL)", mg: 500, mL: 250 }
    ],
    bolus: {
      dose: 10, doseUnit: "mg", perKg: false,
      min: 10, max: 20, maxAbsolute: 80,
      notes: "10–20 mg IV over 2 min; double q10 min to max 80 mg per dose (300 mg cumulative)."
    },
    infusion: {
      dose: 1, doseUnit: "mg", perKg: false, perTime: "min",
      min: 0.5, max: 3,
      notes: "Adult (UMHS): 0.5–1 mg/min, hard max 3 mg/min. Cumulative max 300 mg."
    },
    notes: "MCHC: bolus 0.2–1 mg/kg over 2 min (max 40 mg/dose, max 10 mg/min). Peds <50kg 0.25–3 mg/kg/hr (hard max 3). Adult ≥50kg: 0.5–2 mg/min (hard max 6). Conc >2 mg/mL → central line.",
    sources: [
      { label: "FDA Labetalol PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=labetalol" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        bolus: {
          dose: 0.5, doseUnit: "mg", perKg: true,
          min: 0.2, max: 1, maxAbsolute: 40,
          notes: "UMHS PICU bolus: 0.2–1 mg/kg, max 40 mg."
        },
        infusion: {
          dose: 0.5, doseUnit: "mg", perKg: true, perTime: "hr",
          min: 0.25, max: 3,
          notes: "UMHS PICU <50 kg: 0.25–3 mg/kg/hr."
        }
      },
      neonatal: {
        notes: "UMHS NICU: bolus 0.2–1 mg/kg over 2 min; infusion 0.25–3 mg/kg/hr (hard max 3). Conc >2 mg/mL → central line."
      }
    }
  },
  {
    id: "hydralazine",
    name: "Hydralazine",
    category: "Antihypertensives",
    type: "bolus",
    concentrations: [
      { label: "20 mg/mL", mg: 20, mL: 1 },
      { label: "10 mg / 10 mL (1 mg/mL) diluted", mg: 10, mL: 10 },
    ],
    bolus: {
      dose: 10, doseUnit: "mg", perKg: false,
      min: 5, max: 20, maxAbsolute: 20,
      notes: "5–20 mg IV q4–6h."
    },
    sources: [
      { label: "FDA Hydralazine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=hydralazine" }
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 0.2, doseUnit: "mg", perKg: true,
          min: 0.1, max: 0.5, maxAbsolute: 20,
          notes: "Pediatric: 0.1–0.5 mg/kg IV q4–6h (max 20 mg/dose)."
        }
      }
    }
  },
  {
    id: "nitroglycerin",
    name: "Nitroglycerin",
    category: "Antihypertensives",
    type: "infusion",
    concentrations: [
      { label: "50 mg / 250 mL (200 mcg/mL)", mg: 50, mL: 250 },
      { label: "100 mg / 250 mL (400 mcg/mL)", mg: 100, mL: 250 }
    ],
    infusion: {
      dose: 10, doseUnit: "mcg", perKg: false, perTime: "min",
      min: 5, max: 200,
      notes: "Adult (UMHS): start 5–10 mcg/min, hard max 200 mcg/min."
    },
    notes: "MCHC peds <50kg: 0.5–5 mcg/kg/min (hard max 20). Adult ≥50kg or ≥18 yo: 5–200 mcg/min (hard max 210). Conc >0.2 mg/mL → central line. Use special low-sorbing IV tubing.",
    sources: [
      { label: "FDA Nitroglycerin Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=nitroglycerin+injection" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        infusion: {
          dose: 1, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.5, max: 20,
          notes: "UMHS PICU <50 kg: 0.5–5 mcg/kg/min, hard max 20."
        }
      }
    }
  },
  {
    id: "nitroprusside",
    name: "Nitroprusside (Nipride)",
    category: "Antihypertensives",
    type: "infusion",
    concentrations: [
      { label: "50 mg / 100 mL (0.5 mg/mL)", mg: 50, mL: 100 },
      { label: "50 mg / 250 mL (200 mcg/mL)", mg: 50, mL: 250 },
      { label: "100 mg / 250 mL (400 mcg/mL)", mg: 100, mL: 250 }
    ],
    infusion: {
      dose: 0.3, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.2, max: 10,
      notes: "Adult (UMHS): 0.2–0.5 mcg/kg/min start, hard max 10. Cyanide risk if >2 mcg/kg/min sustained."
    },
    notes: "MCHC: 0.3–10 mcg/kg/min (hard max 11). Doses >400 mcg/min not recommended (thiocyanate toxicity risk). Check cyanide/thiocyanate q24h. CN toxicity >2 mcg/mL; SCN toxicity >35 mcg/mL. Conc >0.5 mg/mL → central line. Protect syringe from light.",
    sources: [
      { label: "FDA Nitropress (nitroprusside) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=nitroprusside" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_MCHC_SRC
  ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.3, max: 11,
          notes: "UMHS PICU: 0.3–10 mcg/kg/min, hard max 11. Cyanide risk."
        }
      }
    }
  },
  {
    id: "clevidipine",
    name: "Clevidipine (Cleviprex)",
    category: "Antihypertensives",
    type: "infusion",
    concentrations: [
      { label: "25 mg / 50 mL (0.5 mg/mL)", mg: 25, mL: 50 },
      { label: "50 mg / 100 mL (0.5 mg/mL)", mg: 50, mL: 100 }
    ],
    infusion: {
      dose: 1, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 1, max: 16,
      notes: "Adult (UMHS): 1–2 mg/hr start, double q90 sec, hard max 16 mg/hr."
    },
    sources: [
      { label: "FDA Cleviprex (clevidipine) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=clevidipine" },
      UMHS_ADULT_SRC
    ]
  },

  // ---------------- ANTICONVULSANTS ----------------
  {
    id: "lorazepam",
    name: "Lorazepam (Ativan)",
    category: "Sedation",
    type: "both",
    bolusConcentrations: [
      { label: "2 mg/mL — per user protocol", mg: 2, mL: 1 },
      { label: "4 mg/mL", mg: 4, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "60 mg / 30 mL (2 mg/mL) — per user protocol", mg: 60, mL: 30 },
      { label: "40 mg / 250 mL (0.16 mg/mL) premix", mg: 40, mL: 250 }
    ],
    bolus: {
      dose: 0.1, doseUnit: "mg", perKg: true,
      min: 0.05, max: 0.1, maxAbsolute: 4,
      notes: "Status epilepticus 0.1 mg/kg IV (max 4 mg/dose), may repeat × 1. Also used for agitation/anxiolysis: 1–2 mg IV q2–4 h prn."
    },
    infusion: {
      dose: 2, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 1, max: 20,
      notes: "Adult (UMHS): 1–10 mg/hr, hard max 20. Propylene glycol toxicity at high cumulative doses."
    },
    sources: [
      { label: "Neurocritical Care Society Status Epilepticus 2012", url: "https://link.springer.com/article/10.1007/s12028-012-9695-z" },
      { label: "FDA Ativan PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=lorazepam+injection" },
      UMHS_ADULT_SRC
    ]
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
    },
    sources: [
      { label: "ESETT trial (NEJM 2019)", url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1905795" },
      { label: "FDA Keppra PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=levetiracetam+injection" }
    ]
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
    },
    sources: [
      { label: "FDA Cerebyx (fosphenytoin) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=fosphenytoin" }
    ]
  },

  // ---------------- DIURETICS ----------------
  {
    id: "furosemide",
    name: "Furosemide (Lasix) infusion",
    category: "Other",
    type: "infusion",
    concentrations: [
      { label: "500 mg / 50 mL (10 mg/mL)", mg: 500, mL: 50 },
      { label: "100 mg / 100 mL (1 mg/mL)", mg: 100, mL: 100 }
    ],
    infusion: {
      dose: 5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 5, max: 200,
      notes: "Adult (UMHS): 5–10 mg/hr, hard max 200 mg/hr."
    },
    notes: "MCHC peds <50kg: 0.3–0.7 mg/kg/hr (hard max 1.5). Adult ≥50kg: 5–40 mg/hr (hard max 160). 10 mg/mL has no diluent.",
    sources: [
      { label: "FDA Furosemide PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=furosemide+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.1, doseUnit: "mg", perKg: true, perTime: "hr",
          min: 0.05, max: 1.5,
          notes: "UMHS PICU <50 kg: 0.05–1 mg/kg/hr, hard max 1.5."
        }
      },
      neonatal: {
        infusion: {
          dose: 0.1, doseUnit: "mg", perKg: true, perTime: "hr",
          min: 0.05, max: 1.5,
          notes: "UMHS NICU: 0.05–1 mg/kg/hr, hard max 1.5."
        },
        notes: "UMHS NICU: 0.05–1 mg/kg/hr (hard max 1.5). 10 mg/mL is straight drug — no diluent."
      }
    }
  },
  {
    id: "bumetanide",
    name: "Bumetanide infusion",
    category: "Other",
    type: "infusion",
    concentrations: [
      { label: "12.5 mg / 50 mL (0.25 mg/mL)", mg: 12.5, mL: 50 }
    ],
    infusion: {
      dose: 1, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 1, max: 5,
      notes: "Adult (UMHS): 1–4 mg/hr, hard max 5."
    },
    sources: [
      { label: "FDA Bumex (bumetanide) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=bumetanide" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.02, doseUnit: "mg", perKg: true, perTime: "hr",
          min: 0.01, max: 0.08,
          notes: "UMHS PICU: 0.01–0.05 mg/kg/hr, hard max 0.08."
        }
      }
    }
  },

  // ---------------- REVERSAL ----------------
  {
    id: "naloxone",
    name: "Naloxone (Narcan)",
    category: "Reversal",
    secondaryCategories: ["Toxicology"],
    type: "both",
    bolusConcentrations: [
      { label: "0.4 mg/mL", mg: 0.4, mL: 1 },
      { label: "1 mg/mL", mg: 1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "2 mg / 500 mL (0.004 mg/mL)", mg: 2, mL: 500 }
    ],
    bolus: {
      dose: 0.4, doseUnit: "mg", perKg: false,
      min: 0.04, max: 2, maxAbsolute: 10,
      notes: "0.04–0.4 mg IV q2–3 min titrated to RR. Full reversal 2 mg."
    },
    infusion: {
      dose: 0.5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 0.25, max: 1,
      notes: "Adult (UMHS) opioid drip: 0.25–1 mg/hr (no max). Set rate at ⅔ of total reversal bolus per hour."
    },
    code: {
      role: "Opioid-induced respiratory arrest / suspected OD",
      adult: { dose: 0.4, unit: "mg", perKg: false, route: "IV/IO/IM/IN", repeat: "Re-dose 0.4–2 mg q2–3 min, titrate to RR ≥ 12" },
      pediatric: { dose: 0.1, unit: "mg", perKg: true, max: 2, route: "IV/IO/IM/IN", repeat: "Re-dose q2–3 min" },
      concHint: "0.4 mg/mL ampule or 1 mg/mL prefilled. IN: 1 mg/mL split per nostril."
    },
    sources: [
      { label: "FDA Naloxone PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=naloxone" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC, UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 30, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 20, max: 40,
          notes: "UMHS PICU opioid reversal: 20–40 mcg/kg/hr."
        }
      }
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
    },
    sources: [
      { label: "FDA Romazicon (flumazenil) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=flumazenil" }
    ]
  },
  {
    id: "calcium_gluconate",
    name: "Calcium Gluconate",
    category: "Reversal",
    secondaryCategories: ["Toxicology"],
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL (10%)", mg: 100, mL: 1 },
      { label: "1 g / 50 mL (2% premix, 20 mg/mL)", mg: 1000, mL: 50 },
      { label: "1 g / 100 mL (1%, 10 mg/mL)", mg: 1000, mL: 100 },
    ],
    bolus: {
      dose: 1000, doseUnit: "mg", perKg: false,
      min: 1000, max: 3000, maxAbsolute: 3000,
      notes: "HyperK / CCB tox: 1–3 g IV (1 amp = 1 g). Slow push."
    },
    sources: [
      { label: "FDA Calcium Gluconate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=calcium+gluconate+injection" }
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 60, doseUnit: "mg", perKg: true,
          min: 30, max: 100, maxAbsolute: 3000,
          notes: "Pediatric hyperK/CCB tox: 30–100 mg/kg IV (max 3 g)."
        }
      }
    }
  },
  {
    id: "sodium_bicarb",
    name: "Sodium Bicarbonate",
    category: "Reversal",
    secondaryCategories: ["Toxicology"],
    type: "bolus",
    concentrations: [
      { label: "1 mEq/mL (8.4%) — per user protocol", mg: 1, mL: 1, isUnits: true, unitsLabel: "mEq" }
    ],
    bolus: {
      dose: 1, doseUnit: "mEq", perKg: true,
      min: 0.5, max: 2, maxAbsolute: 100,
      notes: "TCA tox / salicylate / severe acidosis 1–2 mEq/kg IV. Then continuous infusion 150 mEq in 1 L D5W or D5 ½ NS at 2–3 mL/kg/hr; goal serum pH 7.50–7.55, urine pH 7.5–8 for salicylates (UMHS Tox E-4)."
    },
    code: {
      role: "Severe acidosis / TCA tox / hyperK in arrest",
      adult: { dose: 1, unit: "mEq", perKg: true, max: 100, route: "IV/IO", repeat: "0.5 mEq/kg q10 min as needed" },
      pediatric: { dose: 1, unit: "mEq", perKg: true, max: 50, route: "IV/IO slow push", repeat: "0.5 mEq/kg q10 min" },
      concHint: "8.4% = 1 mEq/mL. Dilute 1:1 with sterile water for infants."
    },
    sources: [
      { label: "FDA Sodium Bicarbonate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=sodium+bicarbonate+injection" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "maintenance_mlkg",
    name: "IVF Bolus",
    category: "IVF Bolus",
    type: "bolus",
    customCalc: "maintenance_mlkg",
    populations: {
      adult:     { _showInPopulation: true },
      pediatric: { _showInPopulation: true },
      neonatal:  { _showInPopulation: true }
    },
    notes: "Weight-based isotonic crystalloid volumes (5 / 10 / 20 mL/kg). 20 mL/kg is the standard pediatric resuscitation bolus; 10 mL/kg for cautious resuscitation (neonates, cardiac, TBI/SIADH risk); 5 mL/kg for very conservative volumes. Use NS or LR; reassess after each bolus.",
    sources: [
      { label: "PALS 2020 — Shock & Fluid Resuscitation", url: "https://cpr.heart.org/en/cpr-courses-and-kits/healthcare-professional/pals" },
      { label: "Surviving Sepsis Campaign: Pediatrics 2020", url: "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines/Pediatric-Patients" },
      { label: "ATLS 10th Edition — Shock", url: "https://www.facs.org/quality-programs/trauma/education/advanced-trauma-life-support/" }
    ]
  },
  {
    id: "maintenance_421",
    name: "Pediatric Maintenance Fluid",
    category: "Maintenance",
    type: "infusion",
    customCalc: "maintenance_421",
    populations: {
      pediatric: { _showInPopulation: true },
      neonatal:  { _showInPopulation: true },
      adult:     { _showInPopulation: true }
    },
    notes: "Holliday-Segar 4-2-1 rule for ongoing maintenance IV fluid rate: 4 mL/kg/hr for the first 10 kg, +2 mL/kg/hr for the next 10 kg, +1 mL/kg/hr for each kg above 20. Daily total ≈ 100/50/20 mL/kg/day by the same tiers. Use isotonic fluid (D5NS, D5LR, or per local protocol) — hypotonic fluids increase hyponatremia risk in hospitalized children (AAP 2018).",
    sources: [
      { label: "AAP Clinical Practice Guideline: Maintenance IV Fluids in Children (2018)", url: "https://publications.aap.org/pediatrics/article/142/6/e20183083/37529/Clinical-Practice-Guideline-Maintenance-Intravenous" },
      { label: "Holliday MA, Segar WE. The maintenance need for water in parenteral fluid therapy. Pediatrics 1957;19:823.", url: "https://publications.aap.org/pediatrics/article-abstract/19/5/823/40898" },
      { label: "PALS 2020 — Pediatric Fluid Management", url: "https://cpr.heart.org/en/cpr-courses-and-kits/healthcare-professional/pals" }
    ]
  },

  // ---------------- ALBUTEROL (nebulized) ----------------
  // Nebulized albuterol doesn't fit the concentration×dose model so it uses a
  // bespoke custom calc that surfaces weight-banded intermittent + continuous
  // doses. Doses match UMHS/Johns Hopkins/OHSU asthma pathways. Note: the
  // weight bands and continuous-neb caps are conservative — some institutions
  // use 15–20 mg/hr for >20 kg peds. Adult max 30 mg/hr without MD consult.
  {
    id: "albuterol",
    name: "Albuterol (nebulized)",
    category: "Respiratory",
    type: "bolus",
    customCalc: "albuterol_neb",
    populations: {
      pediatric: { _showInPopulation: true },
      neonatal:  { _showInPopulation: true },
      adult:     { _showInPopulation: true }
    },
    notes: "Pediatric weight bands: 5–10 kg → 2.5 mg q20 min × 3 then q1–4 hr, OR 7.5 mg/hr continuous neb. 10–20 kg → 2.5 mg q20 min × 3 then q1–4 hr, OR 10 mg/hr continuous. >20 kg → 5 mg q20 min × 3 then q1–4 hr, OR 15 mg/hr continuous (peds MAX 20 mg/hr without MD consult). Adult: 5 mg q20 min × 3 then 5–10 mg q1–4 hr, OR 15 mg/hr continuous (MAX 30 mg/hr without MD consult). Standard amp = 2.5 mg / 3 mL (0.083%). Watch for tachycardia, tremor, hypokalemia, lactic acidosis with high-dose/prolonged continuous use.",
    sources: [
      { label: "GINA Global Strategy for Asthma Management 2024", url: "https://ginasthma.org/2024-report/" },
      { label: "Johns Hopkins All Children’s Asthma Clinical Pathway", url: "https://www.hopkinsmedicine.org/-/media/files/allchildrens/clinical-pathways/jhach-asthma-clinical-pathway-5_16_23.pdf" },
      { label: "OHSU Pediatric Asthma Clinical Pathway", url: "https://www.ohsu.edu/sites/default/files/2021-08/DCH%20ED%20Asthma-Clinical-Pathway_August%202021.pdf" },
      { label: "UNC Continuous Albuterol Pathway for Asthma Patients (2024)", url: "https://www.med.unc.edu/pediatrics/cccp/wp-content/uploads/sites/1156/2024/02/Continuous-Albuterol-Pathway.pdf" },
      { label: "NHLBI EPR-3 Guidelines for Diagnosis and Management of Asthma", url: "https://www.nhlbi.nih.gov/health-topics/guidelines-for-diagnosis-management-of-asthma" }
    ]
  },

  // ---------------- ELECTRICAL THERAPY (Code tab only) ----------------
  // These entries are surfaced ONLY in the Code tab. They have:
  //   - codeOnly: true       → hidden from "All", search, and category lists
  //   - code: {...}          → makes them appear in codeMeds()
  //   - customCalc: "..."    → opens a bespoke joules panel instead of mg dosing
  {
    id: "defibrillation",
    name: "Defibrillation",
    category: "_codeOnly",
    codeOnly: true,
    type: "bolus",
    customCalc: "defibrillation",
    populations: {
      adult:     { _showInPopulation: true },
      pediatric: { _showInPopulation: true },
      neonatal:  { _showInPopulation: true }
    },
    code: {
      role: "Defibrillation",
      adult:     { dose: 200, unit: "J", perKg: false, repeat: "Subsequent shocks 200–360 J biphasic" },
      pediatric: { dose: 2,   unit: "J", perKg: true, max: 200, repeat: "2 J/kg → 4 J/kg → ≥4 J/kg (max 10 J/kg or adult dose)" }
    },
    notes: "VF / pulseless VT — UNSYNCHRONIZED shock. Adult: 200 J biphasic (escalate up to 360 J). Pediatric: 2 J/kg first shock, 4 J/kg second, then ≥4 J/kg up to 10 J/kg or adult dose. Resume CPR immediately for 2 min after each shock; do not pulse-check between shocks.",
    sources: [
      { label: "AHA ACLS Adult Cardiac Arrest Algorithm (2020)", url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines" },
      { label: "AHA PALS Pediatric Cardiac Arrest Algorithm (2020)", url: "https://cpr.heart.org/en/cpr-courses-and-kits/healthcare-professional/pals" },
      { label: "ERC Guidelines 2021 — Adult Advanced Life Support", url: "https://cprguidelines.eu/" }
    ]
  },
  {
    id: "cardioversion",
    name: "Synchronized Cardioversion",
    category: "_codeOnly",
    codeOnly: true,
    type: "bolus",
    customCalc: "cardioversion",
    populations: {
      adult:     { _showInPopulation: true },
      pediatric: { _showInPopulation: true },
      neonatal:  { _showInPopulation: true }
    },
    code: {
      role: "Synch cardioversion",
      adult:     { dose: 100, unit: "J", perKg: false, repeat: "SVT/AFlutter 50–100 J; AFib 120–200 J; monomorphic VT 100 J (escalate if needed)" },
      pediatric: { dose: 0.5, unit: "J", perKg: true, max: 200, repeat: "0.5–1 J/kg → 2 J/kg if ineffective" }
    },
    notes: "Unstable tachyarrhythmia WITH a pulse — SYNCHRONIZED shock. Adult initial energies: narrow regular (SVT/AFlutter) 50–100 J, narrow irregular (AFib) 120–200 J, wide regular (monomorphic VT) 100 J, wide irregular treat as VF (unsynchronized). Pediatric: start 0.5–1 J/kg, escalate to 2 J/kg. Sedate if conscious. Confirm sync mode is engaged before every shock — it re-arms between shocks on most devices.",
    sources: [
      { label: "AHA ACLS Adult Tachycardia With a Pulse Algorithm (2020)", url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines" },
      { label: "AHA PALS Pediatric Tachycardia With a Pulse Algorithm (2020)", url: "https://cpr.heart.org/en/cpr-courses-and-kits/healthcare-professional/pals" },
      { label: "ERC Guidelines 2021 — Adult Advanced Life Support", url: "https://cprguidelines.eu/" }
    ]
  },

  {
    id: "hypertonic_saline_3",
    name: "3% Saline (Hypertonic)",
    category: "Other",
    secondaryCategories: ["Anticonvulsants"],
    type: "bolus",
    concentrations: [
      { label: "3% Saline (30 mg/mL, 500 mL bag) — per user protocol", mg: 1, mL: 1, isUnits: true, unitsLabel: "mL" }
    ],
    bolus: {
      dose: 3, doseUnit: "mL", perKg: true,
      min: 2, max: 5, maxAbsolute: 250,
      notes: "TBI / herniation / symptomatic hyponatremia: 2–5 mL/kg of 3% saline IV over 10–20 min (typical adult 250 mL). Central line preferred; peripheral acceptable for short-duration boluses. Recheck Na⁺ q2–4 h; rate of correction ≤ 8–10 mEq/L per 24 h."
    },
    notes: "Carried as 500 mL bag. Dose is expressed as mL/kg of 3% saline fluid (3 g NaCl / 100 mL = 30 mg/mL = 513 mEq/L Na⁺).",
    sources: [
      { label: "FDA Sodium Chloride 3% PI (DailyMed)", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=sodium+chloride+3%25" },
      { label: "Neurocritical Care Society Hypertonic Saline Guidelines", url: "https://www.neurocriticalcare.org/clinical-resources/guidelines" }
    ]
  },
  {
    id: "tham",
    name: "THAM (Tromethamine)",
    category: "Reversal",
    type: "bolus",
    concentrations: [
      { label: "0.3 M (36 mg/mL, 0.3 mEq/mL)", mg: 1, mL: 1, isUnits: true, unitsLabel: "mL of 0.3 M" }
    ],
    bolus: {
      dose: 1.1, doseUnit: "mL of 0.3 M", perKg: true,
      min: 1.1, max: 5.5, maxAbsolute: 1000,
      notes: "UMHS ARDS Appendix B-1, Fig. 6 (THAM 0.3 M): required mL per dose = actual body weight (kg) × base deficit (mEq/L) × 1.1. Example: 90 kg patient with base deficit 5 mEq/L → 90 × 5 × 1.1 = 495 mL. Avoid rapid administration; when feasible infuse over 1 hour. Use the largest IV / central line preferred (extravasation causes tissue necrosis). Monitor for fluid overload, blood glucose, pH, and hyperkalemia. Avoid in anuria/uremia, infants < 1 mo."
    },
    // Optional base-excess–driven formula helper. When present, the bolus
    // calculator surfaces a small panel that converts a measured arterial BE
    // into the per-kg dose that the existing concentration×dose engine uses.
    //   dose_perKg = |BE| × factor   (here factor = 1.1 mL of 0.3 M per mEq/L)
    // Negative BE = base deficit (the clinical trigger). Positive BE means
    // alkalosis and the formula is not indicated; the helper warns instead of
    // computing. This only augments the standard output — it does not replace it.
    beFormula: {
      factor: 1.1,
      factorUnit: "mL of 0.3 M",
      label: "ARDS guideline formula (THAM 0.3 M)",
      formula: "Required mL per dose = actual body weight (kg) × base deficit (mEq/L) × 1.1",
      example: "90 kg with base deficit 5 mEq/L → 90 × 5 × 1.1 = 495 mL",
      help: "UMHS ARDS Appendix B-1, Fig. 6: Required mL per dose = actual body weight (kg) × base deficit (mEq/L) × 1.1. Enter the patient's arterial base excess (mEq/L); base deficit is the absolute value of a negative BE."
    },
    sources: [
      UMHS_ARDS_SRC,
      { label: "FDA THAM (tromethamine) PI — Pfizer", url: "https://labeling.pfizer.com/ShowLabeling.aspx?id=4642" },
      { label: "Medscape THAM Dosing Reference", url: "https://reference.medscape.com/drug/tham-tromethamine-342884" }
    ]
  },

  // ---------------- ELECTROLYTES ----------------
  {
    id: "magnesium",
    name: "Magnesium Sulfate",
    category: "Electrolytes",
    secondaryCategories: ["Toxicology"],
    type: "bolus",
    concentrations: [
      { label: "500 mg/mL (50%)", mg: 500, mL: 1 },
      { label: "2 g / 100 mL (20 mg/mL)", mg: 2000, mL: 100 }
    ],
    bolus: {
      dose: 2000, doseUnit: "mg", perKg: false,
      min: 1000, max: 4000, maxAbsolute: 4000,
      notes: "Torsades / severe asthma: 2 g IV over 10–20 min. Eclampsia: 4–6 g load."
    },
    code: {
      role: "Torsades de pointes / refractory VF (ACLS/PALS)",
      adult: { dose: 2, unit: "g", perKg: false, route: "IV/IO over 5–20 min (arrest: push)", repeat: "May repeat 2 g × 1" },
      pediatric: { dose: 50, unit: "mg", perKg: true, max: 2000, route: "IV/IO over 10–20 min", repeat: "Single dose" },
      concHint: "500 mg/mL vial; dilute to ≤ 60 mg/mL for non-arrest infusion."
    },
    sources: [
      { label: "FDA Magnesium Sulfate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=magnesium+sulfate+injection" },
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 50, doseUnit: "mg", perKg: true,
          min: 25, max: 75, maxAbsolute: 2000,
          notes: "UMHS PICU load: 25–75 mg/kg IV (max 2000 mg)."
        }
      }
    }
  },
  {
    id: "potassium",
    name: "Potassium Chloride (peripheral)",
    category: "Electrolytes",
    type: "infusion",
    concentrations: [
      { label: "10 mEq / 100 mL (0.1 mEq/mL) peripheral", mg: 10, mL: 100, isUnits: true, unitsLabel: "mEq" },
      { label: "20 mEq / 100 mL (0.2 mEq/mL) peripheral", mg: 20, mL: 100, isUnits: true, unitsLabel: "mEq" },
      { label: "40 mEq / 100 mL (0.4 mEq/mL) central line only", mg: 40, mL: 100, isUnits: true, unitsLabel: "mEq" },
    ],
    infusion: {
      dose: 10, doseUnit: "mEq", perKg: false, perTime: "hr",
      min: 10, max: 20,
      notes: "Peripheral max 10 mEq/hr; central up to 20 mEq/hr (with monitoring)."
    },
    sources: [
      { label: "ASHP IV KCl Guidelines", url: "https://www.ashp.org/-/media/assets/policy-guidelines/docs/best-practices/medication-misadventures/best-practices-position-on-ivpb-and-large-volume-injectable-potassium-chloride.ashx" }
    ]
  },
  {
    id: "dextrose50",
    name: "Dextrose 50%",
    category: "Electrolytes",
    type: "bolus",
    concentrations: [
      { label: "0.5 g/mL (D50)", mg: 500, mL: 1 },
      { label: "D25W (250 mg/mL)", mg: 250, mL: 1 },
      { label: "D10W (100 mg/mL)", mg: 100, mL: 1 },
    ],
    bolus: {
      dose: 25000, doseUnit: "mg", perKg: false,
      min: 12500, max: 25000, maxAbsolute: 25000,
      notes: "Hypoglycemia: 25 g IV (50 mL of D50)."
    },
    code: {
      role: "Hypoglycemia (BGL < 70 mg/dL)",
      adult: { dose: 25, unit: "g", perKg: false, route: "IV slow push", repeat: "Recheck BGL in 10 min" },
      pediatric: { dose: 0.5, unit: "g", perKg: true, max: 25, route: "IV (D25W in children, D10W in neonates)", repeat: "Recheck BGL in 10 min" },
      concHint: "Adult: 50 mL of D50 = 25 g. Peds: use D25W (2 mL/kg = 0.5 g/kg). Neonates: D10W (5–10 mL/kg)."
    },
    sources: [
      { label: "FDA Dextrose 50% PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=dextrose+50" }
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 250, doseUnit: "mg", perKg: true,
          min: 250, max: 500, maxAbsolute: 25000,
          notes: "Pediatric hypoglycemia: 0.5–1 g/kg IV (use D25 or D10 — D50 too concentrated for peripheral use in children)."
        }
      }
    }
  },
  {
    id: "calcium_chloride_gtt",
    name: "Calcium Chloride infusion",
    category: "Electrolytes",
    secondaryCategories: ["Toxicology"],
    type: "infusion",
    concentrations: [
      { label: "1 g / 100 mL (10 mg/mL)", mg: 1000, mL: 100 }
    ],
    infusion: {
      dose: 10, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 2.5, max: 30,
      notes: "UMHS PICU: 2.5–20 mg/kg/hr, hard max 30."
    },
    code: {
      role: "Hyperkalemia / Ca-channel blocker tox / hypocalcemia in arrest",
      adult: { dose: 1, unit: "g", perKg: false, route: "IV/IO over 5–10 min", repeat: "May repeat q10 min" },
      pediatric: { dose: 20, unit: "mg", perKg: true, max: 1000, route: "IV/IO over 5–10 min", repeat: "May repeat" },
      concHint: "10% CaCl₂ = 100 mg/mL. Central line preferred (vesicant)."
    },
    sources: [
      { label: "FDA Calcium Chloride PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=calcium+chloride+injection" },
      UMHS_PEDS_SRC
    ]
  },

  // ---------------- ANTICOAGULATION / OTHER ----------------
  {
    id: "heparin",
    name: "Heparin",
    category: "Blood Thinners",
    type: "both",
    bolusConcentrations: [
      { label: "100 units/mL", mg: 100, mL: 1, isUnits: true, unitsLabel: "units" },
      { label: "1000 units/mL", mg: 1000, mL: 1, isUnits: true, unitsLabel: "units" }
    ],
    infusionConcentrations: [
      { label: "25,000 units / 250 mL (100 u/mL)", mg: 25000, mL: 250, isUnits: true, unitsLabel: "units" }
    ],
    bolus: {
      dose: 80, doseUnit: "units", perKg: true,
      min: 60, max: 80, maxAbsolute: 5000,
      notes: "ACS: 60 u/kg (max 4000). VTE: 80 u/kg. Per institutional protocol."
    },
    infusion: {
      dose: 18, doseUnit: "units", perKg: true, perTime: "hr",
      min: 12, max: 18,
      notes: "Adult: VTE 18 u/kg/hr; ACS 12 u/kg/hr. Adjust per aPTT/anti-Xa."
    },
    notes: "MCHC: load 50–100 units/kg over 15 min (per MD); infusion 10–20 units/kg/hr (hard max 75). ECMO load 100 units/kg, infusion 10–40 units/kg/hr (hard max 100). Monitor aPTT or anti-Xa.",
    sources: [
      { label: "FDA Heparin Sodium PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=heparin+sodium+injection" },
      UMHS_PEDS_SRC,
    UMHS_NICU_SRC,
  UMHS_MCHC_SRC
],
    populations: {
      pediatric: {
        infusion: {
          dose: 15, doseUnit: "units", perKg: true, perTime: "hr",
          min: 10, max: 75,
          notes: "UMHS PICU: 10–20 units/kg/hr, hard max 75 (ECMO 100). Adjust per anti-Xa."
        }
      },
      neonatal: {
        notes: "UMHS NICU: NO load for neonates (ECMO load 100 units/kg × 1). Infusion 10–20 units/kg/hr (hard max 75); ECMO 10–50 units/kg/hr (hard max 100). ECMO follows ACTs until stable, then anti-Xa."
      }
    }
  },
  {
    id: "tranexamic",
    name: "Tranexamic Acid (TXA)",
    category: "Other",
    secondaryCategories: ["Toxicology", "Blood Thinners"],
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL (1 g / 10 mL vial)", mg: 100, mL: 1 },
      { label: "1 g / 100 mL (10 mg/mL) diluted in NS", mg: 1000, mL: 100 },
      { label: "1 g / 50 mL (20 mg/mL) diluted in NS", mg: 1000, mL: 50 },
    ],
    bolus: {
      dose: 1000, doseUnit: "mg", perKg: false,
      min: 1000, max: 1000, maxAbsolute: 1000,
      notes: "Trauma: 1 g IV over 10 min, then 1 g over 8 hr. Within 3 hr of injury."
    },
    sources: [
      { label: "CRASH-2 trial (Lancet 2010)", url: "https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(10)60835-5/fulltext" },
      { label: "FDA Cyklokapron (TXA) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=tranexamic+acid+injection" }
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 15, doseUnit: "mg", perKg: true,
          min: 10, max: 30, maxAbsolute: 1000,
          notes: "Pediatric trauma: 15 mg/kg IV (max 1 g) over 10 min."
        }
      }
    }
  },
  {
    id: "ondansetron",
    name: "Ondansetron (Zofran)",
    category: "Other",
    type: "bolus",
    concentrations: [
      { label: "2 mg/mL", mg: 2, mL: 1 },
      { label: "4 mg / 2 mL (2 mg/mL) prefilled syringe", mg: 4, mL: 2 },
    ],
    bolus: {
      dose: 4, doseUnit: "mg", perKg: false,
      min: 4, max: 8, maxAbsolute: 16,
      notes: "4 mg IV; up to 8 mg. Max 16 mg/dose (QT prolongation)."
    },
    sources: [
      { label: "FDA Zofran PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=ondansetron+injection" }
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 0.15, doseUnit: "mg", perKg: true,
          min: 0.1, max: 0.15, maxAbsolute: 4,
          notes: "Pediatric: 0.1–0.15 mg/kg IV (max 4 mg/dose)."
        }
      }
    }
  },

  // ---------------- TOXICOLOGY / ANTIDOTES ----------------
  {
    id: "methylene_blue",
    name: "Methylene Blue",
    category: "Toxicology",
    secondaryCategories: ["Pressors"],
    type: "bolus",
    bolusConcentrations: [
      { label: "10 mg/mL (1% solution, 10 mL vial)", mg: 10, mL: 1 },
      { label: "5 mg/mL (0.5% solution)", mg: 5, mL: 1 }
    ],
    bolus: {
      dose: 1, doseUnit: "mg", perKg: true,
      min: 1, max: 2, maxAbsolute: 200,
      notes: "Methemoglobinemia: 1–2 mg/kg IV over 5 min. May repeat in 30–60 min if MetHb still >30% or symptomatic. Cumulative max 7 mg/kg."
    },
    notes: "Indications: methemoglobinemia, refractory vasoplegic shock (1–2 mg/kg over 20 min), ifosfamide encephalopathy. Contraindicated in G6PD deficiency (causes hemolysis) and concurrent serotonergic drugs (serotonin syndrome — MAOI activity). Discolors urine/skin blue-green. Falsely lowers SpO2 reading. Avoid in pregnancy.",
    sources: [
      { label: "FDA Methylene Blue Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=methylene+blue+injection" },
      { label: "AAP Methemoglobinemia Treatment", url: "https://www.ncbi.nlm.nih.gov/books/NBK537317/" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC, UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 1, doseUnit: "mg", perKg: true,
          min: 1, max: 2, maxAbsolute: 50,
          notes: "Pediatric methemoglobinemia: 1–2 mg/kg IV over 5 min. Avoid in infants <4 mo (immature MetHb reductase). Repeat dose if needed; cumulative max 7 mg/kg."
        },
        notes: "Pediatric: same indication and dosing as adult. Avoid in neonates and infants <4 months (risk of hemolysis from immature methemoglobin reductase — use ascorbic acid instead). G6PD screening important."
      },
      neonatal: {
        bolus: {
          dose: 0.3, doseUnit: "mg", perKg: true,
          min: 0.3, max: 1, maxAbsolute: 4,
          notes: "Neonatal methemoglobinemia: 0.3–1 mg/kg IV (lower dose to reduce hemolysis risk). Ascorbic acid 100–500 mg IV often preferred first-line in neonates."
        },
        notes: "Neonatal: lower dose (0.3–1 mg/kg) due to immature methemoglobin reductase and increased hemolysis risk. Consider ascorbic acid as alternative first-line. Avoid entirely if G6PD deficient."
      }
    }
  },
  {
    id: "hydroxocobalamin",
    name: "Hydroxocobalamin (Cyanokit)",
    category: "Toxicology",
    secondaryCategories: ["Pressors"],
    type: "bolus",
    bolusConcentrations: [
      { label: "25 mg/mL (5 g / 200 mL reconstituted)", mg: 25, mL: 1 }
    ],
    bolus: {
      dose: 5000, doseUnit: "mg", perKg: false,
      min: 5000, max: 10000, maxAbsolute: 10000,
      notes: "Cyanide toxicity (adult): 5 g (200 mL) IV over 15 min. May repeat 5 g for severe cases (max total 10 g). Reconstitute each 5 g vial with 200 mL NS."
    },
    notes: "Indication: known/suspected cyanide poisoning (smoke inhalation, nitroprusside toxicity, industrial exposure). Binds CN to form cyanocobalamin (renally excreted). Turns urine, skin, plasma red — interferes with co-oximetry, colorimetric labs (creatinine, AST, bilirubin, Mg) for 24–48 hr. Causes transient hypertension. Compatible only with NS/LR/D5W — do NOT mix in same line as sodium thiosulfate or blood products. Anaphylaxis rare but reported.",
    sources: [
      { label: "FDA Cyanokit (hydroxocobalamin) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=cyanokit" },
      { label: "AHA Smoke Inhalation / Cyanide Guidance", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC, UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 70, doseUnit: "mg", perKg: true,
          min: 70, max: 70, maxAbsolute: 5000,
          notes: "Pediatric cyanide toxicity: 70 mg/kg IV over 15 min (max 5 g). May repeat once for severe toxicity (cumulative max 140 mg/kg or 10 g, whichever lower)."
        },
        notes: "Pediatric: 70 mg/kg IV over 15 min (max 5 g initial dose). Same precautions as adult — chromaturia, lab interference, transient HTN."
      },
      neonatal: {
        bolus: {
          dose: 70, doseUnit: "mg", perKg: true,
          min: 70, max: 70, maxAbsolute: 5000,
          notes: "Neonatal cyanide toxicity: 70 mg/kg IV over 15 min. Limited data — use weight-based pediatric dosing."
        },
        notes: "Neonatal: limited data. Use weight-based pediatric dose (70 mg/kg IV)."
      }
    }
  },
  {
    id: "nac",
    name: "N-Acetylcysteine (Acetadote)",
    category: "Toxicology",
    type: "both",
    bolusConcentrations: [
      { label: "200 mg/mL (20% vial, 30 mL = 6 g)", mg: 200, mL: 1 },
      { label: "Phase 1: 150 mg/kg in 200 mL D5W over 60 min", mg: 200, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "Phase 2: 50 mg/kg in 500 mL D5W (4 mg/mL) over 4 hr", mg: 50, mL: 500 },
      { label: "Phase 3: 100 mg/kg in 1000 mL D5W (4 mg/mL) over 16 hr", mg: 100, mL: 1000 }
    ],
    bolus: {
      dose: 150, doseUnit: "mg", perKg: true,
      min: 150, max: 150, maxAbsolute: 15000,
      notes: "Phase 1 loading dose: 150 mg/kg in 200 mL D5W IV over 60 min (UMHS Tox E-4)."
    },
    infusion: {
      dose: 12.5, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 6.25, max: 12.5,
      notes: "Phase 2 (next 4 hr): 12.5 mg/kg/hr (50 mg/kg in 500 mL D5W over 4 hr). Phase 3 (next 16 hr): 6.25 mg/kg/hr (100 mg/kg in 1000 mL D5W over 16 hr). Continue at 6.25 mg/kg/hr beyond 21 hr if transaminases remain elevated or APAP detectable. Pediatric: reduce diluent volume to avoid hyponatremia."
    },
    notes: "Indication: acetaminophen overdose. 21-hr IV protocol total = 300 mg/kg. Anaphylactoid reactions common during loading — slow infusion, treat with diphenhydramine, do not discontinue. Source of truth: UMHS Survival Flight Tox E-4 Appendix.",
    sources: [
      { label: "FDA Acetadote (NAC) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=acetylcysteine+injection" },
      { label: "Rumack-Matthew nomogram (PCN guidance)", url: "https://www.poison.org/articles/acetaminophen-poisoning" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "activated_charcoal",
    name: "Activated Charcoal",
    category: "Toxicology",
    type: "bolus",
    concentrations: [
      { label: "Slurry (e.g. 25 g / 120 mL) — dose by g", mg: 1000, mL: 1, isUnits: true, unitsLabel: "g" }
    ],
    bolus: {
      dose: 1, doseUnit: "g", perKg: true,
      min: 0.5, max: 1, maxAbsolute: 100,
      notes: "Adult 1 g/kg PO/gastric tube; pediatric 0.5–1 g/kg. Most effective within 1 hr of ingestion. Dabigatran/factor Xa OD: fixed 50 g dose if ingestion <2 h (dabigatran) or <8 h (rivaroxaban/apixaban). Contraindicated: caustics, hydrocarbons, unprotected airway."
    },
    notes: "Route is PO or via gastric tube — listed here as a clinically critical antidote calculator. Avoid in: altered LOC without secured airway, caustic ingestions, hydrocarbons, bowel obstruction. Multi-dose charcoal indicated for enterohepatic-recirculated drugs (theophylline, carbamazepine, phenobarbital, dapsone, quinine).",
    sources: [
      { label: "AAPCC Position Paper: Single-Dose Activated Charcoal", url: "https://www.tandfonline.com/doi/full/10.1080/15563650.2014.928721" },
      UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 0.75, doseUnit: "g", perKg: true,
          min: 0.5, max: 1, maxAbsolute: 50,
          notes: "Pediatric: 0.5–1 g/kg PO/NG (UMHS Tox E-4)."
        }
      }
    }
  },
  {
    id: "calcium_chloride_10",
    name: "Calcium Chloride 10% (bolus)",
    category: "Toxicology",
    secondaryCategories: ["Electrolytes"],
    type: "both",
    bolusConcentrations: [
      { label: "100 mg/mL (10%, 1 g / 10 mL)", mg: 100, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "1 g / 100 mL (10 mg/mL)", mg: 1000, mL: 100 }
    ],
    bolus: {
      dose: 20, doseUnit: "mg", perKg: true,
      min: 20, max: 20, maxAbsolute: 2000,
      notes: "CCB/BB toxicity: 20 mg/kg IV bolus (max 2 g per dose). May repeat. Vesicant — central line strongly preferred."
    },
    infusion: {
      dose: 20, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 20, max: 40,
      notes: "UMHS Tox E-4 CCB/BB: 20–40 mg/kg/hr continuous infusion after bolus. Monitor ionized calcium q1–2 hr."
    },
    code: {
      role: "CCB / β-blocker toxicity, hyperkalemia, hypocalcemia in arrest",
      adult: { dose: 20, unit: "mg", perKg: true, max: 2000, route: "IV/IO slow push (central preferred)", repeat: "May repeat q10 min" },
      pediatric: { dose: 20, unit: "mg", perKg: true, max: 1000, route: "IV/IO slow push", repeat: "May repeat" },
      concHint: "10% CaCl₂ = 100 mg/mL = 1 g / 10 mL. Vesicant — central line preferred."
    },
    notes: "Toxicology indication (UMHS Tox E-4): CCB/BB poisoning bolus 20 mg/kg max 2 g, then 20–40 mg/kg/hr infusion. CaCl₂ provides 3× elemental calcium of equivalent gluconate dose.",
    sources: [
      { label: "FDA Calcium Chloride Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=calcium+chloride+injection" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "high_dose_insulin",
    name: "High-Dose Insulin (HDI, Regular)",
    category: "Toxicology",
    type: "both",
    bolusConcentrations: [
      { label: "Regular insulin 100 units/mL (U-100 vial)", mg: 100, mL: 1, isUnits: true, unitsLabel: "units" }
    ],
    infusionConcentrations: [
      { label: "100 units / 100 mL NS (1 unit/mL)", mg: 100, mL: 100, isUnits: true, unitsLabel: "units" },
      { label: "500 units / 250 mL NS (2 units/mL)", mg: 500, mL: 250, isUnits: true, unitsLabel: "units" }
    ],
    bolus: {
      dose: 1, doseUnit: "units", perKg: true,
      min: 1, max: 1, maxAbsolute: 100,
      notes: "CCB / β-blocker toxicity loading dose: 1 unit/kg IV regular insulin (UMHS Tox E-4). Give D50 25 g concurrently if BGL <250."
    },
    infusion: {
      dose: 1, doseUnit: "units", perKg: true, perTime: "hr",
      min: 0.5, max: 10,
      notes: "HDI infusion: 1 unit/kg/hr regular insulin. Titrate up to 10 unit/kg/hr per clinical response — some refractory cases require very high doses. REQUIRED concurrent D10W or D25W infusion + q15–30 min glucose checks. Replete K+, Mg, phos."
    },
    notes: "Indication: CCB or β-blocker toxicity with shock. Mechanism: insulin overcomes myocardial insulin resistance, improves inotropy. Concurrent dextrose infusion is mandatory (start D10W 100 mL/hr or D25W via central line). Monitor BGL q15–30 min × 1 hr, then q1 hr. Watch for hypokalemia.",
    sources: [
      { label: "AACT/EAPCCT Position: HDI for CCB Tox", url: "https://www.tandfonline.com/doi/full/10.1080/15563650.2018.1485938" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "lipid_emulsion",
    name: "Lipid Emulsion 20% (Intralipid)",
    category: "Toxicology",
    type: "both",
    bolusConcentrations: [
      { label: "20% emulsion (250 mL bag) — dose by mL of 20%", mg: 1, mL: 1, isUnits: true, unitsLabel: "mL of 20%" }
    ],
    infusionConcentrations: [
      { label: "20% emulsion (250 mL bag) — dose by mL of 20%", mg: 1, mL: 1, isUnits: true, unitsLabel: "mL of 20%" }
    ],
    bolus: {
      dose: 1.5, doseUnit: "mL of 20%", perKg: true,
      min: 1.5, max: 1.5, maxAbsolute: 150,
      notes: "Rescue bolus: 1.5 mL/kg of 20% lipid emulsion IV over 2–3 min. Indications: local-anesthetic systemic toxicity (LAST); rescue therapy for CCB, β-blocker, TCA, lipophilic cardiotoxin overdose unresponsive to standard care (UMHS Tox E-4)."
    },
    infusion: {
      dose: 0.25, doseUnit: "mL of 20%", perKg: true, perTime: "min",
      min: 0.25, max: 0.5,
      notes: "Continuous infusion 0.25 mL/kg/min × 60 min after bolus (~15 mL/kg/hr). May increase to 0.5 mL/kg/min if persistent instability. Cumulative max ~10 mL/kg in first 30 min. Consult Poison Control (1-800-222-1222) and ASRA LAST checklist."
    },
    notes: "Use dedicated peripheral IV — incompatible with most drugs. Risk: pancreatitis, ARDS, lab interference (24–48 hr). Source: ASRA 2021 LAST update + UMHS Tox E-4.",
    sources: [
      { label: "ASRA LAST Checklist 2020", url: "https://www.asra.com/guidelines-articles/guidelines/guideline-item/guidelines/2020/11/01/checklist-for-treatment-of-local-anesthetic-systemic-toxicity" },
      { label: "lipidrescue.org", url: "https://www.lipidrescue.org/" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "digifab",
    name: "Digoxin Immune Fab (DigiFab)",
    category: "Toxicology",
    type: "bolus",
    concentrations: [
      { label: "40 mg / vial reconstituted in 4 mL (10 mg/mL) — dose by vial", mg: 1, mL: 1, isUnits: true, unitsLabel: "vials" }
    ],
    bolus: {
      dose: 10, doseUnit: "vials", perKg: false,
      min: 5, max: 20, maxAbsolute: 20,
      notes: "Cardiac arrest / near-arrest from digoxin tox: ADULT 10 vials slow IVP; PEDIATRIC 5 vials slow IVP. All others (chronic tox, known ingested dose, known serum digoxin level): consult Poison Control for vial calculation and administer over 30 min via 0.22-micron filter (UMHS Tox E-4)."
    },
    notes: "Empiric chronic dosing: adult 3–6 vials; peds 1–2 vials. Calculated by ingested mg: vials = (mg ingested × 0.8) / 0.5. Calculated by serum level: vials = (serum dig ng/mL × wt kg) / 100. Each vial binds ~0.5 mg digoxin. Indications: arrhythmia, K+ > 5 in acute tox, end-organ dysfunction. Anaphylaxis risk — ovine product.",
    sources: [
      { label: "FDA DigiFab PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=digoxin+immune+fab" },
      UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 5, doseUnit: "vials", perKg: false,
          min: 1, max: 10, maxAbsolute: 10,
          notes: "Pediatric arrest/near-arrest: 5 vials slow IVP. Otherwise calculate per serum level or ingested dose with Poison Control."
        }
      }
    }
  },
  {
    id: "ethanol_10",
    name: "Ethanol 10% IV",
    category: "Toxicology",
    type: "both",
    bolusConcentrations: [
      { label: "10% ethanol (100 mg/mL) — dose by mL of 10%", mg: 1, mL: 1, isUnits: true, unitsLabel: "mL of 10%" }
    ],
    infusionConcentrations: [
      { label: "10% ethanol (100 mg/mL) — dose by mL of 10%", mg: 1, mL: 1, isUnits: true, unitsLabel: "mL of 10%" }
    ],
    bolus: {
      dose: 10, doseUnit: "mL of 10%", perKg: true,
      min: 10, max: 10, maxAbsolute: 1000,
      notes: "Methanol or ethylene glycol toxicity (alternative to fomepizole): loading dose 10 mL/kg of 10% ethanol IV over 30 min (UMHS Tox E-4)."
    },
    infusion: {
      dose: 1.2, doseUnit: "mL of 10%", perKg: true, perTime: "hr",
      min: 1.2, max: 1.5,
      notes: "Maintenance: 1.2 mL/kg/hr of 10% ethanol (adjust to keep serum ethanol level 100–150 mg/dL). Increase 50–100% during hemodialysis. Monitor BGL q1–2 h (hypoglycemia common, especially peds). Fomepizole strongly preferred when available."
    },
    notes: "Indications: methanol or ethylene glycol poisoning when fomepizole unavailable. Central line preferred for 10% concentration. Monitor for hypoglycemia (especially pediatrics), CNS depression, lactic acidosis. Confirm with serum ethanol levels.",
    sources: [
      { label: "AACT/EAPCCT Position: Methanol Tox", url: "https://www.tandfonline.com/doi/abs/10.1081/CLT-120014645" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "fomepizole",
    name: "Fomepizole (Antizol)",
    category: "Toxicology",
    type: "bolus",
    concentrations: [
      { label: "1 g/mL (1.5 mL vial) — dilute in 100 mL NS/D5W", mg: 1000, mL: 1 },
      { label: "Diluted 100 mg/mL", mg: 100, mL: 1 }
    ],
    bolus: {
      dose: 15, doseUnit: "mg", perKg: true,
      min: 10, max: 15, maxAbsolute: 1500,
      notes: "Methanol / ethylene glycol toxicity. Loading: 15 mg/kg IV over 30 min. Then 10 mg/kg q12h × 4 doses, then 15 mg/kg q12h until level <20 mg/dL and asymptomatic. Increase frequency during hemodialysis (q4h or run as 1–1.5 mg/kg/hr drip)."
    },
    notes: "First-line antidote for toxic alcohol ingestion (preferred over ethanol). Must dilute in ≥100 mL NS or D5W and infuse over ≥30 min — irritating to vein. Monitor electrolytes, anion gap, osmolal gap, serum level if available. Source: UMHS Tox E-4.",
    sources: [
      { label: "FDA Antizol (fomepizole) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=fomepizole" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "pralidoxime",
    name: "Pralidoxime (2-PAM, Protopam)",
    category: "Toxicology",
    type: "both",
    bolusConcentrations: [
      { label: "1 g / 20 mL (50 mg/mL) reconstituted", mg: 50, mL: 1 },
      { label: "1 g / 100 mL NS (10 mg/mL) diluted", mg: 1000, mL: 100 }
    ],
    infusionConcentrations: [
      { label: "1 g / 100 mL NS (10 mg/mL)", mg: 1000, mL: 100 },
      { label: "2 g / 100 mL NS (20 mg/mL)", mg: 2000, mL: 100 }
    ],
    bolus: {
      dose: 30, doseUnit: "mg", perKg: true,
      min: 30, max: 30, maxAbsolute: 2000,
      notes: "Organophosphate / nerve agent poisoning: 30 mg/kg IV over 20 min (max 2 g per dose). Give in addition to atropine — atropine for muscarinic Sx, pralidoxime for nicotinic Sx + AChE reactivation."
    },
    infusion: {
      dose: 8, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 8, max: 10,
      notes: "After loading dose: 8–10 mg/kg/hr continuous IV (max 500 mg/hr). Continue until symptoms resolve and atropine no longer needed. Source: UMHS Tox E-4."
    },
    notes: "Most effective within 24–48 hr of OP exposure (before AChE \"aging\"). Side effects: hypertension during rapid infusion (slow rate), neuromuscular blockade at high doses, transient AST elevation. Renally cleared.",
    sources: [
      { label: "FDA Protopam (pralidoxime) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=pralidoxime" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "pyridoxine",
    name: "Pyridoxine (Vitamin B6)",
    category: "Toxicology",
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL (10% vial, 10 mL = 1 g)", mg: 100, mL: 1 }
    ],
    bolus: {
      dose: 5000, doseUnit: "mg", perKg: false,
      min: 5000, max: 5000, maxAbsolute: 5000,
      notes: "Adult INH (isoniazid) overdose: 5 g IV (1 g per 1 g INH ingested, empiric 5 g if unknown). May repeat q5–10 min until seizures controlled. Also: hydrazine, gyromitra mushroom, ethylene glycol adjunct."
    },
    notes: "Reverses GABA-mediated seizures from INH overdose. Administer as IV push 0.5 g/min, or dilute in 50 mL NS and infuse over 30 min if non-emergent. Source: UMHS Tox E-4.",
    sources: [
      { label: "FDA Pyridoxine HCl PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=pyridoxine" },
      UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 70, doseUnit: "mg", perKg: true,
          min: 70, max: 70, maxAbsolute: 5000,
          notes: "Pediatric INH overdose: 70 mg/kg IV (max 5 g) — UMHS Tox E-4."
        }
      }
    }
  },
  {
    id: "octreotide",
    name: "Octreotide (Sandostatin)",
    category: "Toxicology",
    type: "both",
    bolusConcentrations: [
      { label: "100 mcg/mL (1 mL ampule)", mg: 0.1, mL: 1 },
      { label: "200 mcg/mL (multidose vial)", mg: 0.2, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "500 mcg / 250 mL NS (2 mcg/mL)", mg: 0.5, mL: 250 }
    ],
    bolus: {
      dose: 100, doseUnit: "mcg", perKg: false,
      min: 50, max: 125, maxAbsolute: 125,
      notes: "Sulfonylurea-induced hypoglycemia: 100 mcg SQ q6–12h (1–3 doses) OR 50–125 mcg/hr IV infusion. Adult. Pediatric: 2 mcg/kg SQ per dose (UMHS Tox E-4)."
    },
    infusion: {
      dose: 75, doseUnit: "mcg", perKg: false, perTime: "hr",
      min: 50, max: 125,
      notes: "Continuous IV: 50–125 mcg/hr until refractory hypoglycemia resolves (typically 24 hr after last sulfonylurea dose)."
    },
    notes: "Indication: refractory hypoglycemia from sulfonylurea or meglitinide overdose. Mechanism: suppresses pancreatic insulin release. Always continue dextrose supplementation alongside. Source: UMHS Tox E-4.",
    sources: [
      { label: "FDA Sandostatin (octreotide) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=octreotide" },
      UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 2, doseUnit: "mcg", perKg: true,
          min: 1, max: 2, maxAbsolute: 100,
          notes: "Pediatric sulfonylurea-induced hypoglycemia: 2 mcg/kg SQ per dose (UMHS Tox E-4)."
        }
      }
    }
  },
  {
    id: "glucagon",
    name: "Glucagon",
    category: "Toxicology",
    type: "both",
    bolusConcentrations: [
      { label: "1 mg/mL reconstituted", mg: 1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "5 mg / 50 mL D5W (0.1 mg/mL)", mg: 5, mL: 50 },
      { label: "10 mg / 100 mL D5W (0.1 mg/mL)", mg: 10, mL: 100 }
    ],
    bolus: {
      dose: 5, doseUnit: "mg", perKg: false,
      min: 5, max: 10, maxAbsolute: 10,
      notes: "Adult β-blocker (or CCB) toxicity: 5–10 mg IV push, may repeat. Pretreat with antiemetic — high doses cause vomiting."
    },
    infusion: {
      dose: 5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 1, max: 10,
      notes: "Adult infusion after bolus: 1–10 mg/hr titrated to HR and BP (UMHS Tox E-4). Pediatric: 50 mcg/kg/hr infusion after 50–150 mcg/kg IV bolus."
    },
    notes: "β-receptor–independent inotrope/chronotrope (cAMP via direct Gs activation). Indications: BB toxicity (1st-line), CCB toxicity, refractory anaphylaxis on β-blockers. Side effects: vomiting, hyperglycemia, hypokalemia. Tachyphylaxis common — back up with HDI / lipid / pressors.",
    sources: [
      { label: "FDA Glucagon PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=glucagon" },
      UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 100, doseUnit: "mcg", perKg: true,
          min: 50, max: 150, maxAbsolute: 10000,
          notes: "Pediatric BB/CCB toxicity: 50–150 mcg/kg IV bolus (UMHS Tox E-4)."
        },
        infusion: {
          dose: 50, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 50, max: 150,
          notes: "Pediatric infusion: 50 mcg/kg/hr after bolus."
        }
      }
    }
  },
  {
    id: "phentolamine",
    name: "Phentolamine (Regitine)",
    category: "Toxicology",
    secondaryCategories: ["Antihypertensives"],
    type: "bolus",
    concentrations: [
      { label: "5 mg/mL reconstituted", mg: 5, mL: 1 }
    ],
    bolus: {
      dose: 5, doseUnit: "mg", perKg: false,
      min: 2.5, max: 5, maxAbsolute: 20,
      notes: "Cocaine / amphetamine / pheochromocytoma hypertensive crisis: 5 mg IV q5–15 min PRN. Also: extravasation of α-agonist (norepi, dopamine, phenylephrine) — 5–10 mg in 10 mL NS infiltrated locally within 12 hr."
    },
    notes: "Non-selective α-blocker. Avoid β-blocker monotherapy in cocaine tox (unopposed α-stimulation worsens HTN). Source: UMHS Tox E-4.",
    sources: [
      { label: "FDA Phentolamine Mesylate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=phentolamine" },
      UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 0.05, doseUnit: "mg", perKg: true,
          min: 0.05, max: 0.1, maxAbsolute: 5,
          notes: "Pediatric: 0.05–0.1 mg/kg IV q5 min PRN (max 5 mg/dose)."
        }
      }
    }
  },
  {
    id: "idarucizumab",
    name: "Idarucizumab (Praxbind)",
    category: "Toxicology",
    secondaryCategories: ["Blood Thinners", "Reversal"],
    type: "bolus",
    concentrations: [
      { label: "2.5 g / 50 mL vial (2 vials = 5 g)", mg: 2500, mL: 50 }
    ],
    bolus: {
      dose: 5000, doseUnit: "mg", perKg: false,
      min: 5000, max: 5000, maxAbsolute: 5000,
      notes: "Dabigatran reversal: 5 g IV total (2 × 2.5 g vials) given as two consecutive boluses or rapid infusion within 15 min via a DEDICATED IV line. Do not mix with other drugs. If unavailable: Kcentra 50 units/kg max 5000 (UMHS Tox E-4)."
    },
    notes: "Humanized monoclonal Fab fragment that binds dabigatran with 350× the affinity of thrombin. Effect within minutes; dabigatran levels may rebound at 12–24 hr — repeat 5 g dose if recurrent bleeding/severe coagulopathy. No effect on rivaroxaban/apixaban/heparin. Source: UMHS Tox E-4.",
    sources: [
      { label: "FDA Praxbind (idarucizumab) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=idarucizumab" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "andexanet",
    name: "Andexanet alfa (Andexxa)",
    category: "Toxicology",
    secondaryCategories: ["Blood Thinners", "Reversal"],
    type: "both",
    bolusConcentrations: [
      { label: "Low dose: 400 mg / 250 mL NS", mg: 400, mL: 250 },
      { label: "High dose: 800 mg / 250 mL NS", mg: 800, mL: 250 }
    ],
    infusionConcentrations: [
      { label: "Low-dose follow-on: 480 mg / 250 mL NS", mg: 480, mL: 250 },
      { label: "High-dose follow-on: 960 mg / 250 mL NS", mg: 960, mL: 250 }
    ],
    bolus: {
      dose: 400, doseUnit: "mg", perKg: false,
      min: 400, max: 800, maxAbsolute: 800,
      notes: "Bolus for ICH from rivaroxaban/apixaban. LOW DOSE (last dose >8 h ago OR last dose ≤8 h apixaban ≤5 mg / rivaroxaban ≤10 mg): 400 mg at 30 mg/min × ~15 min. HIGH DOSE (last dose <8 h ago or unknown of higher doses): 800 mg at 30 mg/min × ~30 min. MUST use 0.2-micron inline filter."
    },
    infusion: {
      dose: 240, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 240, max: 480,
      notes: "Follow-on infusion × 2 hr. LOW dose: 480 mg over 2 hr (4 mg/min = 240 mg/hr ≈ 125 mL/hr). HIGH dose: 960 mg over 2 hr (8 mg/min = 480 mg/hr). Must use 0.2-micron inline filter. Source: UMHS Tox E-4."
    },
    notes: "Recombinant modified Factor Xa decoy that binds rivaroxaban/apixaban (off-label: edoxaban, fondaparinux, enoxaparin). Indicated for life-threatening ICH; for life-threatening non-ICH bleeding consider Kcentra 50 units/kg (max 5000) instead. Thrombotic risk — resume anticoagulation when bleeding controlled. Cost: ~$50,000/dose.",
    sources: [
      { label: "FDA Andexxa PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=andexanet" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "protamine",
    name: "Protamine Sulfate",
    category: "Toxicology",
    secondaryCategories: ["Blood Thinners", "Reversal"],
    type: "bolus",
    concentrations: [
      { label: "10 mg/mL (5 mL or 25 mL vial)", mg: 10, mL: 1 }
    ],
    bolus: {
      dose: 50, doseUnit: "mg", perKg: false,
      min: 25, max: 50, maxAbsolute: 50,
      notes: "Heparin drip reversal: 1 mg protamine per 100 units heparin received in last 3 hr (max 50 mg per dose). Heparin SQ: 1 mg per 100 units in last 8 hr. LMWH (enoxaparin) <8 h: 1 mg per 1 mg enoxaparin (max 50 mg); >8 h: half dose. Infuse SLOWLY over ≥10 min — rapid push causes hypotension, bradycardia, pulmonary HTN, anaphylactoid reaction. Higher risk: fish allergy, prior protamine exposure, vasectomy."
    },
    notes: "Calculation example: heparin 1500 u/hr × 3 hr = 4500 units → 45 mg protamine. Source: UMHS Tox E-4. Repeat 25 mg as needed if heparin rebound (aPTT remains elevated at 2–4 hr).",
    sources: [
      { label: "FDA Protamine Sulfate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=protamine+sulfate" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "desmopressin",
    name: "Desmopressin (DDAVP)",
    category: "Toxicology",
    secondaryCategories: ["Blood Thinners", "Reversal"],
    type: "bolus",
    concentrations: [
      { label: "4 mcg/mL (1 mL or 10 mL vial)", mg: 0.004, mL: 1 }
    ],
    bolus: {
      dose: 0.4, doseUnit: "mcg", perKg: true,
      min: 0.3, max: 0.4, maxAbsolute: 40,
      notes: "Antiplatelet-associated bleeding (aspirin, clopidogrel, ticagrelor) or uremic platelet dysfunction: 0.3–0.4 mcg/kg in 100 mL NS IV over 15–30 min (max 40 mcg). Onset 30 min, lasts 4–8 hr. Tachyphylaxis with repeat dosing. Watch for hyponatremia — restrict free water."
    },
    notes: "Releases von Willebrand factor and FVIII from endothelium. Also used for vWD type 1, mild hemophilia A. Source: UMHS Tox E-4. May follow with platelet transfusion (2 units) and TXA 1 g IV if bleeding persists.",
    sources: [
      { label: "FDA DDAVP Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=desmopressin+injection" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "vitamin_k",
    name: "Vitamin K (Phytonadione)",
    category: "Toxicology",
    secondaryCategories: ["Blood Thinners", "Reversal"],
    type: "bolus",
    concentrations: [
      { label: "10 mg/mL ampule", mg: 10, mL: 1 },
      { label: "2 mg/mL (pediatric)", mg: 2, mL: 1 },
      { label: "10 mg / 50 mL NS IVPB", mg: 10, mL: 50 }
    ],
    bolus: {
      dose: 10, doseUnit: "mg", perKg: false,
      min: 5, max: 10, maxAbsolute: 10,
      notes: "Warfarin reversal (life-threatening bleed): 10 mg IVPB in 50 mL NS over 30 min — MUST be given with PCC (Kcentra) or FFP for immediate effect. Vitamin K alone takes 12–24 hr. Rapid IV push → anaphylactoid reaction. Pediatric: 0.5–5 mg IV slow over 30 min."
    },
    notes: "Anticoagulant rodenticide (superwarfarin / brodifacoum) ingestion may require oral vitamin K 50–100 mg/day × weeks–months. Always pair life-threatening warfarin reversal with PCC or FFP — vitamin K alone is too slow.",
    sources: [
      { label: "FDA Vitamin K Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=phytonadione" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "kcentra",
    name: "Kcentra (4-Factor PCC)",
    category: "Toxicology",
    secondaryCategories: ["Blood Thinners", "Reversal"],
    type: "bolus",
    concentrations: [
      { label: "500 units / 20 mL reconstituted (25 units/mL) — dose by units", mg: 25, mL: 1, isUnits: true, unitsLabel: "units" }
    ],
    bolus: {
      dose: 25, doseUnit: "units", perKg: true,
      min: 15, max: 50, maxAbsolute: 5000,
      notes: "Warfarin reversal: INR 1.4–1.9 → 15 units/kg (max 1500); INR 2.0–3.9 → 25 units/kg (max 2500); INR 4.0–6.0 → 35 units/kg (max 3500); INR >6.0 → 50 units/kg (max 5000). Round to nearest whole vial (500 unit vials). Admin rate ≤7.2 mL/kg/hr (≈3 units/kg/min, max 500 mL/hr). Co-administer vitamin K 10 mg IV. Also: 50 units/kg (max 5000) for dabigatran (if Praxbind unavailable) or rivaroxaban/apixaban non-ICH bleed (UMHS Tox E-4)."
    },
    notes: "4-factor PCC contains factors II, VII, IX, X plus proteins C and S. Thrombosis risk — particularly history of HIT (heparin component). Contains heparin — avoid in HIT. Reconstitute and use within 4 hr. FFP 10–20 mL/kg is alternative if PCC unavailable.",
    sources: [
      { label: "FDA Kcentra PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=kcentra" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "aminocaproic",
    name: "Aminocaproic Acid (Amicar)",
    category: "Toxicology",
    secondaryCategories: ["Blood Thinners"],
    type: "bolus",
    concentrations: [
      { label: "250 mg/mL vial", mg: 250, mL: 1 },
      { label: "5 g / 250 mL NS (20 mg/mL)", mg: 5000, mL: 250 }
    ],
    bolus: {
      dose: 5000, doseUnit: "mg", perKg: false,
      min: 4000, max: 5000, maxAbsolute: 5000,
      notes: "Thrombolytic-associated bleeding reversal: 5 g in 250 mL NS IV over 20–60 min (≤1 g/min to avoid hypotension). Alternative to TXA 1 g IV. Then 1 g/hr × 8 hr or until bleeding controlled (UMHS Tox E-4)."
    },
    notes: "Antifibrinolytic — lysine analog that inhibits plasminogen activation. Indications: thrombolytic reversal (tPA, TNK), hyperfibrinolysis, post-cardiac surgery bleeding. Avoid with active intravascular clotting / DIC.",
    sources: [
      { label: "FDA Amicar (aminocaproic acid) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=aminocaproic+acid" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "phenobarbital",
    name: "Phenobarbital",
    category: "Anticonvulsants",
    secondaryCategories: ["Toxicology"],
    type: "bolus",
    concentrations: [
      { label: "65 mg/mL ampule", mg: 65, mL: 1 },
      { label: "130 mg/mL ampule", mg: 130, mL: 1 }
    ],
    bolus: {
      dose: 15, doseUnit: "mg", perKg: true,
      min: 10, max: 20, maxAbsolute: 1500,
      notes: "Status epilepticus / TCA-induced seizures: 10–20 mg/kg IV load at ≤60 mg/min (≤2 mg/kg/min in peds <60 kg). Onset 5–15 min, half-life 80–120 hr. May repeat 5 mg/kg q15–30 min to total 30 mg/kg (UMHS Tox E-4). Adjunct for refractory TCA, sympathomimetic, withdrawal seizures."
    },
    notes: "Long-acting barbiturate — expect respiratory depression and hypotension at high loading doses. Have airway equipment ready. Cytochrome P450 inducer — affects warfarin, phenytoin, OCPs.",
    sources: [
      { label: "FDA Phenobarbital Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=phenobarbital+injection" },
      UMHS_TOX_SRC
    ]
  },
  {
    id: "ascorbic_acid",
    name: "Ascorbic Acid (Vitamin C)",
    category: "Toxicology",
    type: "bolus",
    concentrations: [
      { label: "500 mg/mL (50 mL vial)", mg: 500, mL: 1 },
      { label: "1 g / 100 mL NS (10 mg/mL)", mg: 1000, mL: 100 }
    ],
    bolus: {
      dose: 2000, doseUnit: "mg", perKg: false,
      min: 2000, max: 10000, maxAbsolute: 10000,
      notes: "Methemoglobinemia (esp. G6PD-deficient patients or those on serotonergic meds, where methylene blue is contraindicated/risky): 2–10 g IV over 15–30 min. May repeat. Adjunct or alternative to methylene blue."
    },
    notes: "First-line alternative to methylene blue when G6PD deficient or concurrent serotonergic drugs. Slower onset than MB. Source: UMHS Tox E-4. Large IV doses → osmotic diuresis, possible calcium oxalate stones in CKD; monitor renal function.",
    sources: [
      { label: "FDA Ascorbic Acid Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=ascorbic+acid+injection" },
      UMHS_TOX_SRC
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 30, doseUnit: "mg", perKg: true,
          min: 30, max: 50, maxAbsolute: 2000,
          notes: "Pediatric/neonatal methemoglobinemia: 100–500 mg IV initially (small infants), 30–50 mg/kg IV in older children. Preferred over methylene blue in neonates and G6PD deficient patients."
        }
      }
    }
  },
  // ---------------- MCHC CARDIAC-SPECIFIC ----------------
  {
    id: "aminophylline",
    name: "Aminophylline",
    category: "Respiratory",
    type: "both",
    bolusConcentrations: [
      { label: "25 mg/mL", mg: 25, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "500 mg / 250 mL D5W (2 mg/mL)", mg: 500, mL: 250 },
      { label: "500 mg / 250 mL (2 mg/mL)", mg: 500, mL: 250 },
      { label: "250 mg / 250 mL (1 mg/mL)", mg: 250, mL: 250 },
    ],
    bolus: {
      dose: 6, doseUnit: "mg", perKg: true,
      min: 5, max: 8,
      notes: "Loading: 5–8 mg/kg IV over 30 min (MCHC)."
    },
    infusion: {
      dose: 1, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 0.5, max: 1.5,
      notes: "MCHC: 0.5–1.5 mg/kg/hr (hard max 1.5). IV form of theophylline."
    },
    notes: "Follow theophylline levels 1 hr post-load, then q12–24 hr. Therapeutic 10–15 mcg/mL; toxicity >20 mcg/mL.",
    sources: [
      { label: "FDA Aminophylline PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=aminophylline" },
      UMHS_MCHC_SRC
    ]
  },
  {
    id: "argatroban",
    name: "Argatroban",
    category: "Blood Thinners",
    type: "infusion",
    concentrations: [
      { label: "100 mg / 250 mL (0.4 mg/mL)", mg: 100, mL: 250 },
      { label: "50 mg / 50 mL (1 mg/mL — premixed)", mg: 50, mL: 50 }
    ],
    infusion: {
      dose: 1, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.1, max: 10,
      notes: "MCHC: 0.1–3 mcg/kg/min (hard max 10). ECMO 0.5–5 mcg/kg/min. Direct thrombin inhibitor — for HIT or HIT-suspected anticoagulation."
    },
    notes: "Loading dose only used in cath lab or to prime ECMO circuit. Monitor aPTT or anti-IIa levels. Hepatic clearance — reduce dose in liver dysfunction.",
    sources: [
      { label: "FDA Argatroban PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=argatroban" },
      UMHS_MCHC_SRC
    ]
  },
  {
    id: "bivalirudin",
    name: "Bivalirudin (Angiomax)",
    category: "Blood Thinners",
    type: "infusion",
    concentrations: [
      { label: "250 mg / 50 mL (5 mg/mL)", mg: 250, mL: 50 },
      { label: "500 mg / 500 mL (1 mg/mL)", mg: 500, mL: 500 }
    ],
    infusion: {
      dose: 0.5, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 0.1, max: 5,
      notes: "MCHC peds: 0.1–3 mg/kg/hr (hard max 5). Adult ≥50kg: 1.75 mg/kg/hr (hard max 2). Loading 0.15–0.3 mg/kg not routinely used. Direct thrombin inhibitor — agent of choice for VAD patients."
    },
    notes: "Follow aPTTs. Renally eliminated — dose-reduce in CrCl <30. Used for HIT, VAD, ECMO anticoagulation.",
    sources: [
      { label: "FDA Angiomax (bivalirudin) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=bivalirudin" },
      UMHS_MCHC_SRC
    ]
  },
  {
    id: "sotalol",
    name: "Sotalol",
    category: "Antiarrhythmics",
    type: "both",
    bolusConcentrations: [
      { label: "15 mg/mL (premixed vial)", mg: 15, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "75 mg / 250 mL D5W (0.3 mg/mL)", mg: 75, mL: 250 },
      { label: "75 mg / 100 mL (0.75 mg/mL)", mg: 75, mL: 100 },
    ],
    bolus: {
      dose: 1, doseUnit: "mg", perKg: true,
      min: 1, max: 1, maxAbsolute: 75,
      notes: "MCHC: load 1 mg/kg IV over 1 hr followed by continuous infusion."
    },
    infusion: {
      dose: 4.5, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 4.5, max: 12,
      notes: "MCHC: 4.5 mg/kg/DAY (hard max 12 mg/kg/DAY). Note dosing is per DAY, not hour — divide accordingly."
    },
    notes: "Class III antiarrhythmic with non-selective beta-blockade. QT-prolonging — telemetry/ECG required. Compatible with D5W or NS but MUST run in a dedicated line. Renally eliminated — adjust for CrCl.",
    sources: [
      { label: "FDA Betapace IV (sotalol) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=sotalol+injection" },
      UMHS_MCHC_SRC
    ]
  },
  {
    id: "terbutaline",
    name: "Terbutaline",
    category: "Respiratory",
    type: "both",
    bolusConcentrations: [
      { label: "1 mg/mL", mg: 1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "5 mg / 250 mL (20 mcg/mL)", mg: 5, mL: 250 },
      { label: "1 mg/mL (vial)", mg: 1, mL: 1 },
    ],
    bolus: {
      dose: 5, doseUnit: "mcg", perKg: true,
      min: 2, max: 10,
      notes: "MCHC: load 2–10 mcg/kg IV over 5 min."
    },
    infusion: {
      dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.08, max: 4,
      notes: "MCHC: 0.08–4 mcg/kg/min (hard max 4). Beta-2 agonist — refractory bronchospasm/status asthmaticus."
    },
    notes: "Continuous cardiac monitoring required — risk of tachyarrhythmias, hypokalemia, lactic acidosis. Monitor K+, glucose, lactate.",
    sources: [
      { label: "FDA Terbutaline Sulfate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=terbutaline+sulfate+injection" },
      UMHS_MCHC_SRC
    ]
  },
  {
    id: "treprostinil",
    name: "Treprostinil (Remodulin)",
    category: "Respiratory",
    type: "infusion",
    concentrations: [
      { label: "1 mg/mL (1.0 mg/mL vial)", mg: 1, mL: 1 },
      { label: "2.5 mg/mL", mg: 2.5, mL: 1 },
      { label: "5 mg/mL", mg: 5, mL: 1 },
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    infusion: {
      dose: 1.25, doseUnit: "ng", perKg: true, perTime: "min",
      min: 0.625, max: 40,
      notes: "MCHC: 0.625–40 ng/kg/min. Start 0.625–1.25 ng/kg/min; increase 1.25–2.5 ng/kg/min based on response. 1 ng = 0.001 mcg."
    },
    notes: "Prostacyclin analog for pulmonary arterial hypertension. Syringe/cassette + tubing q48h. MUST be 0.22-micron filtered. Dedicated line. Stable 48 hr after dilution. AVOID abrupt withdrawal — can precipitate PH crisis.",
    sources: [
      { label: "FDA Remodulin (treprostinil) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=treprostinil" },
      UMHS_MCHC_SRC
    ]
  },
];

const DEFAULT_CATEGORIES = [
  "Pressors",
  "Sedation",
  "Analgesics",
  "Paralytics",
  "Antiarrhythmics",
  "Antihypertensives",
  "Anticonvulsants",
  "Respiratory",
  "Reversal",
  "Toxicology",
  "Electrolytes",
  "Blood Thinners",
  "IVF Bolus",
  "Maintenance",
  "Other",
  "Custom"
];
