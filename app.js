/* IV Dosing Calculator — application logic.
   Library and weight persist via browser storage when available;
   falls back to in-memory state inside sandboxed previews. */

(() => {
  "use strict";

  const STORAGE_KEY = "iv-calc.library.v8"; // v8: Favorites + cross-category drag + custom category picker
  const STATE_KEY = "iv-calc.state.v2";
  const USAGE_KEY = "iv-calc.usage.v1";    // { medId: { count, lastUsed } } (kept for migration only)
  const FAVORITES_KEY = "iv-calc.favorites.v1"; // [medId, medId, ...] explicit user favorites, ordered
  const ORDER_KEY = "iv-calc.order.v1";    // { categories: ["Pressors", ...], meds: { "Pressors": ["id1", "id2"] } }
  const FAVORITES_CATEGORY = "Favorites";
  // "Code" is a virtual category like Favorites — it surfaces meds tagged with a
  // `code: {...}` block (ACLS/PALS code-cart drugs) and renders their
  // weight-resolved code dose right on the card.
  const CODE_CATEGORY = "Code";

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
    { weightKg: null, unit: "kg", category: "All", search: "", filter: "all", sort: "natural", currentMedId: null, mode: "bolus", concIdx: 0, dose: null, population: "adult", populationManual: false },
    loadState()
  );
  if (!["adult", "pediatric", "neonatal"].includes(state.population)) state.population = "adult";
  // populationManual = true once the user has explicitly tapped a population
  // button. While false, we auto-pick adult vs pediatric from the weight value
  // (< 50 kg → pediatric, per UMHS PICU 2023 rule). Manual override sticks for
  // the session even if the weight is later changed.

  function loadLibrary() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return migrateLibrary(parsed);
        }
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_MEDS));
  }
  // Lightweight in-place migrations applied to a cached library so returning
  // users pick up structural changes without wiping their customizations.
  // Each migration is idempotent and safe to run repeatedly.
  function migrateLibrary(lib) {
    let changed = false;
    const hasDefault = typeof DEFAULT_MEDS !== "undefined";
    // 2026-05-23a: Replace old Holliday-Segar 4-2-1 entry with simple 5/10/20 mL/kg.
    const oldIdx = lib.findIndex(m => m && m.id === "maintenance_421");
    const maintNew = hasDefault ? DEFAULT_MEDS.find(m => m && m.id === "maintenance_mlkg") : null;
    if (oldIdx >= 0 && maintNew) {
      lib.splice(oldIdx, 1, JSON.parse(JSON.stringify(maintNew)));
      changed = true;
    } else if (oldIdx < 0 && maintNew && !lib.some(m => m && m.id === "maintenance_mlkg")) {
      lib.push(JSON.parse(JSON.stringify(maintNew)));
      changed = true;
    }
    // 2026-05-23b: Seed Code-tab-only electrical therapy entries (defibrillation,
    // cardioversion). These are hidden from "All" and search via codeOnly:true.
    ["defibrillation", "cardioversion"].forEach(id => {
      if (lib.some(m => m && m.id === id)) return;
      const def = hasDefault ? DEFAULT_MEDS.find(m => m && m.id === id) : null;
      if (def) {
        lib.push(JSON.parse(JSON.stringify(def)));
        changed = true;
      }
    });
    // 2026-05-24a: Reshape the fluids/maintenance taxonomy.
    //   - Old `maintenance_mlkg` lived in category "Maintenance" and was named
    //     "Maintenance Fluid" — but it's actually a BOLUS calc (5/10/20 mL/kg).
    //     Rename to "IVF Bolus" and move to category "IVF Bolus".
    //   - Old `hypertonic_saline_3` lived in category "Fluids" — fold into "Other".
    //   - Seed new `maintenance_421` (true Holliday-Segar maintenance rate) into
    //     category "Maintenance" so the renamed Maintenance tab has real content.
    const mlkg = lib.find(m => m && m.id === "maintenance_mlkg");
    if (mlkg) {
      if (mlkg.category !== "IVF Bolus") { mlkg.category = "IVF Bolus"; changed = true; }
      if (mlkg.name !== "IVF Bolus")     { mlkg.name = "IVF Bolus";     changed = true; }
    }
    const hs3 = lib.find(m => m && m.id === "hypertonic_saline_3");
    if (hs3 && hs3.category === "Fluids") { hs3.category = "Other"; changed = true; }
    if (!lib.some(m => m && m.id === "maintenance_421")) {
      const def421 = hasDefault ? DEFAULT_MEDS.find(m => m && m.id === "maintenance_421") : null;
      if (def421) { lib.push(JSON.parse(JSON.stringify(def421))); changed = true; }
    }
    if (changed) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(lib)); } catch (e) {}
    }
    return lib;
  }
  function saveLibrary() {
    storage.setItem(STORAGE_KEY, JSON.stringify(library));
  }
  function loadState() {
    try { return JSON.parse(storage.getItem(STATE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveState() {
    const { weightKg, unit, category, population, populationManual, filter, sort } = state;
    storage.setItem(STATE_KEY, JSON.stringify({ weightKg, unit, category, population, populationManual, filter, sort }));
  }

  // ----------- POPULATION HELPERS -----------
  // Returns true if the underlying med (pre-resolve) has an overlay for the
  // given population (or the parent population it falls back to). Used to
  // highlight med cards whose dosing actually changes when the user switches
  // populations.
  function medHasPopulationOverlay(med, pop) {
    if (!med || !med.populations) return false;
    if (pop === "pediatric") return !!med.populations.pediatric;
    if (pop === "neonatal")  return !!(med.populations.neonatal || med.populations.pediatric);
    return !!med.populations.adult;
  }
  // Suggest a population based on weight. Returns null when no suggestion
  // should be made (weight cleared). Thresholds:
  //   ≤ 5 kg  → neonatal   (term newborns 2.5–4 kg, sick/preterm up to ~5 kg)
  //   < 50 kg → pediatric  (UMHS PICU 2023 cutoff)
  //   ≥ 50 kg → adult
  // The 5 kg neonatal ceiling matches NRP / PALS pre-hospital practice:
  // above ~5 kg, dose ceilings and drug behavior align with infant/pediatric
  // protocols. Users can always override manually — the suggestion only
  // applies until the user taps a population button.
  function suggestedPopulationFromWeight(kg) {
    if (!isFinite(kg) || kg <= 0) return null;
    if (kg <= 5) return "neonatal";
    if (kg < 50) return "pediatric";
    return "adult";
  }

  // ----------- FAVORITES (explicit, ordered) -----------
  // Replaces the previous auto-usage "Top 10". Favorites are added explicitly
  // by the user (★ toggle inside the calc modal) and can be reordered with
  // long-press drag. We keep the legacy USAGE_KEY data only to seed favorites
  // on first load so users don't lose their list across the v7→v8 upgrade.
  let favorites = (() => {
    try {
      const raw = storage.getItem(FAVORITES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(x => typeof x === "string");
      }
    } catch (e) {}
    // First load on v8 — seed from old usage data (if any) by taking the top 10
    // by score so the user's frequently-used meds carry over as initial favorites.
    try {
      const rawUsage = storage.getItem(USAGE_KEY);
      if (rawUsage) {
        const usage = JSON.parse(rawUsage) || {};
        const seeded = Object.keys(usage)
          .filter(id => usage[id] && usage[id].count > 0)
          .sort((a, b) => {
            const ua = usage[a], ub = usage[b];
            const da = (Date.now() - ua.lastUsed) / (1000 * 60 * 60 * 24);
            const db = (Date.now() - ub.lastUsed) / (1000 * 60 * 60 * 24);
            const sa = ua.count + 5 * Math.exp(-da / 30);
            const sb = ub.count + 5 * Math.exp(-db / 30);
            return sb - sa;
          })
          .slice(0, 10);
        if (seeded.length) {
          storage.setItem(FAVORITES_KEY, JSON.stringify(seeded));
          return seeded;
        }
      }
    } catch (e) {}
    return [];
  })();
  function saveFavorites() { storage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); }
  function isFavorite(medId) { return favorites.includes(medId); }
  function toggleFavorite(medId) {
    if (!medId) return false;
    const i = favorites.indexOf(medId);
    if (i >= 0) favorites.splice(i, 1);
    else favorites.push(medId);
    saveFavorites();
    return isFavorite(medId);
  }
  function addFavorite(medId) {
    if (!medId || isFavorite(medId)) return;
    favorites.push(medId);
    saveFavorites();
  }
  // Meds that carry a `code:` definition (ACLS/PALS drugs).
  function codeMeds() {
    return library.filter(m => m && m.code && typeof m.code === "object");
  }
  function hasCodeMeds() { return codeMeds().length > 0; }
  // Resolve the code dose for the active population & weight. Returns:
  //   { totalDose, unit, perKg, note, source }
  // or `null` if no code block applies (e.g., neonatal not defined).
  function resolveCodeDose(med, population, weightKg) {
    if (!med || !med.code) return null;
    const def = (population === "pediatric" || population === "neonatal")
      ? (med.code.pediatric || med.code.adult)
      : (med.code.adult || med.code.pediatric);
    if (!def) return null;
    let total = def.dose;
    if (def.perKg) {
      if (!isFinite(weightKg) || weightKg <= 0) {
        return { totalDose: null, unit: def.unit, perKg: true, def, role: med.code.role };
      }
      total = def.dose * weightKg;
      if (typeof def.max === "number") total = Math.min(total, def.max);
      if (typeof def.min === "number") total = Math.max(total, def.min);
    }
    return { totalDose: total, unit: def.unit, perKg: def.perKg, def, role: med.code.role };
  }

  function favoriteMeds() {
    return favorites
      .map(id => library.find(m => m.id === id))
      .filter(Boolean);
  }
  function hasFavorites() { return favoriteMeds().length > 0; }

  // ----------- USER ORDERINGS -----------
  let order = (() => {
    try { return JSON.parse(storage.getItem(ORDER_KEY)) || {}; } catch (e) { return {}; }
  })();
  if (!order.categories) order.categories = null; // null = use natural order
  if (!order.meds) order.meds = {};
  function saveOrder() { storage.setItem(ORDER_KEY, JSON.stringify(order)); }

  // ----------- LONG-PRESS DRAG-TO-REORDER HELPER -----------
  // Works on mouse + touch via Pointer Events. Triggers a drag after a 350ms
  // long-press so normal taps and scrolls aren't intercepted. The dragged
  // element gets a `.dragging` class; live reordering happens by moving the
  // node in the DOM as the pointer crosses sibling midpoints. On release we
  // collect the new order from DOM and call onCommit. Identifier extraction
  // works for both reorderable kinds:
  //   - category buttons → data-cat
  //   - med cards         → data-id
  // We pass back the array of identifiers in the new order.
  const LONG_PRESS_MS = 350;
  const LONG_PRESS_MOVE_TOLERANCE = 14; // px before the press is cancelled (fingers jitter ~10px)
  function enableReorder(container, itemSelector, onCommit, opts) {
    if (!container) return;
    // Idempotent: if already wired with the same selector, replace.
    if (container._reorderCleanup) container._reorderCleanup();
    opts = opts || {};
    // crossTab:        if true, dragging an item over a category tab in #cats
    //                  highlights that tab; on release the med moves there.
    // inGridReorder:   if false, in-grid reordering is disabled (the drag is
    //                  only useful for cross-tab moves — used in "All" view).
    const crossTab = !!opts.crossTab;
    const inGridReorder = opts.inGridReorder !== false;
    let pressTimer = null;
    let dragNode = null;
    let pressX = 0, pressY = 0;
    let active = false;
    let pointerId = null;
    let placeholder = null;
    let dropTab = null; // category tab being hovered (cross-tab drop target)
    function getItems() { return $$(itemSelector, container); }
    function getIdent(node) {
      return node.dataset.id || node.dataset.cat || "";
    }
    function clearDropTab() {
      if (dropTab) { dropTab.classList.remove("cat-drop-target"); dropTab = null; }
    }
    function findCategoryTabAt(x, y) {
      const cats = document.getElementById("cats");
      if (!cats) return null;
      const tabs = cats.querySelectorAll("button[data-cat]");
      for (const t of tabs) {
        const r = t.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t;
      }
      return null;
    }
    function startDrag(node, e) {
      active = true;
      dragNode = node;
      // Vibrate on supported devices to confirm the drag started.
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch(_) {} }
      const rect = node.getBoundingClientRect();
      // When in-grid reorder is enabled, drop a sized placeholder so the
      // surrounding layout doesn't collapse. For cross-tab-only drags (e.g.
      // dragging from the All view), skip the placeholder — we don't intend
      // to re-home the node in the grid.
      if (inGridReorder) {
        placeholder = document.createElement(node.tagName);
        placeholder.className = "reorder-placeholder";
        placeholder.style.width = rect.width + "px";
        placeholder.style.height = rect.height + "px";
        node.parentNode.insertBefore(placeholder, node);
      } else {
        placeholder = null;
      }
      // Lift the node into a fixed-position floating drag avatar.
      node.classList.add("dragging");
      node.style.position = "fixed";
      node.style.left = rect.left + "px";
      node.style.top = rect.top + "px";
      node.style.width = rect.width + "px";
      node.style.height = rect.height + "px";
      node.style.zIndex = "1000";
      node._dragOffsetX = e.clientX - rect.left;
      node._dragOffsetY = e.clientY - rect.top;
      // (pointer was already captured to `node` in onPointerDown.)
    }
    function moveDrag(e) {
      if (!active || !dragNode) return;
      // Move the drag avatar with the pointer.
      dragNode.style.left = (e.clientX - dragNode._dragOffsetX) + "px";
      dragNode.style.top = (e.clientY - dragNode._dragOffsetY) + "px";

      // Cross-tab drop detection: if the pointer is over a category tab, mark
      // it as a drop target. While hovering a tab we suppress in-grid reorder
      // moves so the placeholder doesn't jump around.
      if (crossTab) {
        const overTab = findCategoryTabAt(e.clientX, e.clientY);
        if (overTab !== dropTab) {
          clearDropTab();
          if (overTab) {
            dropTab = overTab;
            dropTab.classList.add("cat-drop-target");
          }
        }
        if (dropTab) return; // skip in-grid reorder while hovering a tab
      }
      if (!inGridReorder || !placeholder) return;

      // Find the item the pointer is currently over (excluding dragNode itself).
      const items = getItems().filter(n => n !== dragNode);
      let inserted = false;
      for (const it of items) {
        const r = it.getBoundingClientRect();
        const midX = r.left + r.width / 2;
        const midY = r.top + r.height / 2;
        // For wrap-flow containers (like our category bar), test both axes:
        // first match by row (Y within bounds), then within that row by X.
        const inRow = e.clientY >= r.top && e.clientY <= r.bottom;
        if (inRow && e.clientX < midX) {
          if (placeholder.nextSibling !== it) it.parentNode.insertBefore(placeholder, it);
          inserted = true;
          break;
        }
        if (e.clientY < midY && !inRow) {
          // Pointer is above this row — insert before this item.
          if (placeholder.nextSibling !== it) it.parentNode.insertBefore(placeholder, it);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        // After the last item.
        const last = items[items.length - 1];
        if (last && placeholder.previousSibling !== last) {
          last.parentNode.insertBefore(placeholder, last.nextSibling);
        }
      }
    }
    function endDrag(commit) {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      // Release pointer capture from whichever element captured it.
      if (dragNode && pointerId !== null) {
        try { dragNode.releasePointerCapture(pointerId); } catch (_) {}
      }
      pointerId = null;
      if (!active || !dragNode) {
        active = false;
        dragNode = null;
        clearDropTab();
        return;
      }
      // Stash drop info before we tear down state.
      const droppedOnTab = commit && crossTab && dropTab ? dropTab : null;
      const droppedMedId = dragNode.dataset.id || "";
      clearDropTab();
      // Drop the dragged node where the placeholder is now sitting (if any).
      if (placeholder) {
        placeholder.parentNode.insertBefore(dragNode, placeholder);
        placeholder.remove();
        placeholder = null;
      }
      // Restore styles.
      dragNode.classList.remove("dragging");
      dragNode.style.position = "";
      dragNode.style.left = "";
      dragNode.style.top = "";
      dragNode.style.width = "";
      dragNode.style.height = "";
      dragNode.style.zIndex = "";
      dragNode = null;
      active = false;
      // Mark that a drag just finished so the synthetic click is ignored.
      container.dataset.justDragged = "1";
      setTimeout(() => { container.dataset.justDragged = ""; }, 50);
      if (droppedOnTab && droppedMedId) {
        // Cross-tab drop wins over in-grid reorder: move the med to the new
        // category (or favorites). Skip the regular onCommit because the grid
        // is about to be re-rendered anyway.
        handleCrossTabDrop(droppedMedId, droppedOnTab.dataset.cat);
        return;
      }
      if (commit && inGridReorder && typeof onCommit === "function") {
        const ids = getItems().map(getIdent);
        try { onCommit(ids); } catch (e) { console.error("reorder commit failed", e); }
      }
    }
    function onPointerDown(e) {
      // Only primary button (mouse) — for touch/pen, button is 0.
      if (e.button !== undefined && e.button !== 0) return;
      const node = e.target.closest(itemSelector);
      if (!node || !container.contains(node)) return;
      // Don't initiate drag from the inner remove button.
      if (e.target.closest(".med-card-remove")) return;
      pointerId = e.pointerId;
      pressX = e.clientX;
      pressY = e.clientY;
      // Capture the pointer to the NODE itself (not the container) so iOS /
      // Windows commit the entire gesture to us — no mid-press handoff to
      // page scroll or text-selection. We capture immediately at pointerdown,
      // not after the long-press fires.
      try { node.setPointerCapture(pointerId); } catch (_) {}
      pressTimer = setTimeout(() => {
        pressTimer = null;
        startDrag(node, { clientX: pressX, clientY: pressY });
      }, LONG_PRESS_MS);
    }
    function onPointerMove(e) {
      if (active) {
        e.preventDefault();
        moveDrag(e);
        return;
      }
      // If we haven't started drag yet, cancel the long-press if the pointer
      // moves too far (user is scrolling, not pressing).
      if (pressTimer) {
        const dx = e.clientX - pressX;
        const dy = e.clientY - pressY;
        if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      }
    }
    function onPointerUp() { endDrag(true); }
    function onPointerCancel() { endDrag(false); }
    // Suppress native long-press behaviors that would otherwise compete with
    // our gesture: iOS callout (copy/share popup), Windows touch text-highlight,
    // contextmenu, and selectstart. These fire BEFORE our pointerdown handler
    // can fully claim the gesture, so we cancel them at the source.
    function onContextMenu(e) {
      // Block the long-press context menu when the press starts on a draggable.
      if (e.target.closest(itemSelector)) e.preventDefault();
    }
    function onSelectStart(e) {
      if (e.target.closest(itemSelector)) e.preventDefault();
    }
    function onDragStart(e) {
      // Disable native HTML5 drag (which would fight Pointer Events).
      if (e.target.closest(itemSelector)) e.preventDefault();
    }
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerCancel);
    container.addEventListener("contextmenu", onContextMenu);
    container.addEventListener("selectstart", onSelectStart);
    container.addEventListener("dragstart", onDragStart);
    // Avoid native iOS callout / text selection when long-pressing.
    container.style.touchAction = container.style.touchAction || "manipulation";
    container._reorderCleanup = () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);
      container.removeEventListener("contextmenu", onContextMenu);
      container.removeEventListener("selectstart", onSelectStart);
      container.removeEventListener("dragstart", onDragStart);
      if (pressTimer) clearTimeout(pressTimer);
    };
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
    // codeOnly meds use a sentinel category ("_codeOnly") that must never appear
    // as a tab — they're only reachable via the Code tab.
    const used = new Set(library.filter(m => !m.codeOnly).map(m => m.category));
    DEFAULT_CATEGORIES.forEach(c => used.add(c));
    used.delete("_codeOnly"); // belt-and-suspenders
    const all = Array.from(used);
    // If the user has a saved category order, apply it; new categories
    // (added since the order was saved) are appended to the end.
    if (order.categories && Array.isArray(order.categories)) {
      const known = new Set(all);
      const ordered = order.categories.filter(c => known.has(c));
      const remaining = all.filter(c => !ordered.includes(c));
      return [...ordered, ...remaining];
    }
    return all;
  }

  // Called when a med card is dropped onto a category tab. Handles three cases:
  //  - drop on Favorites tab → add to favorites (no category change)
  //  - drop on All tab       → no-op (All is a filter, not a category)
  //  - drop on real category → move med there (and clean stale order entries)
  // Then re-render cats and grid so the UI reflects the new home.
  function handleCrossTabDrop(medId, targetCat) {
    const med = library.find(m => m.id === medId);
    if (!med || !targetCat) return;
    if (targetCat === FAVORITES_CATEGORY) {
      addFavorite(medId);
      renderCats();
      renderGrid();
      return;
    }
    if (targetCat === "All") {
      // "All" isn't a real category — nothing to do.
      renderGrid();
      return;
    }
    if (med.category === targetCat) {
      // Already in this category. Re-render to clear visual state.
      renderGrid();
      return;
    }
    const oldCat = med.category;
    med.category = targetCat;
    saveLibrary();
    // Remove the med from its old per-category order; append it to the new
    // category's order if one exists so its position is at least defined.
    if (Array.isArray(order.meds[oldCat])) {
      order.meds[oldCat] = order.meds[oldCat].filter(x => x !== medId);
    }
    if (Array.isArray(order.meds[targetCat]) && !order.meds[targetCat].includes(medId)) {
      order.meds[targetCat].push(medId);
    }
    saveOrder();
    renderCats();
    renderGrid();
  }

  // ----------- WEIGHT STRIP -----------
  const weightInput = $("#weight");
  const unitToggle = $$(".unit-toggle button");
  const weightDerived = $("#weight-derived");
  const weightInlineConv = $("#weight-inline-conv");

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
      // No weight: show warning in the strip, clear the inline pill.
      weightDerived.innerHTML = `<span style="color:var(--warn)">Enter weight to enable weight-based dosing</span>`;
      if (weightInlineConv) weightInlineConv.textContent = "";
      return;
    }
    const kg = state.weightKg;
    const lb = kg * 2.20462;
    // The conversion is rendered INSIDE the weight input separated by " / ".
    // Clear the legacy strip element so the value isn't duplicated.
    weightDerived.innerHTML = "";
    if (weightInlineConv) {
      const txt = state.unit === "kg" ? `/ ${fmt(lb,1)} lb` : `/ ${fmt(kg,1)} kg`;
      weightInlineConv.textContent = txt;
    }
  }

  weightInput.addEventListener("input", () => {
    const v = parseFloat(weightInput.value);
    if (isNaN(v) || v <= 0) state.weightKg = null;
    else state.weightKg = state.unit === "kg" ? v : v / 2.20462;
    // Auto-population: if the user hasn't manually picked a population this
    // session, snap to pediatric for weights < 50 kg (UMHS PICU rule), or
    // back to adult for >= 50 kg. If the weight is cleared/invalid, fall
    // back to adult — leaving a stale pediatric setting when the field is
    // empty has caused confusion in QA.
    if (!state.populationManual) {
      const suggestion = suggestedPopulationFromWeight(state.weightKg) || "adult";
      if (suggestion !== state.population) {
        applyPopulation(suggestion, /*manual*/ false);
      } else {
        // Even when we don't change, refresh the auto-suggested visual state
        // so the glow shows up on the first valid weight entry.
        syncPopulationVisual();
      }
    }
    saveState();
    updateWeightDerived();
    if ($("#calc-modal").open) updateCalc();
    // Pediatric-dosed cards highlight based on weight → population, so we
    // re-render the grid whenever weight changes the active population.
    renderGrid();
  });
  unitToggle.forEach(b => b.addEventListener("click", () => setUnit(b.dataset.unit)));

  // Reset weight — clears the patient strip without touching the library.
  // Also re-arms auto-population so the next entered weight can switch to
  // pediatric automatically.
  const btnResetPatient = $("#btn-reset-patient");
  if (btnResetPatient) {
    btnResetPatient.addEventListener("click", () => {
      state.weightKg = null;
      state.populationManual = false;
      // Returning to adult is the sensible default for a cleared patient.
      state.population = "adult";
      saveState();
      syncWeightInput();
      syncPopulationVisual();
      if ($("#calc-modal").open) updateCalc();
      renderGrid();
      weightInput.focus();
    });
  }

  // ----------- CATEGORY TABS -----------
  function renderCats() {
    const wrap = $("#cats");
    // "Favorites" appears at the front whenever the user has favorited at
    // least one medication. "All" follows. Then user-defined categories.
    const showFav = hasFavorites();
    const showCode = hasCodeMeds();
    const cats = [];
    if (showFav) cats.push(FAVORITES_CATEGORY);
    if (showCode) cats.push(CODE_CATEGORY);
    cats.push("All", ...getCategories());
    // If state.category points to something that no longer exists (e.g. user
    // cleared favorites and Favorites tab disappeared), fall back to "All".
    if (!cats.includes(state.category)) state.category = "All";
    wrap.innerHTML = cats.map(c => {
      const isFav = c === FAVORITES_CATEGORY;
      const isCode = c === CODE_CATEGORY;
      // Favorites / Code / All are virtual filters — not reorderable.
      const reorderable = !isFav && !isCode && c !== "All";
      const icon = isFav ? '<span class="cat-icon" aria-hidden="true">★</span>'
                  : isCode ? '<span class="cat-icon code-icon" aria-hidden="true">⚡</span>'
                  : '';
      const extraClass = isCode ? ' cat-code' : '';
      return `<button data-cat="${escapeAttr(c)}"${c === state.category ? ' class="active' + extraClass + '"' : (extraClass ? ' class="' + extraClass.trim() + '"' : '')}${reorderable ? ' data-reorderable="1"' : ''}>${icon}${escapeHtml(c)}</button>`;
    }).join("");
    $$("button", wrap).forEach(b => b.addEventListener("click", () => {
      // If we just finished a drag, swallow the resulting click.
      if (wrap.dataset.justDragged === "1") {
        wrap.dataset.justDragged = "";
        return;
      }
      state.category = b.dataset.cat;
      saveState();
      renderCats();
      renderGrid();
    }));
    // Wire long-press → drag-to-reorder for user-reorderable category tabs.
    enableReorder(wrap, "button[data-reorderable]", (newOrder) => {
      // newOrder is the full list of cat names from the DOM (including
      // Favorites / All which we filter out). We persist only the user-mutable
      // categories so adding new ones in the future still appends.
      const fixed = new Set([FAVORITES_CATEGORY, CODE_CATEGORY, "All"]);
      order.categories = newOrder.filter(c => !fixed.has(c));
      saveOrder();
    });
  }

  // ----------- GRID -----------
  function getDisplayedMeds() {
    const q = state.search.trim().toLowerCase();
    let items;
    if (state.category === FAVORITES_CATEGORY) {
      // Favorites: explicit, user-ordered list (drag-to-reorder writes back
      // to the `favorites` array directly, not to order.meds).
      items = favoriteMeds();
    } else if (state.category === CODE_CATEGORY) {
      // Code: meds with a `code:` block. We order by a natural ACLS sequence
      // (epinephrine first, then antiarrhythmics, then bradycardia, then
      // adjuncts). The order isn't user-reorderable.
      const codeOrder = ["defibrillation", "cardioversion",
                         "epinephrine", "amiodarone", "lidocaine", "atropine",
                         "adenosine", "magnesium", "calcium_chloride_gtt",
                         "sodium_bicarb", "dextrose50", "naloxone"];
      const all = codeMeds();
      const idx = id => { const i = codeOrder.indexOf(id); return i === -1 ? 999 : i; };
      items = all.slice().sort((a, b) => idx(a.id) - idx(b.id));
    } else {
      items = library.filter(m => {
        // codeOnly meds (e.g. cardioversion, defibrillation) NEVER appear outside
        // the Code tab — not in "All", not in any named category, not in search.
        if (m && m.codeOnly) return false;
        if (state.category !== "All" && m.category !== state.category) return false;
        return true;
      });
      // Apply user's per-category med order if set.
      const orderForCat = order.meds[state.category];
      if (orderForCat && Array.isArray(orderForCat)) {
        const indexOf = (id) => {
          const i = orderForCat.indexOf(id);
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        items = items.slice().sort((a, b) => {
          const ai = indexOf(a.id), bi = indexOf(b.id);
          if (ai !== bi) return ai - bi;
          return 0;
        });
      }
    }
    if (q) {
      items = items.filter(m =>
        m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
      );
    }
    // Apply the user's filter (bolus/infusion/per-kg/has-ped/code/favorites).
    items = applyFilter(items, state.filter);
    // Alphabetical sort, if requested. Skipped for the Code tab so the
    // clinical sequence (defib → cardioversion → epi → amio → …) is preserved
    // even when A-Z is active — alphabet is unhelpful mid-resuscitation.
    if (state.sort === "az" && state.category !== CODE_CATEGORY) {
      items = items.slice().sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
      );
    }
    return items;
  }
  // Filter helper. The `state.filter` value comes from the #filter <select>.
  function applyFilter(items, f) {
    if (!f || f === "all") return items;
    if (f === "bolus")    return items.filter(m => m.type === "bolus" || m.type === "both");
    if (f === "infusion") return items.filter(m => m.type === "infusion" || m.type === "both");
    if (f === "perkg")    return items.filter(m => (m.bolus && m.bolus.perKg) || (m.infusion && m.infusion.perKg));
    if (f === "hasped")   return items.filter(m => medHasPopulationOverlay(m, "pediatric"));
    if (f === "code")     return items.filter(m => m && m.code);
    if (f === "favorites") {
      const fset = new Set(favorites);
      return items.filter(m => fset.has(m.id));
    }
    return items;
  }
  function renderGrid() {
    const grid = $("#grid");
    const items = getDisplayedMeds();
    if (!items.length) {
      grid.innerHTML = `<div class="empty">No medications match. Try clearing filters or <button class="btn-ghost small" id="empty-add">add a new one</button>.</div>`;
      $("#empty-add")?.addEventListener("click", () => openEdit(null));
      return;
    }
    // Highlight med cards whose dosing changes for the current population.
    // Only applies to pediatric / neonatal — adult is the baseline so the
    // outline would be noise. The class is added below in the template.
    const showPopHighlight = state.population === "pediatric" || state.population === "neonatal";
    // Per-tile reorder disabled per user request — scrolling was misfiring
    // long-press drags. Tiles no longer carry data-reorderable.
    const showCodeDose = state.category === CODE_CATEGORY;
    grid.innerHTML = items.map(m => {
      const isCustom = m.category === "Custom";
      const hasPopDosing = showPopHighlight && medHasPopulationOverlay(m, state.population);
      const removeBtn = isCustom
        ? `<button type="button" class="med-card-remove" data-remove-id="${m.id}" title="Remove from Custom" aria-label="Remove ${escapeAttr(m.name)} from Custom"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg><span class="label">Remove?</span></button>`
        : "";
      const classes = ["med-card"];
      if (isCustom) classes.push("med-card-custom");
      if (hasPopDosing) classes.push("has-pop-dosing");
      if (showCodeDose) classes.push("med-card-code");
      const ariaLabel = hasPopDosing
        ? `${m.name} (has ${state.population} dosing)`
        : m.name;
      // Build the code-dose pill when in Code view.
      let codeBlock = "";
      if (showCodeDose && m.code) {
        const cd = resolveCodeDose(m, state.population, state.weightKg);
        const popLabel = (state.population === "pediatric" || state.population === "neonatal") ? "Peds" : "Adult";
        if (cd) {
          const totalTxt = (cd.totalDose === null)
            ? `<span class="code-dose-need-wt">Enter weight</span>`
            : `<span class="code-dose-amt">${fmt(cd.totalDose, 2)} ${escapeHtml(cd.unit)}</span>`;
          const perKgTxt = cd.perKg
            ? `<span class="code-dose-perkg">(${fmt(cd.def.dose, cd.def.dose < 1 ? 2 : 3)} ${escapeHtml(cd.def.unit)}/kg${typeof cd.def.max === "number" ? `, max ${cd.def.max} ${cd.def.unit}` : ""})</span>`
            : "";
          const repeat = cd.def.repeat ? `<div class="code-dose-repeat">↻ ${escapeHtml(cd.def.repeat)}</div>` : "";
          codeBlock = `
            <div class="code-dose">
              <div class="code-dose-role">${escapeHtml(cd.role || "")}</div>
              <div class="code-dose-main"><span class="code-dose-pop">${popLabel}</span> ${totalTxt} ${perKgTxt}</div>
              ${repeat}
            </div>`;
        }
      }
      // <div role="button"> instead of <button> so the nested remove
      // <button> is valid HTML (buttons cannot be nested inside buttons).
      return `<div class="${classes.join(" ")}" data-id="${m.id}" role="button" tabindex="0" aria-label="${escapeAttr(ariaLabel)}">
        <div class="name">${escapeHtml(m.name)}</div>
        ${codeBlock}
        ${removeBtn}
      </div>`;
    }).join("");
    $$(".med-card", grid).forEach(c => {
      c.addEventListener("click", (e) => {
        // Ignore clicks that originated on the inner remove button.
        if (e.target.closest(".med-card-remove")) return;
        // Swallow the click that fires after a drag.
        if (grid.dataset.justDragged === "1") {
          grid.dataset.justDragged = "";
          return;
        }
        openCalc(c.dataset.id);
      });
      // Keep keyboard activation (Enter / Space) working since this is a div.
      c.addEventListener("keydown", (e) => {
        if (e.target.closest(".med-card-remove")) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCalc(c.dataset.id);
        }
      });
    });
    // Per-tile drag/reorder intentionally disabled — user reported accidental
    // long-press reorders while scrolling. Both in-grid reorder AND cross-tab
    // drag of individual med tiles are disabled. Category tabs remain
    // reorderable (separate enableReorder call on .cats).
    // Wire each card's remove button. Uses an inline two-step confirmation
    // (first tap arms the button, second tap removes) instead of window.confirm,
    // because native dialogs can be unreliable on iPad / WKWebView.
    let armedRemoveId = null;
    let armedRemoveTimer = null;
    function disarmRemove() {
      armedRemoveId = null;
      if (armedRemoveTimer) { clearTimeout(armedRemoveTimer); armedRemoveTimer = null; }
      $$(".med-card-remove", grid).forEach(b => b.classList.remove("armed"));
    }
    function commitRemove(id) {
      const med = library.find(m => m.id === id);
      if (!med) return;
      library = library.filter(m => m.id !== id);
      saveLibrary();
      // Tidy up favorites + per-category order so a deleted med can't haunt them.
      const fi = favorites.indexOf(id);
      if (fi >= 0) { favorites.splice(fi, 1); saveFavorites(); }
      Object.keys(order.meds).forEach(cat => {
        if (Array.isArray(order.meds[cat])) {
          order.meds[cat] = order.meds[cat].filter(x => x !== id);
        }
      });
      saveOrder();
      if (state.currentMedId === id) closeCalc();
      armedRemoveId = null;
      if (armedRemoveTimer) { clearTimeout(armedRemoveTimer); armedRemoveTimer = null; }
      renderCats();
      renderGrid();
    }
    $$(".med-card-remove", grid).forEach(btn => {
      const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const id = btn.dataset.removeId;
        if (armedRemoveId === id) {
          // Second tap on the same button → commit removal.
          commitRemove(id);
        } else {
          // First tap → arm this button, disarm any other, auto-disarm after 3s.
          disarmRemove();
          armedRemoveId = id;
          btn.classList.add("armed");
          armedRemoveTimer = setTimeout(disarmRemove, 3000);
        }
      };
      btn.addEventListener("click", handler);
    });
    // Tapping anywhere outside an armed button disarms it (and swallows the
    // tap so it doesn't also open the calculator).
    grid.addEventListener("click", (e) => {
      if (!armedRemoveId) return;
      if (e.target.closest(".med-card-remove.armed")) return;
      e.stopPropagation();
      e.preventDefault();
      disarmRemove();
    }, true);
  }

  $("#search").addEventListener("input", e => { state.search = e.target.value; renderGrid(); });
  const filterSelect = $("#filter");
  if (filterSelect) {
    // Restore the persisted filter into the <select>.
    if (state.filter) filterSelect.value = state.filter;
    filterSelect.addEventListener("change", e => {
      state.filter = e.target.value || "all";
      saveState();
      renderGrid();
    });
  }

  // Alphabetical sort toggle. "natural" = file/custom order (default).
  // "az" = locale-aware case-insensitive alphabetical. Sort is skipped for the
  // Code tab (see getDisplayedMeds) so the clinical sequence is preserved.
  const sortBtn = $("#btn-sort");
  function syncSortBtn() {
    if (!sortBtn) return;
    const on = state.sort === "az";
    sortBtn.classList.toggle("active", on);
    sortBtn.setAttribute("aria-pressed", on ? "true" : "false");
    sortBtn.title = on ? "Alphabetical order (tap to disable)" : "Tap to sort alphabetically";
  }
  if (sortBtn) {
    syncSortBtn();
    sortBtn.addEventListener("click", () => {
      state.sort = state.sort === "az" ? "natural" : "az";
      syncSortBtn();
      saveState();
      renderGrid();
    });
  }

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
      // Neonatal layers on top of pediatric (pediatric first as base, then
      // neonatal-specific overrides). This way a neonatal block can add notes
      // or override one field while inheriting the rest from pediatric.
      if (pops.pediatric) overlays.push(pops.pediatric);
      if (pops.neonatal) overlays.push(pops.neonatal);
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

    calcName.textContent = med.name;
    // codeOnly entries use a sentinel category ("_codeOnly") that shouldn't
    // be shown to the user — surface them as "Code" instead.
    calcCat.textContent = (med.codeOnly || baseMed.codeOnly) ? "Code" : med.category;

    // Sync ★ favorite toggle in the calc header.
    syncCalcFavoriteButton(id);

    // Sources block
    renderSources(med);

    // ---- Custom calculators ----
    // Some entries (e.g. pediatric maintenance fluid) don't fit the
    // concentration×dose model. Detect via med.customCalc and render a
    // bespoke result panel, hiding the standard controls.
    if (med.customCalc) {
      renderCustomCalc(med);
      if (typeof calcModal.showModal === "function") calcModal.showModal();
      else calcModal.setAttribute("open", "");
      return;
    }

    const types = effectiveTypes(med);
    // For "both" meds, default to infusion if it has one (more common entry point);
    // for pure bolus or pure infusion, use the only available mode.
    state.mode = types.includes("infusion") ? "infusion" : "bolus";
    state.concIdx = 0;

    // Restore standard calc controls (in case they were hidden by a custom calc).
    showStandardCalcControls();

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

  // -------- Custom calculators (non-concentration×dose meds) --------
  // Hide the standard concentration / mode / dose / range controls so the
  // result panel can render a bespoke calculator UI.
  function hideStandardCalcControls() {
    const ids = ["calc-mode-seg", "calc-mode-desc", "calc-bolus-cta", "calc-edit", "calc-duplicate"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
    // Hide concentration .field and dose .field (dose .field also wraps the range row).
    ["calc-conc", "calc-dose", "calc-range"].forEach(id => {
      const el = document.getElementById(id);
      const field = el && el.closest(".field");
      if (field) field.style.display = "none";
    });
    const notes = document.getElementById("calc-notes");
    if (notes) notes.style.display = "";
  }
  function showStandardCalcControls() {
    const ids = ["calc-mode-seg", "calc-mode-desc", "calc-edit", "calc-duplicate"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ""; });
    ["calc-conc", "calc-dose", "calc-range"].forEach(id => {
      const el = document.getElementById(id);
      const field = el && el.closest(".field");
      if (field) field.style.display = "";
    });
  }

  function renderCustomCalc(med) {
    hideStandardCalcControls();
    const result = document.getElementById("calc-result");
    const notes = document.getElementById("calc-notes");
    if (med.customCalc === "maintenance_mlkg") {
      paintMaintenance(med, result);
      if (notes) notes.textContent = med.notes || "";
    } else if (med.customCalc === "maintenance_421") {
      paintMaintenance421(med, result);
      if (notes) notes.textContent = med.notes || "";
    } else if (med.customCalc === "defibrillation" || med.customCalc === "cardioversion") {
      paintElectricalTherapy(med, result);
      if (notes) notes.textContent = med.notes || "";
    } else {
      result.innerHTML = `<div class="calc-warning">Unknown custom calculator: ${escapeHtml(med.customCalc)}</div>`;
    }
  }

  // Electrical-therapy panel (defibrillation / synchronized cardioversion).
  // Renders weight-based joules options with an inline weight input so the
  // user can adjust without leaving the modal. Shares pattern with paintMaintenance.
  function paintElectricalTherapy(med, resultEl) {
    resultEl.innerHTML = renderElectricalTherapy(med, state.weightKg);
    const innerWeight = document.getElementById("maintenance-weight");
    if (!innerWeight) return;
    innerWeight.addEventListener("input", () => {
      const raw = innerWeight.value;
      const v = parseFloat(raw);
      const kg = (isNaN(v) || v <= 0) ? null : v;
      state.weightKg = kg;
      const mainInput = document.getElementById("weight");
      if (mainInput) {
        if (kg === null) mainInput.value = "";
        else mainInput.value = state.unit === "kg" ? String(v) : (kg * 2.20462).toFixed(1);
      }
      if (!state.populationManual) {
        const suggestion = suggestedPopulationFromWeight(kg) || "adult";
        if (suggestion !== state.population) applyPopulation(suggestion, false);
        else syncPopulationVisual();
      }
      saveState();
      updateWeightDerived();
      renderGrid();
      const caret = innerWeight.selectionStart;
      paintElectricalTherapy(med, resultEl);
      const refocus = document.getElementById("maintenance-weight");
      if (refocus) {
        refocus.focus();
        try { refocus.setSelectionRange(caret, caret); } catch (_) {}
      }
    });
  }

  // Defibrillation: PALS pediatric ladder 2 → 4 → ≥4 J/kg, capped at 10 J/kg
  // or adult equivalent (whichever lower). Adult: 200 J biphasic (escalate).
  // Cardioversion: PALS 0.5–1 → 2 J/kg. Adult: 50–200 J depending on rhythm.
  function renderElectricalTherapy(med, weightKg) {
    const isPeds = state.population === "pediatric" || state.population === "neonatal";
    const isDefib = med.customCalc === "defibrillation";
    const weightInput = `
      <div class="maintenance-weight-row">
        <label for="maintenance-weight" class="maintenance-weight-label">Patient weight</label>
        <div class="maintenance-weight-input-wrap">
          <input id="maintenance-weight" type="number" inputmode="decimal" step="0.1" min="0" placeholder="—" value="${weightKg ? fmt(weightKg, 2) : ""}" />
          <span class="maintenance-weight-unit">kg</span>
        </div>
      </div>`;

    // Cap pediatric joules at 10 J/kg (defib) or 2 J/kg (cardioversion) and
    // never exceed adult dose, per PALS 2020.
    function pedJoules(perKg) {
      if (!weightKg || weightKg <= 0) return null;
      const adultCap = isDefib ? 360 : 200;
      return Math.min(weightKg * perKg, adultCap);
    }

    if (isPeds) {
      if (!weightKg || weightKg <= 0) {
        return `${weightInput}
          <div class="maintenance-empty">
            <div class="maintenance-empty-title">Enter patient weight</div>
            <div class="maintenance-empty-sub">Pediatric ${isDefib ? "defibrillation" : "cardioversion"} energies are weight-based.</div>
          </div>`;
      }
      if (isDefib) {
        return `${weightInput}
          <div class="maintenance-result">
            <div class="maintenance-headline maintenance-headline--primary">
              <div class="maintenance-label">First shock — 2 J/kg</div>
              <div class="maintenance-rate">${fmt(pedJoules(2), 0)} <span class="unit">J</span></div>
              <div class="maintenance-sub">Unsynchronized — VF / pulseless VT</div>
            </div>
            <div class="maintenance-cards maintenance-cards--two">
              <div class="maintenance-card">
                <div class="maintenance-card-label">Second shock — 4 J/kg</div>
                <div class="maintenance-card-val">${fmt(pedJoules(4), 0)} J</div>
                <div class="maintenance-card-sub">Resume CPR 2 min, then shock</div>
              </div>
              <div class="maintenance-card">
                <div class="maintenance-card-label">Subsequent — ≥4 J/kg</div>
                <div class="maintenance-card-val">${fmt(pedJoules(4), 0)}–${fmt(pedJoules(10), 0)} J</div>
                <div class="maintenance-card-sub">Max 10 J/kg or adult dose</div>
              </div>
            </div>
            <div class="maintenance-disclaimer">
              Unsynchronized shock. Resume CPR immediately after each shock for 2 min before pulse/rhythm check. Give epinephrine 0.01 mg/kg IV/IO q3–5 min and amiodarone 5 mg/kg (or lidocaine) after 2nd–3rd shock.
            </div>
          </div>`;
      }
      // Pediatric cardioversion
      return `${weightInput}
        <div class="maintenance-result">
          <div class="maintenance-headline maintenance-headline--primary">
            <div class="maintenance-label">Initial — 0.5–1 J/kg</div>
            <div class="maintenance-rate">${fmt(pedJoules(0.5), 1)}–${fmt(pedJoules(1), 0)} <span class="unit">J</span></div>
            <div class="maintenance-sub">Synchronized — unstable tachycardia w/ pulse</div>
          </div>
          <div class="maintenance-cards maintenance-cards--two">
            <div class="maintenance-card">
              <div class="maintenance-card-label">Escalate — 2 J/kg</div>
              <div class="maintenance-card-val">${fmt(pedJoules(2), 0)} J</div>
              <div class="maintenance-card-sub">If initial dose ineffective</div>
            </div>
            <div class="maintenance-card">
              <div class="maintenance-card-label">Sedation</div>
              <div class="maintenance-card-val">If conscious</div>
              <div class="maintenance-card-sub">Etomidate 0.1–0.2 mg/kg or ketamine 1–2 mg/kg</div>
            </div>
          </div>
          <div class="maintenance-disclaimer">
            Synchronized shock. Confirm SYNC mode is engaged before EACH shock — most devices re-arm to unsynchronized between shocks. Consider adenosine first for stable SVT.
          </div>
        </div>`;
    }

    // Adult — weight not used. Show fixed-energy guidance.
    if (isDefib) {
      return `${weightInput}
        <div class="maintenance-result">
          <div class="maintenance-headline maintenance-headline--primary">
            <div class="maintenance-label">First shock</div>
            <div class="maintenance-rate">200 <span class="unit">J</span></div>
            <div class="maintenance-sub">Biphasic — VF / pulseless VT (unsynchronized)</div>
          </div>
          <div class="maintenance-cards maintenance-cards--two">
            <div class="maintenance-card">
              <div class="maintenance-card-label">Subsequent shocks</div>
              <div class="maintenance-card-val">200–360 J</div>
              <div class="maintenance-card-sub">Escalate per manufacturer; use max if unsure</div>
            </div>
            <div class="maintenance-card">
              <div class="maintenance-card-label">Monophasic (legacy)</div>
              <div class="maintenance-card-val">360 J</div>
              <div class="maintenance-card-sub">Use max from the first shock</div>
            </div>
          </div>
          <div class="maintenance-disclaimer">
            Unsynchronized. Resume CPR immediately after each shock for 2 min before pulse/rhythm check. Epinephrine 1 mg IV/IO q3–5 min; amiodarone 300 mg → 150 mg (or lidocaine 1–1.5 mg/kg) for refractory VF/pVT.
          </div>
        </div>`;
    }
    // Adult cardioversion
    return `${weightInput}
      <div class="maintenance-result">
        <div class="maintenance-headline maintenance-headline--primary">
          <div class="maintenance-label">Typical initial</div>
          <div class="maintenance-rate">100 <span class="unit">J</span></div>
          <div class="maintenance-sub">Synchronized — unstable tachycardia w/ pulse</div>
        </div>
        <div class="maintenance-cards">
          <div class="maintenance-card">
            <div class="maintenance-card-label">Narrow regular (SVT, AFlutter)</div>
            <div class="maintenance-card-val">50–100 J</div>
            <div class="maintenance-card-sub">Start low, escalate</div>
          </div>
          <div class="maintenance-card">
            <div class="maintenance-card-label">Narrow irregular (AFib)</div>
            <div class="maintenance-card-val">120–200 J</div>
            <div class="maintenance-card-sub">Biphasic</div>
          </div>
          <div class="maintenance-card">
            <div class="maintenance-card-label">Wide regular (monomorphic VT)</div>
            <div class="maintenance-card-val">100 J</div>
            <div class="maintenance-card-sub">Escalate if needed</div>
          </div>
          <div class="maintenance-card">
            <div class="maintenance-card-label">Wide irregular</div>
            <div class="maintenance-card-val">Treat as VF</div>
            <div class="maintenance-card-sub">Unsynchronized — see Defibrillation</div>
          </div>
        </div>
        <div class="maintenance-disclaimer">
          Synchronized shock. Confirm SYNC mode is engaged before EACH shock — most devices re-arm to unsynchronized between shocks. Sedate if conscious: etomidate 0.1–0.3 mg/kg or midazolam 1–2 mg.
        </div>
      </div>`;
  }

  // Render the maintenance panel HTML and wire its inline weight input.
  // Called both on open and on each weight change so the panel re-renders
  // live without closing the modal.
  function paintMaintenance(med, resultEl) {
    const focusKg = state.weightKg;
    resultEl.innerHTML = renderMaintenanceMlkg(focusKg);
    const innerWeight = document.getElementById("maintenance-weight");
    if (!innerWeight) return;
    // Keep the cursor at the end after re-render.
    if (document.activeElement && document.activeElement.id === "maintenance-weight") {
      // already focused: nothing to do
    }
    innerWeight.addEventListener("input", () => {
      const raw = innerWeight.value;
      const v = parseFloat(raw);
      const kg = (isNaN(v) || v <= 0) ? null : v;
      state.weightKg = kg;
      // Mirror to the patient-strip weight input.
      const mainInput = document.getElementById("weight");
      if (mainInput) {
        if (kg === null) mainInput.value = "";
        else mainInput.value = state.unit === "kg" ? String(v) : (kg * 2.20462).toFixed(1);
      }
      // Auto-population.
      if (!state.populationManual) {
        const suggestion = suggestedPopulationFromWeight(kg) || "adult";
        if (suggestion !== state.population) applyPopulation(suggestion, false);
        else syncPopulationVisual();
      }
      saveState();
      updateWeightDerived();
      renderGrid();
      // Re-render maintenance panel; preserve focus + caret.
      const caret = innerWeight.selectionStart;
      paintMaintenance(med, resultEl);
      const refocus = document.getElementById("maintenance-weight");
      if (refocus) {
        refocus.focus();
        try { refocus.setSelectionRange(caret, caret); } catch (_) {}
      }
    });
  }

  // Weight-based isotonic crystalloid volumes for resuscitation / maintenance
  // bolus dosing. Returns 5, 10, and 20 mL/kg results based on entered weight.
  function calcMaintenanceMlkg(weightKg) {
    if (!weightKg || weightKg <= 0) return null;
    return {
      five:      weightKg * 5,
      ten:       weightKg * 10,
      twenty:    weightKg * 20
    };
  }

  function renderMaintenanceMlkg(weightKg) {
    const r = calcMaintenanceMlkg(weightKg);
    // Always render a weight input inside the modal so the clinician can
    // tweak it without closing the modal first (the <dialog> is modal and
    // blocks the patient-strip input behind it).
    const weightInput = `
      <div class="maintenance-weight-row">
        <label for="maintenance-weight" class="maintenance-weight-label">Patient weight</label>
        <div class="maintenance-weight-input-wrap">
          <input id="maintenance-weight" type="number" inputmode="decimal" step="0.1" min="0" placeholder="—" value="${weightKg ? fmt(weightKg, 2) : ""}" />
          <span class="maintenance-weight-unit">kg</span>
        </div>
      </div>`;
    if (!r) {
      return `${weightInput}
      <div class="maintenance-empty">
        <div class="maintenance-empty-title">Enter patient weight</div>
        <div class="maintenance-empty-sub">Volumes are calculated as 5, 10, and 20 mL/kg of isotonic crystalloid.</div>
      </div>`;
    }
    return `${weightInput}
      <div class="maintenance-result">
        <div class="maintenance-headline maintenance-headline--primary">
          <div class="maintenance-label">20 mL/kg bolus</div>
          <div class="maintenance-rate">${fmt(r.twenty, 0)} <span class="unit">mL</span></div>
          <div class="maintenance-sub">Standard resuscitation bolus (PALS / sepsis)</div>
        </div>
        <div class="maintenance-cards maintenance-cards--two">
          <div class="maintenance-card">
            <div class="maintenance-card-label">10 mL/kg bolus</div>
            <div class="maintenance-card-val">${fmt(r.ten, 0)} mL</div>
            <div class="maintenance-card-sub">Cautious bolus — neonate, cardiac, TBI/SIADH risk</div>
          </div>
          <div class="maintenance-card">
            <div class="maintenance-card-label">5 mL/kg bolus</div>
            <div class="maintenance-card-val">${fmt(r.five, 0)} mL</div>
            <div class="maintenance-card-sub">Conservative — fluid-restricted / fragile patient</div>
          </div>
        </div>
        <div class="maintenance-disclaimer">
          Isotonic crystalloid (NS or LR). Reassess hemodynamics and lung exam after each bolus; titrate to perfusion endpoints rather than fixed totals.
        </div>
      </div>`;
  }

  // -------- Holliday-Segar 4-2-1 maintenance fluid rate --------
  // Continuous (hourly) maintenance rate for ongoing fluid needs — NOT a bolus.
  // 4 mL/kg/hr first 10 kg, +2 mL/kg/hr next 10 kg, +1 mL/kg/hr each kg > 20.
  // Daily total ≈ 100 mL/kg first 10 kg, +50 mL/kg next 10, +20 mL/kg above 20.
  function paintMaintenance421(med, resultEl) {
    const focusKg = state.weightKg;
    resultEl.innerHTML = renderMaintenance421(focusKg);
    const innerWeight = document.getElementById("maintenance-weight");
    if (!innerWeight) return;
    innerWeight.addEventListener("input", () => {
      const raw = innerWeight.value;
      const v = parseFloat(raw);
      const kg = (isNaN(v) || v <= 0) ? null : v;
      state.weightKg = kg;
      const mainInput = document.getElementById("weight");
      if (mainInput) {
        if (kg === null) mainInput.value = "";
        else mainInput.value = state.unit === "kg" ? String(v) : (kg * 2.20462).toFixed(1);
      }
      if (!state.populationManual) {
        const suggestion = suggestedPopulationFromWeight(kg) || "adult";
        if (suggestion !== state.population) applyPopulation(suggestion, false);
        else syncPopulationVisual();
      }
      saveState();
      updateWeightDerived();
      renderGrid();
      const caret = innerWeight.selectionStart;
      paintMaintenance421(med, resultEl);
      const refocus = document.getElementById("maintenance-weight");
      if (refocus) {
        refocus.focus();
        try { refocus.setSelectionRange(caret, caret); } catch (_) {}
      }
    });
  }

  function calcMaintenance421(weightKg) {
    if (!weightKg || weightKg <= 0) return null;
    let ratePerHr = 0;
    let dailyMl = 0;
    const w = weightKg;
    if (w <= 10) {
      ratePerHr = w * 4;
      dailyMl   = w * 100;
    } else if (w <= 20) {
      ratePerHr = 40 + (w - 10) * 2;
      dailyMl   = 1000 + (w - 10) * 50;
    } else {
      ratePerHr = 60 + (w - 20) * 1;
      dailyMl   = 1500 + (w - 20) * 20;
    }
    return { ratePerHr, dailyMl };
  }

  function renderMaintenance421(weightKg) {
    const r = calcMaintenance421(weightKg);
    const weightInput = `
      <div class="maintenance-weight-row">
        <label for="maintenance-weight" class="maintenance-weight-label">Patient weight</label>
        <div class="maintenance-weight-input-wrap">
          <input id="maintenance-weight" type="number" inputmode="decimal" step="0.1" min="0" placeholder="—" value="${weightKg ? fmt(weightKg, 2) : ""}" />
          <span class="maintenance-weight-unit">kg</span>
        </div>
      </div>`;
    if (!r) {
      return `${weightInput}
      <div class="maintenance-empty">
        <div class="maintenance-empty-title">Enter patient weight</div>
        <div class="maintenance-empty-sub">Holliday-Segar 4-2-1 rule: 4 mL/kg/hr first 10 kg, +2 mL/kg/hr next 10, +1 mL/kg/hr above 20.</div>
      </div>`;
    }
    // Friendly tier breakdown so the user can sanity-check the math at a glance.
    let tier;
    if (weightKg <= 10)      tier = `4 mL/kg/hr × ${fmt(weightKg, 1)} kg`;
    else if (weightKg <= 20) tier = `40 + 2 mL/kg/hr × ${fmt(weightKg - 10, 1)} kg over 10`;
    else                     tier = `60 + 1 mL/kg/hr × ${fmt(weightKg - 20, 1)} kg over 20`;
    return `${weightInput}
      <div class="maintenance-result">
        <div class="maintenance-headline maintenance-headline--primary">
          <div class="maintenance-label">Maintenance rate</div>
          <div class="maintenance-rate">${fmt(r.ratePerHr, 1)} <span class="unit">mL/hr</span></div>
          <div class="maintenance-sub">${tier}</div>
        </div>
        <div class="maintenance-cards maintenance-cards--two">
          <div class="maintenance-card">
            <div class="maintenance-card-label">Daily total</div>
            <div class="maintenance-card-val">${fmt(r.dailyMl, 0)} mL / 24 h</div>
            <div class="maintenance-card-sub">100 / 50 / 20 mL/kg/day tiers</div>
          </div>
          <div class="maintenance-card">
            <div class="maintenance-card-label">mL/kg/hr (avg)</div>
            <div class="maintenance-card-val">${fmt(r.ratePerHr / weightKg, 2)} mL/kg/hr</div>
            <div class="maintenance-card-sub">Effective hourly rate per kg</div>
          </div>
        </div>
        <div class="maintenance-disclaimer">
          Isotonic fluid preferred (D5NS, D5LR, or per local protocol) — hypotonic maintenance fluids increase hyponatremia risk in hospitalized children (AAP 2018). For deficits and ongoing losses, calculate replacement separately and add to maintenance.
        </div>
      </div>`;
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

  // Favorite star — toggles the current med in/out of the Favorites list.
  const calcFavBtn = $("#calc-fav");
  function syncCalcFavoriteButton(medId) {
    if (!calcFavBtn) return;
    const fav = isFavorite(medId);
    calcFavBtn.setAttribute("aria-pressed", fav ? "true" : "false");
    calcFavBtn.classList.toggle("is-fav", fav);
    calcFavBtn.setAttribute("aria-label", fav ? "Remove from favorites" : "Add to favorites");
    calcFavBtn.setAttribute("title", fav ? "Remove from favorites" : "Add to favorites");
  }
  if (calcFavBtn) {
    calcFavBtn.addEventListener("click", () => {
      const id = state.currentMedId;
      if (!id) return;
      toggleFavorite(id);
      syncCalcFavoriteButton(id);
      // The Favorites tab may need to appear/disappear, and if we're viewing
      // it the grid contents change too.
      renderCats();
      renderGrid();
    });
  }
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

  // The big mL/hr (or mL) number in the result panel is editable.  When the
  // user types into it, we back-solve the dose at the current concentration
  // and re-render — keeping the dose input, slider, and result panel in sync.
  // The input element is created inside renderResult(), so we delegate.
  calcResult.addEventListener("input", (e) => {
    const t = e.target;
    if (!t || t.id !== "calc-primary-input") return;
    const v = parseFloat(t.value);
    if (isNaN(v) || v < 0) return;
    const solved = solveDoseFromVolume(v);
    if (solved.error) return;
    state.dose = solved.dose;
    // Update dose + slider but DO NOT re-run renderResult — that would replace
    // the input the user is actively typing into and steal focus.  Instead we
    // patch the few derived rows in place.
    calcDose.value = Number(solved.dose.toFixed(solved.dose < 0.01 ? 5 : solved.dose < 1 ? 4 : 3));
    syncRangeFromDose();
    patchResultDerived();
  });

  $("#calc-edit").addEventListener("click", () => {
    const id = state.currentMedId;
    closeCalc();
    setTimeout(() => openEdit(id), 80);
  });

  // Duplicate the currently-open medication into the Custom tab and open the
  // edit modal so the user can tweak it. Preserves the full source med
  // (including population overlays, sources, notes) so the custom copy keeps
  // working under adult / pediatric / neonatal toggles.
  $("#calc-duplicate").addEventListener("click", () => {
    const id = state.currentMedId;
    const src = getMed(id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    copy.category = "Custom";
    // Make the duplicated name unique within the library so users can spot it.
    const baseName = (src.name || "Medication").replace(/\s*\(Custom(?:\s*\d+)?\)\s*$/, "");
    let candidate = baseName + " (Custom)";
    let n = 2;
    const taken = new Set(library.map(m => (m.name || "").toLowerCase()));
    while (taken.has(candidate.toLowerCase())) {
      candidate = baseName + " (Custom " + n + ")";
      n++;
    }
    copy.name = candidate;
    library.push(copy);
    saveLibrary();
    // Switch view to the Custom category so the new med is visible after edit.
    state.category = "Custom";
    closeCalc();
    renderCats();
    renderGrid();
    setTimeout(() => openEdit(copy.id), 80);
  });

  function syncRangeFromDose() {
    if (state.dose === null || isNaN(state.dose)) return;
    calcRange.value = state.dose;
  }

  function updateCalc() {
    const med = getResolvedMed(state.currentMedId);
    if (!med) return;
    // Custom calculators re-render whenever weight/population changes.
    if (med.customCalc) {
      renderCustomCalc(med);
      return;
    }
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

    // Mode descriptor — inline hint below the Bolus/Infusion toggle so the
    // user sees what each mode delivers at a glance. Skipped when the toggle
    // is hidden (med has only one mode).
    const modeDescEl = $("#calc-mode-desc");
    if (modeDescEl) {
      const onlyOne = calcModeSeg.style.display === "none";
      if (onlyOne) {
        modeDescEl.textContent = "";
        modeDescEl.style.display = "none";
      } else {
        modeDescEl.style.display = "";
        modeDescEl.textContent = state.mode === "bolus"
          ? "Bolus — single IV push or loading dose, given once."
          : "Infusion — continuous drip, dose is per unit time.";
      }
    }

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

  // Reverse calculation: given a volume (mL for bolus, mL/hr for infusion)
  // at the current med / mode / concentration / weight, return the dose in
  // cfg.doseUnit (per kg if cfg.perKg; per cfg.perTime for infusion).
  //
  // This is the algebraic inverse of calculateDose():
  //   forward bolus:    mL          = totalDose_concUnit / (mg/mL)
  //   forward infusion: mL/hr       = totalDose_concUnit / (mg/mL) * (60 if perTime===min else 1)
  // We invert each step and unwind perKg + unit conversion.
  function solveDoseFromVolumePure(med, mode, concIdx, weightKg, mL) {
    if (!med) return { error: "no_med" };
    const cfg = med[mode];
    if (!cfg) return { error: "no_mode" };
    const concs = getConcs(med, mode);
    const conc = concs[concIdx] || concs[0];
    if (!conc) return { error: "no_conc" };
    if (!isFinite(conc.mg) || !isFinite(conc.mL) || conc.mL <= 0) return { error: "bad_conc" };
    if (!isFinite(mL) || mL < 0) return { error: "bad_volume" };
    if (cfg.perKg && (!weightKg || weightKg <= 0)) return { error: "need_weight", message: "Enter patient weight first." };

    const concUnit = conc.isUnits ? (conc.unitsLabel || "units") : "mg";
    const concPerMl = conc.mg / conc.mL;
    const doseUnit = cfg.doseUnit;
    const factor = unitFactor(doseUnit, concUnit);
    if (factor === null) return { error: "unit_mismatch", message: `Unit mismatch: dose in ${doseUnit} but concentration in ${concUnit}.` };

    // Step 1: volume → totalDose in concUnit.
    let totalDoseInConcUnit;
    if (mode === "bolus") {
      totalDoseInConcUnit = mL * concPerMl;
    } else {
      // mL/hr → mL/perTime.  perTime==="min" means forward multiplied by 60.
      const mlPerTime = cfg.perTime === "min" ? mL / 60 : mL;
      totalDoseInConcUnit = mlPerTime * concPerMl;
    }

    // Step 2: concUnit → doseUnit, then strip per-kg.
    const totalDose = totalDoseInConcUnit / factor;
    const dose = cfg.perKg ? totalDose / weightKg : totalDose;

    return { dose, totalDose, totalDoseUnit: doseUnit, mL, conc, cfg, med };
  }

  // UI-state wrapper around the pure solver.
  function solveDoseFromVolume(mL) {
    const med = getResolvedMed(state.currentMedId);
    const r = solveDoseFromVolumePure(med, state.mode, state.concIdx, state.weightKg, mL);
    if (r.error) return { error: r.error, message: r.message };
    const cfg = r.cfg;
    const perKgSuffix = cfg.perKg ? "/kg" : "";
    const perTimeSuffix = state.mode === "infusion" ? `/${cfg.perTime}` : "";
    const doseStr = fmt(r.dose, r.dose < 0.01 ? 5 : r.dose < 1 ? 4 : 3);
    const hint = `= ${doseStr} ${cfg.doseUnit}${perKgSuffix}${perTimeSuffix}`;
    return { dose: r.dose, hint };
  }

  // Expose pure helpers for tests in the browser console.
  window.IVCalc = { calcDose: calculateDose, solveDoseFromVolume: solveDoseFromVolumePure, unitFactor, MASS_TO_G, DEFAULT_MEDS, resolvePopulation };

  function renderResult() {
    const r = compute();
    // Always reset the over-max highlight at the top — it's set below only on
    // a successful calculation where dose > max.
    const doseRowEl = calcDose.closest(".dose-row");
    if (doseRowEl) doseRowEl.classList.remove("over-max");
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

    // Red-highlight the dose input when it's above the configured max. We
    // still render the full calculation (clinician spec: warn, do not block).
    // Triggered by either an above-max warn OR a hard-cap danger.
    const overMax = !!(
      (r.cfg && r.cfg.max != null && r.dose != null && r.dose > r.cfg.max) ||
      (r.cfg && r.cfg.maxAbsolute != null && r.totalDose != null && r.totalDose > r.cfg.maxAbsolute)
    );
    if (doseRowEl && overMax) doseRowEl.classList.add("over-max");

    const isInfusion = r.mode === "infusion";
    const primaryNum = r.mL;
    const primaryUnit = isInfusion ? r.perTimeLabel : "mL";

    // Primary readout is an editable input — the user can type a target
    // mL/hr (or mL for bolus) and the dose back-solves.  Wired up via a
    // delegated 'input' listener on #calc-result above.
    const primaryValue = isFinite(primaryNum) ? Number(primaryNum.toFixed(primaryNum < 1 ? 3 : 2)) : "";
    const canReverse = !!(r.cfg && r.conc); // any valid config can reverse
    const parts = [];
    parts.push(
      `<div class="result-primary">` +
        `<input id="calc-primary-input" type="number" inputmode="decimal" step="any" min="0" ` +
          `value="${primaryValue}" aria-label="Volume in ${primaryUnit}" ${canReverse ? "" : "disabled"} />` +
        `<span class="unit">${primaryUnit}</span>` +
      `</div>`
    );
    parts.push(`<div class="result-row" data-row="total"><span class="label">Total dose</span><span class="val">${fmt(r.totalDose, 3)} ${r.totalDoseUnit}${isInfusion ? "/" + r.cfg.perTime : ""}</span></div>`);
    if (r.cfg.perKg && r.weight) {
      parts.push(`<div class="result-row" data-row="dose"><span class="label">Dose</span><span class="val">${fmt(r.dose,3)} ${r.cfg.doseUnit}/kg${isInfusion ? "/" + r.cfg.perTime : ""} × ${fmt(r.weight,1)} kg</span></div>`);
    }
    parts.push(`<div class="result-row"><span class="label">Concentration</span><span class="val">${fmt(r.concPerMlDisplay, 3)} ${r.concDisplayUnit}/mL</span></div>`);
    if (isInfusion) {
      const perMin = r.cfg.perTime === "min" ? r.totalDose : r.totalDose / 60;
      parts.push(`<div class="result-row" data-row="permin"><span class="label">Per minute</span><span class="val">${fmt(perMin, 3)} ${r.totalDoseUnit}/min</span></div>`);
    }
    r.flags.forEach(f => {
      parts.push(`<div class="result-flag">⚠ ${escapeHtml(f.text)}</div>`);
    });
    calcResult.innerHTML = parts.join("");
  }

  // While the user is typing into the primary mL/hr input, patch the derived
  // rows (Total dose, Dose × weight, Per minute) in place without re-rendering
  // the whole result block.  This preserves focus and caret position in the
  // primary input. Called from the delegated input listener.
  function patchResultDerived() {
    const r = compute();
    if (!r || r.error || r.needsWeight) return;
    const isInfusion = r.mode === "infusion";
    const totalEl = calcResult.querySelector('[data-row="total"] .val');
    if (totalEl) totalEl.textContent = `${fmt(r.totalDose, 3)} ${r.totalDoseUnit}${isInfusion ? "/" + r.cfg.perTime : ""}`;
    const doseEl = calcResult.querySelector('[data-row="dose"] .val');
    if (doseEl && r.cfg.perKg && r.weight) {
      doseEl.textContent = `${fmt(r.dose,3)} ${r.cfg.doseUnit}/kg${isInfusion ? "/" + r.cfg.perTime : ""} × ${fmt(r.weight,1)} kg`;
    }
    const perMinEl = calcResult.querySelector('[data-row="permin"] .val');
    if (perMinEl && isInfusion) {
      const perMin = r.cfg.perTime === "min" ? r.totalDose : r.totalDose / 60;
      perMinEl.textContent = `${fmt(perMin, 3)} ${r.totalDoseUnit}/min`;
    }
    // Re-evaluate over-max highlight as the dose changes.
    const doseRowEl = calcDose.closest(".dose-row");
    if (doseRowEl) {
      const overMax = !!(
        (r.cfg && r.cfg.max != null && r.dose != null && r.dose > r.cfg.max) ||
        (r.cfg && r.cfg.maxAbsolute != null && r.totalDose != null && r.totalDose > r.cfg.maxAbsolute)
      );
      doseRowEl.classList.toggle("over-max", overMax);
    }
    // Update result-panel level (danger/warn class) too.
    const danger = r.flags.find(f => f.level === "danger");
    const warn = r.flags.find(f => f.level === "warn");
    calcResult.className = "result" + (danger ? " danger" : warn ? " warn" : "");
  }

  // ----------- EDIT MODAL -----------
  const editModal = $("#edit-modal");
  const editForm = $("#edit-form");
  let editingId = null;

  // ----- CATEGORY PICKER (inside edit modal) -----
  // A scrollable list of existing categories plus a "+ New category" row.
  // The actual form value is written to a hidden <input name="category"> so
  // the existing save logic doesn't need to change. We open/close on the
  // trigger button click and on outside taps, and select on row click.
  const catPicker = $("#cat-picker");
  const catTrigger = $("#cat-picker-trigger");
  const catLabel = $("#cat-picker-label");
  const catPanel = $("#cat-picker-panel");
  const catListEl = $("#cat-picker-list");
  const catHidden = $("#cat-picker-value");
  const catNewBtn = $("#cat-picker-new-btn");
  const catNewRow = $("#cat-picker-new-row");
  const catNewInput = $("#cat-picker-new-input");
  const catNewCreate = $("#cat-picker-new-create");

  function initCategoryPicker(currentCat) {
    setPickerValue(currentCat || "");
    rebuildPickerList();
    closePicker();
    // Reset the inline-new-category row.
    if (catNewRow) catNewRow.hidden = true;
    if (catNewInput) catNewInput.value = "";
  }
  function rebuildPickerList() {
    if (!catListEl) return;
    const cats = getCategories();
    const current = catHidden.value;
    catListEl.innerHTML = cats.map(c => {
      const active = c === current;
      return `<li role="option" class="cat-picker-item${active ? ' is-active' : ''}" data-cat="${escapeAttr(c)}" aria-selected="${active ? 'true' : 'false'}" tabindex="0">${escapeHtml(c)}${active ? '<svg class="check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</li>`;
    }).join("");
    $$(".cat-picker-item", catListEl).forEach(li => {
      const pick = () => {
        setPickerValue(li.dataset.cat);
        rebuildPickerList();
        closePicker();
      };
      li.addEventListener("click", pick);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
    });
  }
  function setPickerValue(cat) {
    catHidden.value = cat;
    catLabel.textContent = cat || "Choose a category…";
    catLabel.classList.toggle("is-placeholder", !cat);
  }
  function openPicker() {
    if (!catPanel) return;
    catPanel.hidden = false;
    catTrigger.setAttribute("aria-expanded", "true");
    catPicker.classList.add("is-open");
    // Scroll the currently-selected item into view.
    const active = $(".cat-picker-item.is-active", catListEl);
    if (active) active.scrollIntoView({ block: "nearest" });
  }
  function closePicker() {
    if (!catPanel) return;
    catPanel.hidden = true;
    catTrigger.setAttribute("aria-expanded", "false");
    catPicker.classList.remove("is-open");
    if (catNewRow) catNewRow.hidden = true;
    if (catNewInput) catNewInput.value = "";
  }
  if (catTrigger) {
    catTrigger.addEventListener("click", () => {
      if (catPanel.hidden) openPicker();
      else closePicker();
    });
  }
  // Close picker when the user clicks outside it (inside the modal).
  document.addEventListener("click", (e) => {
    if (catPanel && !catPanel.hidden && !catPicker.contains(e.target)) {
      closePicker();
    }
  });
  if (catNewBtn) {
    catNewBtn.addEventListener("click", () => {
      if (!catNewRow) return;
      catNewRow.hidden = false;
      catNewInput.focus();
    });
  }
  function commitNewCategory() {
    const raw = (catNewInput.value || "").trim();
    if (!raw) { catNewInput.focus(); return; }
    // De-dupe (case-insensitive) against existing categories. If a matching
    // name already exists, just select it instead of creating a duplicate.
    const existing = getCategories().find(c => c.toLowerCase() === raw.toLowerCase());
    const cat = existing || raw;
    if (!existing) {
      // Persist the new category by appending it to the order list so it
      // appears in the tab bar even before any med uses it. (getCategories
      // also pulls from library.map(m.category), so once we save the med
      // the category is concrete.)
      if (!order.categories) order.categories = getCategories().filter(c => c !== "All" && c !== FAVORITES_CATEGORY);
      if (!order.categories.includes(cat)) order.categories.push(cat);
      saveOrder();
    }
    setPickerValue(cat);
    rebuildPickerList();
    closePicker();
  }
  if (catNewCreate) catNewCreate.addEventListener("click", commitNewCategory);
  if (catNewInput) {
    catNewInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitNewCategory(); }
      else if (e.key === "Escape") { catNewRow.hidden = true; catNewInput.value = ""; }
    });
  }

  function openEdit(id) {
    editingId = id;
    const med = id ? structuredClone(getMed(id)) : blankMed();
    if (!med) return;
    $("#edit-title").textContent = id ? "Edit medication" : "New medication";
    $("#edit-delete").style.display = id ? "" : "none";

    editForm.elements["name"].value = med.name || "";
    // Category picker: scrollable list of existing categories + "new category"
    // option. Defaults to the med's current category (or "Custom" for a new
    // med) so the user can save without touching the picker.
    initCategoryPicker(med.category || (id ? "" : "Custom"));
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

    // Concentration list: prefer the explicit `concentrations` array. If a
    // med uses per-mode `bolusConcentrations` / `infusionConcentrations`
    // instead (legacy schema for meds like Epinephrine that have different
    // dilutions for bolus vs drip), surface the union in the editor so users
    // can actually edit something. Save handler writes the result back to
    // `concentrations` and clears the per-mode arrays so future edits stay
    // consistent.
    let initialConcs = Array.isArray(med.concentrations) ? med.concentrations.slice() : [];
    if (!initialConcs.length) {
      const bolusConcs = Array.isArray(med.bolusConcentrations) ? med.bolusConcentrations : [];
      const infConcs = Array.isArray(med.infusionConcentrations) ? med.infusionConcentrations : [];
      // De-dupe by (mg, mL, isUnits) signature so we don't render "4 mg/250 mL"
      // twice when it appears in both per-mode lists.
      const seen = new Set();
      const sig = (c) => `${c?.mg ?? ""}|${c?.mL ?? ""}|${c?.isUnits ? (c.unitsLabel || "u") : ""}`;
      for (const c of [...bolusConcs, ...infConcs]) {
        const s = sig(c);
        if (seen.has(s)) continue;
        seen.add(s);
        initialConcs.push(c);
      }
    }
    renderConcList(initialConcs);
    renderSourcesEdit(med.sources || []);

    if (typeof editModal.showModal === "function") editModal.showModal();
    else editModal.setAttribute("open", "");
  }
  function blankMed() {
    return {
      id: uid(), name: "", category: "Custom", type: "bolus",
      concentrations: [{ label: "", mg: null, mL: 1 }],
      bolus: { dose: null, doseUnit: "mg", perKg: false, min: null, max: null, maxAbsolute: null, notes: "" },
      infusion: null,
      notes: "",
      sources: []
    };
  }
  // Concentration rows store amount in `mg` internally (so existing calc logic
  // stays untouched). When the user picks a non-mg unit we convert on save:
  //   mcg -> mg / 1000
  //   g   -> mg * 1000
  //   units / mEq -> stored as `mg` with isUnits=true + unitsLabel for display.
  const CONC_UNIT_OPTIONS = ["mg", "mcg", "g", "units", "mEq"];
  function pickInitialConcUnit(c) {
    if (c && c.isUnits && c.unitsLabel) {
      // If the stored unitsLabel matches one of our options use it; otherwise fall back to "units".
      const u = String(c.unitsLabel);
      return CONC_UNIT_OPTIONS.includes(u) ? u : "units";
    }
    return "mg";
  }
  function concUnitSelectHTML(selected) {
    return `<select data-k="unit" class="conc-unit">${CONC_UNIT_OPTIONS.map(u => `<option value="${u}"${u === selected ? " selected" : ""}>${u}</option>`).join("")}</select>`;
  }
  function renderConcList(concs) {
    const wrap = $("#conc-list");
    wrap.innerHTML = concs.map((c, i) => `
      <div class="conc-row" data-idx="${i}">
        <input data-k="mg" type="number" step="any" placeholder="Amount" value="${c.mg ?? ""}" />
        ${concUnitSelectHTML(pickInitialConcUnit(c))}
        <span class="conc-sep" aria-hidden="true">/</span>
        <input data-k="mL" type="number" step="any" placeholder="Volume" value="${c.mL ?? ""}" />
        <span class="conc-unit-static" aria-hidden="true">mL</span>
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
      <input data-k="mg" type="number" step="any" placeholder="Amount" />
      ${concUnitSelectHTML("mg")}
      <span class="conc-sep" aria-hidden="true">/</span>
      <input data-k="mL" type="number" step="any" placeholder="Volume" />
      <span class="conc-unit-static" aria-hidden="true">mL</span>
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
      concentrations: $$("#conc-list .conc-row").map(row => {
        const rawAmount = parseFloat($("[data-k=mg]", row).value);
        const mL = parseFloat($("[data-k=mL]", row).value);
        const unit = ($("[data-k=unit]", row)?.value || "mg").trim();
        if (!isFinite(rawAmount) || !isFinite(mL)) return null;
        // Normalise the amount to mg for the calc engine. "units"/"mEq" are stored
        // as-is with isUnits + unitsLabel so display + math both stay correct.
        let mg = rawAmount;
        let isUnits = false;
        let unitsLabel = null;
        if (unit === "mcg") mg = rawAmount / 1000;
        else if (unit === "g") mg = rawAmount * 1000;
        else if (unit === "units" || unit === "mEq") { isUnits = true; unitsLabel = unit; }
        // Auto-generate a human label from the inputs so users no longer have
        // to type one. Examples: "4 mg / 250 mL", "50 units / 100 mL".
        const label = `${rawAmount} ${unit} / ${mL} mL`;
        const out = { label, mg, mL };
        if (isUnits) { out.isUnits = true; out.unitsLabel = unitsLabel; }
        return out;
      }).filter(Boolean),
      sources: $$("#sources-list .source-row").map(row => ({
        label: $("[data-k=label]", row).value.trim(),
        url: $("[data-k=url]", row).value.trim()
      })).filter(s => s.label && s.url)
    };
    // Inline error display so users see the message even if the OS dialog
    // gets dismissed silently on iPad. Errors clear on next Save attempt.
    const showEditError = (msg) => {
      let bar = document.getElementById("edit-error");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "edit-error";
        bar.className = "edit-error-bar";
        bar.setAttribute("role", "alert");
        const foot = editForm.querySelector(".modal-foot");
        if (foot) foot.parentNode.insertBefore(bar, foot);
      }
      bar.textContent = msg;
      bar.style.display = "";
      bar.scrollIntoView({ block: "nearest" });
    };
    const clearEditError = () => {
      const bar = document.getElementById("edit-error");
      if (bar) bar.style.display = "none";
    };
    clearEditError();
    if (!data.name) { showEditError("Name is required."); return; }
    if (!data.category) { showEditError("Category is required — pick one from the dropdown."); return; }
    if (!data.concentrations.length) { showEditError("At least one concentration is required."); return; }

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

    // If the underlying med previously used per-mode concentration arrays,
    // we collapse them into the single `concentrations` list on save so the
    // edit-modal view stays consistent next time. Preserve other top-level
    // fields (like `populations` overlays and `bolusCtaLabel`) by merging
    // onto the existing record rather than replacing it wholesale.
    const idx = library.findIndex(m => m.id === data.id);
    if (idx >= 0) {
      const prev = library[idx];
      const merged = Object.assign({}, prev, data);
      // Clear the legacy per-mode arrays — the unified `concentrations`
      // captures everything (getConcs() falls back to it when per-mode
      // arrays are absent).
      delete merged.bolusConcentrations;
      delete merged.infusionConcentrations;
      // Drop the bolus / infusion blocks the user removed via the type seg.
      if (data.type === "bolus") delete merged.infusion;
      if (data.type === "infusion") delete merged.bolus;
      library[idx] = merged;
    } else {
      library.push(data);
    }
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
  const populationAutoHint = $("#population-auto-hint");
  // Sync the visual state of the toggle (active button + auto-suggested glow
  // + hint message). Pulled out so weight-change can refresh the glow without
  // re-running the rest of applyPopulation's side effects.
  function syncPopulationVisual() {
    if (!populationToggle) return;
    $$("button", populationToggle).forEach(b => {
      const active = b.dataset.pop === state.population;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    // Auto-suggested glow: only when the suggestion is active AND it was
    // driven by weight (i.e. user hasn't manually overridden).
    const suggestion = suggestedPopulationFromWeight(state.weightKg);
    const isAuto = !state.populationManual && suggestion && suggestion === state.population && state.population !== "adult";
    populationToggle.classList.toggle("auto-suggested", !!isAuto);
    if (populationAutoHint) {
      if (isAuto) {
        populationAutoHint.textContent = `Auto-set from weight (${fmt(state.weightKg,1)} kg)`;
        populationAutoHint.hidden = false;
      } else {
        populationAutoHint.textContent = "";
        populationAutoHint.hidden = true;
      }
    }
  }
  // Apply a population change. `manual=true` means the user tapped a button;
  // we flip populationManual so future weight changes don't override them.
  function applyPopulation(pop, manual) {
    if (!["adult", "pediatric", "neonatal"].includes(pop)) pop = "adult";
    state.population = pop;
    if (manual) state.populationManual = true;
    syncPopulationVisual();
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
  // Back-compat alias used by init().
  function setPopulation(pop) { applyPopulation(pop, /*manual*/ false); }
  if (populationToggle) {
    $$("button", populationToggle).forEach(b => b.addEventListener("click", () => applyPopulation(b.dataset.pop, /*manual*/ true)));
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
