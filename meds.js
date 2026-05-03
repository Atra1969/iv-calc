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

const DEFAULT_MEDS = [
  // ---------------- PRESSORS ----------------
  {
    id: "epinephrine",
    name: "Epinephrine",
    category: "Pressors",
    type: "both",
    bolusConcentrations: [
      { label: "10 mcg/mL (1 mg in 100 mL)", mg: 0.01, mL: 1 },
      { label: "100 mcg/mL (cardiac arrest 1:10,000)", mg: 0.1, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "8 mg / 250 mL (32 mcg/mL)", mg: 8, mL: 250 },
      { label: "4 mg / 250 mL (16 mcg/mL)", mg: 4, mL: 250 }
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
    bolusCtaLabel: "Push-dose pressor",
    notes: "Cardiac arrest dose: 1 mg (0.01 mg/kg peds) IV/IO q3–5 min.",
    sources: [
      { label: "AHA ACLS 2020 Guidelines", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      { label: "FDA Epinephrine PI (DailyMed)", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=epinephrine+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
      }
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
      min: 0.01, max: 1,
      notes: "Adult (UMHS): 0.01–1 mcg/kg/min. First-line for septic shock."
    },
    sources: [
      { label: "Surviving Sepsis Campaign 2021", url: "https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-guidelines-2021" },
      { label: "FDA Norepinephrine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=norepinephrine+bitartrate" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.05, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.01, max: 2,
          notes: "UMHS PICU: 0.01–2 mcg/kg/min."
        }
      }
    }
  },
  {
    id: "phenylephrine",
    name: "Phenylephrine",
    category: "Pressors",
    type: "both",
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
    bolusCtaLabel: "Push-dose pressor",
    sources: [
      { label: "FDA Phenylephrine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=phenylephrine+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    concentrations: [
      { label: "20 units / 100 mL (0.2 u/mL)", mg: 20, mL: 100, isUnits: true, unitsLabel: "units" },
      { label: "40 units / 100 mL (0.4 u/mL)", mg: 40, mL: 100, isUnits: true, unitsLabel: "units" }
    ],
    infusion: {
      dose: 0.04, doseUnit: "units", perKg: false, perTime: "min",
      min: 0.01, max: 0.08,
      notes: "Adult (UMHS): 0.01–0.03 u/min (sepsis max 0.06; cardiac max 0.08)."
    },
    sources: [
      { label: "Surviving Sepsis Campaign 2021", url: "https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-guidelines-2021" },
      { label: "FDA Vasostrict (vasopressin) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=vasopressin" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
      }
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
      notes: "Adult (UMHS): 2–20 mcg/kg/min. β at 5–10, α at >10."
    },
    sources: [
      { label: "FDA Dopamine HCl PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=dopamine+hydrochloride" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 2.5, max: 25,
          notes: "UMHS PICU: 2.5–20 mcg/kg/min, hard max 25."
        }
      }
    }
  },
  {
    id: "dobutamine",
    name: "Dobutamine",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "500 mg / 250 mL (2000 mcg/mL)", mg: 500, mL: 250 },
      { label: "1000 mg / 250 mL (4000 mcg/mL)", mg: 1000, mL: 250 }
    ],
    infusion: {
      dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 1, max: 20,
      notes: "Adult (UMHS): 1–20 mcg/kg/min (CVICU max 10). Inotrope."
    },
    sources: [
      { label: "FDA Dobutamine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=dobutamine" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 2.5, max: 25,
          notes: "UMHS PICU: 2.5–20 mcg/kg/min, hard max 25."
        }
      }
    }
  },
  {
    id: "milrinone",
    name: "Milrinone",
    category: "Pressors",
    type: "infusion",
    concentrations: [
      { label: "20 mg / 100 mL (0.2 mg/mL = 200 mcg/mL)", mg: 20, mL: 100 }
    ],
    infusion: {
      dose: 0.25, doseUnit: "mcg", perKg: true, perTime: "min",
      min: 0.125, max: 0.75,
      notes: "Adult (UMHS): 0.125–0.25 mcg/kg/min, max 0.75. Inodilator. Renal dose adjust."
    },
    sources: [
      { label: "FDA Primacor (milrinone) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=milrinone" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.3, max: 1,
          notes: "UMHS PICU: 0.3–0.75 mcg/kg/min, hard max 1."
        }
      }
    }
  },
  {
    id: "epoprostenol",
    name: "Epoprostenol (Veletri/Flolan)",
    category: "Pressors",
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
    sources: [
      { label: "FDA Veletri PI (DailyMed)", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=epoprostenol" },
      { label: "UToledo Epoprostenol Administration Guideline", url: "https://www.utoledo.edu/policies/utmc/nursing/guidelines/general/pdfs/Guideline%20General%20-%20Epoprostenol%20Veletri-Flolan%20Administration.pdf" },
      { label: "CHEST Pulmonary Hypertension Guideline 2014", url: "https://journal.chestnet.org/article/S0012-3692(14)60475-7/fulltext" },
      UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 2, doseUnit: "ng", perKg: true, perTime: "min",
          min: 2, max: 125,
          notes: "UMHS PICU: start 2–3 ng/kg/min, titrate. Hard max 125 ng/kg/min."
        }
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
    sources: [
      { label: "FDA Prostin VR (alprostadil) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=alprostadil+injection" },
      { label: "ANMF Alprostadil Monograph 2024", url: "https://www.anmfonline.org/wp-content/uploads/2024/10/Alprostadil_ANMFv2.0_20241017-1.pdf" },
      { label: "AHA Pediatric Pulmonary Hypertension 2015", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000329" },
      UMHS_PEDS_SRC
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
    sources: [
      { label: "FDA Isuprel (isoproterenol) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=isoproterenol" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
      { label: "100 mg/mL", mg: 100, mL: 1 },
      { label: "50 mg/mL", mg: 50, mL: 1 },
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "500 mg / 250 mL (2 mg/mL)", mg: 500, mL: 250 }
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
    sources: [
      { label: "FDA Ketamine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=ketamine+hydrochloride" },
      { label: "Brown EM Lit – RSI Drugs", url: "https://www.aliem.com/rapid-sequence-intubation-medications/" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    },
    sources: [
      { label: "FDA Etomidate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=etomidate" }
    ]
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
    sources: [
      { label: "FDA Propofol PI (Diprivan)", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=propofol" },
      { label: "PADIS Guidelines (SCCM 2018)", url: "https://www.sccm.org/Clinical-Resources/Guidelines/Guidelines/Guidelines-for-the-Prevention-and-Management-of-Pa" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    sources: [
      { label: "FDA Midazolam PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=midazolam" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 50, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 10, max: 300,
          notes: "UMHS PICU: 10–150 mcg/kg/hr, hard max 300."
        }
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
    sources: [
      { label: "FDA Precedex PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=dexmedetomidine" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.5, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 0.1, max: 3,
          notes: "UMHS PICU: 0.1–2 mcg/kg/hr, hard max 3."
        }
      }
    }
  },
  {
    id: "lorazepam_gtt",
    name: "Lorazepam infusion",
    category: "Sedation",
    type: "infusion",
    concentrations: [
      { label: "60 mg / 30 mL (2 mg/mL)", mg: 60, mL: 30 }
    ],
    infusion: {
      dose: 2, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 1, max: 20,
      notes: "Adult (UMHS): 1–10 mg/hr, hard max 20. Propylene glycol toxicity at high cumulative doses."
    },
    sources: [
      { label: "FDA Ativan PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=lorazepam+injection" },
      UMHS_ADULT_SRC
    ]
  },
  {
    id: "haloperidol_gtt",
    name: "Haloperidol infusion",
    category: "Sedation",
    type: "infusion",
    concentrations: [
      { label: "1 mg/mL", mg: 1, mL: 1 }
    ],
    infusion: {
      dose: 5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 4, max: 10,
      notes: "Adult (UMHS): 4–10 mg/hr, hard max 10. ICU agitation/delirium. Monitor QTc."
    },
    sources: [
      { label: "FDA Haldol PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=haloperidol" },
      UMHS_ADULT_SRC
    ]
  },
  {
    id: "pentobarbital",
    name: "Pentobarbital",
    category: "Sedation",
    type: "infusion",
    concentrations: [
      { label: "50 mg/mL (vial)", mg: 50, mL: 1 }
    ],
    infusion: {
      dose: 1, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 0.25, max: 15,
      notes: "UMHS PICU: 0.25–7.5 mg/kg/hr, hard max 15. Refractory status epilepticus / ICP."
    },
    sources: [
      { label: "FDA Nembutal (pentobarbital) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=pentobarbital" },
      UMHS_PEDS_SRC
    ]
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
      { label: "2500 mcg / 250 mL (10 mcg/mL)", mg: 2.5, mL: 250 },
      { label: "1500 mcg / 30 mL (50 mcg/mL)", mg: 1.5, mL: 30 }
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
    sources: [
      { label: "FDA Fentanyl Citrate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=fentanyl+citrate+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 1, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 0.5, max: 10,
          notes: "UMHS PICU <50 kg: 0.5–3 mcg/kg/hr, hard max 10."
        }
      }
    }
  },
  {
    id: "morphine",
    name: "Morphine",
    category: "Analgesics",
    type: "both",
    bolusConcentrations: [
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
    sources: [
      { label: "FDA Morphine Sulfate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=morphine+sulfate+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 30, doseUnit: "mcg", perKg: true, perTime: "hr",
          min: 10, max: 300,
          notes: "UMHS PICU <50 kg: 10–150 mcg/kg/hr, hard max 300."
        }
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
    sources: [
      { label: "FDA Dilaudid PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=hydromorphone" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    sources: [
      { label: "FDA Zemuron (rocuronium) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=rocuronium" },
      UMHS_PEDS_SRC
    ]
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
    },
    sources: [
      { label: "FDA Anectine (succinylcholine) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=succinylcholine" }
    ]
  },
  {
    id: "vecuronium",
    name: "Vecuronium",
    category: "Paralytics",
    type: "both",
    bolusConcentrations: [
      { label: "1 mg/mL (reconstituted)", mg: 1, mL: 1 }
    ],
    infusionConcentrations: [
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
    sources: [
      { label: "FDA Vecuronium PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=vecuronium" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    sources: [
      { label: "FDA Nimbex PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=cisatracurium" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 3, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 1, max: 13,
          notes: "UMHS PICU: 1–10 mcg/kg/min, hard max 13."
        }
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
    sources: [
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      { label: "FDA Amiodarone PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=amiodarone+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    category: "Antiarrhythmics",
    type: "bolus",
    concentrations: [
      { label: "3 mg/mL", mg: 3, mL: 1 }
    ],
    bolus: {
      dose: 6, doseUnit: "mg", perKg: false,
      min: 6, max: 12, maxAbsolute: 12,
      notes: "6 mg rapid IV push, then 12 mg if needed. Follow with 20 mL flush."
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
    sources: [
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" },
      { label: "FDA Lidocaine PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=lidocaine+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 30, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 20, max: 80,
          notes: "UMHS PICU <50 kg: 20–50 mcg/kg/min, hard max 80."
        }
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
    sources: [
      { label: "FDA Cardizem (diltiazem) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=diltiazem+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    sources: [
      { label: "FDA Procainamide PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=procainamide" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    category: "Antiarrhythmics",
    type: "bolus",
    concentrations: [
      { label: "0.1 mg/mL", mg: 0.1, mL: 1 }
    ],
    bolus: {
      dose: 1, doseUnit: "mg", perKg: false,
      min: 0.5, max: 1, maxAbsolute: 3,
      notes: "Bradycardia 0.5–1 mg q3–5 min, max 3 mg. Organophosphate: 2–6 mg, double q5min."
    },
    sources: [
      { label: "AHA ACLS 2020", url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000916" }
    ],
    populations: {
      pediatric: {
        bolus: {
          dose: 0.02, doseUnit: "mg", perKg: true,
          min: 0.02, max: 0.04, maxAbsolute: 1,
          notes: "Pediatric: 0.02 mg/kg IV (min 0.1 mg, max 1 mg/dose)."
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
    sources: [
      { label: "FDA Brevibloc (esmolol) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=esmolol" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    sources: [
      { label: "FDA Cardene IV (nicardipine) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=nicardipine" },
      { label: "Neurocritical Care Society BP Guidelines", url: "https://www.neurocriticalcare.org/Portals/0/NCS%20Guidelines%20Documents/NCS%20Hypertension%20in%20ICH%20Guidelines.pdf" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 1, doseUnit: "mcg", perKg: true, perTime: "min",
          min: 0.5, max: 5,
          notes: "UMHS PICU <50 kg: 0.5–5 mcg/kg/min."
        }
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
    sources: [
      { label: "FDA Labetalol PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=labetalol" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
      }
    }
  },
  {
    id: "hydralazine",
    name: "Hydralazine",
    category: "Antihypertensives",
    type: "bolus",
    concentrations: [
      { label: "20 mg/mL", mg: 20, mL: 1 }
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
    sources: [
      { label: "FDA Nitroglycerin Injection PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=nitroglycerin+injection" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    sources: [
      { label: "FDA Nitropress (nitroprusside) PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=nitroprusside" },
      { label: "AHA Hypertensive Crisis Statement 2017", url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000066" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    },
    sources: [
      { label: "Neurocritical Care Society Status Epilepticus 2012", url: "https://link.springer.com/article/10.1007/s12028-012-9695-z" },
      { label: "FDA Ativan PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=lorazepam+injection" }
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
    type: "both",
    bolusConcentrations: [
      { label: "10 mg/mL", mg: 10, mL: 1 }
    ],
    infusionConcentrations: [
      { label: "500 mg / 50 mL (10 mg/mL)", mg: 500, mL: 50 },
      { label: "100 mg / 100 mL (1 mg/mL)", mg: 100, mL: 100 }
    ],
    bolus: {
      dose: 40, doseUnit: "mg", perKg: false,
      min: 20, max: 200, maxAbsolute: 200,
      notes: "Bolus 20–40 mg IV; up to 200 mg in renal failure."
    },
    infusion: {
      dose: 5, doseUnit: "mg", perKg: false, perTime: "hr",
      min: 5, max: 200,
      notes: "Adult (UMHS): 5–10 mg/hr, hard max 200 mg/hr."
    },
    sources: [
      { label: "FDA Furosemide PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=furosemide+injection" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 0.1, doseUnit: "mg", perKg: true, perTime: "hr",
          min: 0.05, max: 1,
          notes: "UMHS PICU <50 kg: 0.05–1 mg/kg/hr."
        }
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
    sources: [
      { label: "FDA Naloxone PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=naloxone" },
      UMHS_ADULT_SRC, UMHS_PEDS_SRC
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
    type: "bolus",
    concentrations: [
      { label: "100 mg/mL (10%)", mg: 100, mL: 1 }
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
    type: "bolus",
    concentrations: [
      { label: "1 mEq/mL (8.4%)", mg: 1, mL: 1, isUnits: true, unitsLabel: "mEq" }
    ],
    bolus: {
      dose: 1, doseUnit: "mEq", perKg: true,
      min: 0.5, max: 2, maxAbsolute: 100,
      notes: "TCA tox / severe acidosis 1–2 mEq/kg IV."
    },
    sources: [
      { label: "FDA Sodium Bicarbonate PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=sodium+bicarbonate+injection" }
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
      notes: "Metabolic acidosis: mL of 0.3 M = weight (kg) × base deficit (mEq/L) × 1.1. Cardiac arrest closed-chest: 111–333 mL (3.6–10.8 g) of 0.3 M IV. Adult max single dose 500 mL; severe cases up to 1000 mL. Avoid in anuria/uremia, infants <1 mo. Extravasation causes tissue necrosis — central line preferred."
    },
    sources: [
      { label: "FDA THAM (tromethamine) PI — Pfizer", url: "https://labeling.pfizer.com/ShowLabeling.aspx?id=4642" },
      { label: "Medscape THAM Dosing Reference", url: "https://reference.medscape.com/drug/tham-tromethamine-342884" },
      { label: "WikEM Tromethamine", url: "https://www.wikem.org/wiki/Tromethamine" }
    ]
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
      { label: "10 mEq / 100 mL", mg: 10, mL: 100, isUnits: true, unitsLabel: "mEq" }
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
      { label: "0.5 g/mL (D50)", mg: 500, mL: 1 }
    ],
    bolus: {
      dose: 25000, doseUnit: "mg", perKg: false,
      min: 12500, max: 25000, maxAbsolute: 25000,
      notes: "Hypoglycemia: 25 g IV (50 mL of D50)."
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
    type: "infusion",
    concentrations: [
      { label: "1 g / 100 mL (10 mg/mL)", mg: 1000, mL: 100 }
    ],
    infusion: {
      dose: 10, doseUnit: "mg", perKg: true, perTime: "hr",
      min: 2.5, max: 30,
      notes: "UMHS PICU: 2.5–20 mg/kg/hr, hard max 30."
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
    category: "Other",
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
    sources: [
      { label: "FDA Heparin Sodium PI", url: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=heparin+sodium+injection" },
      UMHS_PEDS_SRC
    ],
    populations: {
      pediatric: {
        infusion: {
          dose: 15, doseUnit: "units", perKg: true, perTime: "hr",
          min: 10, max: 75,
          notes: "UMHS PICU: 10–20 units/kg/hr, hard max 75 (ECMO 100). Adjust per anti-Xa."
        }
      }
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
      { label: "2 mg/mL", mg: 2, mL: 1 }
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
  }
];

const DEFAULT_CATEGORIES = [
  "Pressors",
  "Sedation",
  "Analgesics",
  "Paralytics",
  "Antiarrhythmics",
  "Antihypertensives",
  "Anticonvulsants",
  "Reversal",
  "Electrolytes",
  "Other"
];
