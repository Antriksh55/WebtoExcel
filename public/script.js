/* ============================================================
   Medical Diet Selection System — script.js
   Fetches food data from /api/foods (Node.js backend)
   ============================================================ */

// ─── State ────────────────────────────────────────────────────
let FOOD_DB      = [];          // populated from API
let visibleItems = [];          // current filtered view
const selected   = new Map();   // normalised name → { food, qty }

// ─── DOM References ───────────────────────────────────────────
const searchInput      = document.getElementById("search-input");
const clearSearchBtn   = document.getElementById("clear-search");
const categoryFilter   = document.getElementById("category-filter");
const masterCheckbox   = document.getElementById("master-checkbox");
const tbody            = document.getElementById("food-tbody");
const emptyState       = document.getElementById("empty-state");
const btnSelectAll     = document.getElementById("btn-select-all");
const btnClearAll      = document.getElementById("btn-clear-all");
const btnExport        = document.getElementById("btn-export");
const countSelected    = document.getElementById("count-selected");
const countCalories    = document.getElementById("count-calories");
const summaryText      = document.getElementById("summary-text");
const summaryNutrients = document.getElementById("summary-nutrients");

// ─── Helpers ──────────────────────────────────────────────────

function normalise(str) {
  return str.trim().toLowerCase();
}

function badgeClass(cat) {
  switch (cat) {
    case "Veg":      return "badge-veg";
    case "Non-Veg":  return "badge-nonveg";
    case "Beverage": return "badge-bev";
    case "Dessert":  return "badge-dessert";
    default:         return "";
  }
}

function fmt(n) {
  return Number.isInteger(n) ? n : parseFloat(n).toFixed(1);
}

/**
 * Extract the leading numeric value from a qty string.
 * "100g" → 100, "1 pc" → 1, "30g" → 30, "0.5" → 0.5
 * Returns null if no number found (e.g. pure text).
 */
function parseQtyNumber(qtyStr) {
  if (!qtyStr) return null;
  const match = String(qtyStr).match(/^(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Split a qty string into { num, unit, step }.
 * "100g"  → { num: 100, unit: "g",   step: 10 }
 * "1 pc"  → { num: 1,   unit: " pc", step: 1  }
 * "30g"   → { num: 30,  unit: "g",   step: 5  }
 * "100ml" → { num: 100, unit: "ml",  step: 10 }
 */
function parseQtyStr(qtyStr) {
  const s     = String(qtyStr || "0");
  const match = s.match(/^(\d+(\.\d+)?)(.*)/);
  if (!match) return { num: 0, unit: "", step: 1 };
  const num  = parseFloat(match[1]);
  const unit = match[3] || "";
  // Choose a sensible step based on unit and magnitude
  let step = 1;
  const u = unit.trim().toLowerCase();
  if (u === "g" || u === "ml") {
    step = num >= 100 ? 10 : num >= 30 ? 5 : 1;
  }
  return { num, unit, step };
}

/**
 * Calculate scaled nutrition value.
 * defaultQty: original qty string from DB (e.g. "100g")
 * currentQty: user-entered qty string (e.g. "200g")
 * baseValue:  nutrition value at defaultQty
 */
function scaleValue(baseValue, defaultQtyStr, currentQtyStr) {
  const base    = parseQtyNumber(defaultQtyStr);
  const current = parseQtyNumber(currentQtyStr);
  if (!base || !current || base === 0) return baseValue;
  return (baseValue / base) * current;
}

// ─── Render ───────────────────────────────────────────────────

function renderTable() {
  const query     = normalise(searchInput.value);
  const catFilter = categoryFilter.value;

  visibleItems = FOOD_DB.filter(f => {
    const matchSearch = !query || normalise(f.item).includes(query);
    const matchCat    = !catFilter || f.category === catFilter;
    return matchSearch && matchCat;
  });

  emptyState.classList.toggle("hidden", visibleItems.length > 0);

  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();

  visibleItems.forEach(food => {
    const key        = normalise(food.item);
    const isSelected = selected.has(key);
    // Use user-edited qty if selected, otherwise show default as placeholder value
    const qty        = isSelected ? selected.get(key).qty : "";

    // Calculate scaled nutrition based on current qty
    const displayQty = qty || food.qty;
    const scaledFats     = scaleValue(food.fats,     food.qty, displayQty);
    const scaledCarbs    = scaleValue(food.carbs,    food.qty, displayQty);
    const scaledProtein  = scaleValue(food.protein,  food.qty, displayQty);
    const scaledCalories = scaleValue(food.calories, food.qty, displayQty);

    const tr = document.createElement("tr");
    if (isSelected) tr.classList.add("selected");
    tr.dataset.key = key;

    tr.innerHTML = `
      <td style="text-align:center">
        <input type="checkbox" class="row-checkbox" aria-label="Select ${food.item}"
          ${isSelected ? "checked" : ""} />
      </td>
      <td class="item-name">${food.item}</td>
      <td><span class="badge ${badgeClass(food.category)}">${food.category}</span></td>
      <td class="num-cell" data-field="fats">${fmt(scaledFats)}</td>
      <td class="num-cell" data-field="carbs">${fmt(scaledCarbs)}</td>
      <td class="num-cell" data-field="protein">${fmt(scaledProtein)}</td>
      <td class="num-cell" data-field="calories">${fmt(scaledCalories)}</td>
      <td>
        <div class="qty-wrap ${!isSelected ? "qty-disabled" : ""}">
          <button class="qty-btn qty-dec" ${!isSelected ? "disabled" : ""} aria-label="Decrease quantity">−</button>
          <input type="text" class="qty-input" placeholder="${food.qty || 'e.g. 100g'}"
            value="${qty}" ${!isSelected ? "disabled" : ""}
            aria-label="Quantity for ${food.item}" />
          <button class="qty-btn qty-inc" ${!isSelected ? "disabled" : ""} aria-label="Increase quantity">+</button>
        </div>
      </td>
    `;

    tr.querySelector(".row-checkbox").addEventListener("change", e => {
      toggleRow(key, food, e.target.checked, tr);
    });

    // Helper: update nutrition cells from a qty string
    function applyQty(newQty) {
      if (!selected.has(key)) return;
      selected.get(key).qty = newQty;
      const effectiveQty = newQty || food.qty;
      tr.querySelector('[data-field="fats"]').textContent     = fmt(scaleValue(food.fats,     food.qty, effectiveQty));
      tr.querySelector('[data-field="carbs"]').textContent    = fmt(scaleValue(food.carbs,    food.qty, effectiveQty));
      tr.querySelector('[data-field="protein"]').textContent  = fmt(scaleValue(food.protein,  food.qty, effectiveQty));
      tr.querySelector('[data-field="calories"]').textContent = fmt(scaleValue(food.calories, food.qty, effectiveQty));
      updateSummary();
    }

    tr.querySelector(".qty-input").addEventListener("input", e => {
      applyQty(e.target.value);
    });

    // Increment button
    tr.querySelector(".qty-inc").addEventListener("click", () => {
      if (!selected.has(key)) return;
      const input  = tr.querySelector(".qty-input");
      const parsed = parseQtyStr(input.value || food.qty);
      const newNum = parsed.num + parsed.step;
      const newQty = newNum + parsed.unit;
      input.value  = newQty;
      applyQty(newQty);
    });

    // Decrement button
    tr.querySelector(".qty-dec").addEventListener("click", () => {
      if (!selected.has(key)) return;
      const input  = tr.querySelector(".qty-input");
      const parsed = parseQtyStr(input.value || food.qty);
      const newNum = Math.max(0, parsed.num - parsed.step);
      const newQty = newNum + parsed.unit;
      input.value  = newQty;
      applyQty(newQty);
    });

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  syncMasterCheckbox();
  updateSummary();
}

// ─── Selection Logic ──────────────────────────────────────────

function toggleRow(key, food, checked, tr) {
  if (checked) {
    if (!selected.has(key)) selected.set(key, { food, qty: food.qty || "" });
    tr.classList.add("selected");
  } else {
    selected.delete(key);
    tr.classList.remove("selected");
  }

  const qtyInput = tr.querySelector(".qty-input");
  const qtyWrap  = tr.querySelector(".qty-wrap");
  const decBtn   = tr.querySelector(".qty-dec");
  const incBtn   = tr.querySelector(".qty-inc");

  qtyInput.disabled = !checked;
  if (decBtn) decBtn.disabled = !checked;
  if (incBtn) incBtn.disabled = !checked;
  if (qtyWrap) qtyWrap.classList.toggle("qty-disabled", !checked);
  if (!checked) qtyInput.value = "";

  syncMasterCheckbox();
  updateSummary();
}

function syncMasterCheckbox() {
  if (visibleItems.length === 0) {
    masterCheckbox.checked = masterCheckbox.indeterminate = false;
    return;
  }
  const visibleSelected = visibleItems.filter(f => selected.has(normalise(f.item)));
  if (visibleSelected.length === 0) {
    masterCheckbox.checked = masterCheckbox.indeterminate = false;
  } else if (visibleSelected.length === visibleItems.length) {
    masterCheckbox.checked       = true;
    masterCheckbox.indeterminate = false;
  } else {
    masterCheckbox.checked       = false;
    masterCheckbox.indeterminate = true;
  }
}

// ─── Summary ──────────────────────────────────────────────────

function updateSummary() {
  const count = selected.size;
  countSelected.textContent = count;

  let totalFats = 0, totalCarbs = 0, totalProtein = 0, totalCal = 0;
  selected.forEach(({ food, qty }) => {
    // Scale nutrition by current qty vs default qty
    const effectiveQty = qty || food.qty;
    totalFats    += scaleValue(food.fats,     food.qty, effectiveQty);
    totalCarbs   += scaleValue(food.carbs,    food.qty, effectiveQty);
    totalProtein += scaleValue(food.protein,  food.qty, effectiveQty);
    totalCal     += scaleValue(food.calories, food.qty, effectiveQty);
  });

  countCalories.textContent = Math.round(totalCal);

  if (count === 0) {
    summaryText.textContent    = "No items selected";
    summaryNutrients.innerHTML = "";
    return;
  }

  summaryText.textContent = `${count} item${count > 1 ? "s" : ""} selected`;
  summaryNutrients.innerHTML = `
    <span class="nutrient-pill fats"><span>${fmt(totalFats)}g</span><span class="pill-label">Fats</span></span>
    <span class="nutrient-pill carbs"><span>${fmt(totalCarbs)}g</span><span class="pill-label">Carbs</span></span>
    <span class="nutrient-pill protein"><span>${fmt(totalProtein)}g</span><span class="pill-label">Protein</span></span>
    <span class="nutrient-pill cal"><span>${Math.round(totalCal)} kcal</span><span class="pill-label">Calories</span></span>
  `;
}

// ─── Master Checkbox ──────────────────────────────────────────

masterCheckbox.addEventListener("change", () => {
  visibleItems.forEach(food => {
    const key = normalise(food.item);
    if (masterCheckbox.checked) {
      if (!selected.has(key)) selected.set(key, { food, qty: food.qty || "" });
    } else {
      selected.delete(key);
    }
  });
  renderTable();
});

// ─── Select All / Clear All ───────────────────────────────────

btnSelectAll.addEventListener("click", () => {
  FOOD_DB.forEach(food => {
    const key = normalise(food.item);
    if (!selected.has(key)) selected.set(key, { food, qty: food.qty || "" });
  });
  renderTable();
});

btnClearAll.addEventListener("click", () => {
  selected.clear();
  renderTable();
});

// ─── Search & Filter ──────────────────────────────────────────

searchInput.addEventListener("input", renderTable);

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  renderTable();
});

categoryFilter.addEventListener("change", renderTable);

// ─── Excel Export ─────────────────────────────────────────────

btnExport.addEventListener("click", () => {
  if (selected.size === 0) {
    alert("Please select at least one food item before downloading.");
    return;
  }

  // ── Patient details ──────────────────────────────────────
  const patientName    = document.getElementById("p-name").value.trim();
  const patientAge     = document.getElementById("p-age").value.trim();
  const patientPhone   = document.getElementById("p-phone").value.trim();
  const patientAddress = document.getElementById("p-address").value.trim();
  const reportDate     = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });

  // ── Build rows ───────────────────────────────────────────
  const rows = [];

  // Patient info header block
  rows.push(["MEDICAL DIET REPORT"]);
  rows.push([]);
  rows.push(["Patient Name",  patientName  || "—"]);
  rows.push(["Age",           patientAge   ? `${patientAge} years` : "—"]);
  rows.push(["Phone Number",  patientPhone || "—"]);
  rows.push(["Address",       patientAddress || "—"]);
  rows.push(["Report Date",   reportDate]);
  rows.push([]); // blank separator row

  // Column headers
  rows.push(["Item", "Qty", "Category", "Fats (g)", "Carbs (g)", "Protein (g)", "Calories (kcal)"]);

  // Food data rows
  selected.forEach(({ food, qty }) => {
    const effectiveQty = qty || food.qty;
    rows.push([
      food.item,
      effectiveQty,
      food.category,
      fmt(scaleValue(food.fats,     food.qty, effectiveQty)),
      fmt(scaleValue(food.carbs,    food.qty, effectiveQty)),
      fmt(scaleValue(food.protein,  food.qty, effectiveQty)),
      Math.round(scaleValue(food.calories, food.qty, effectiveQty)),
    ]);
  });

  // Totals row
  let tFats = 0, tCarbs = 0, tProtein = 0, tCal = 0;
  selected.forEach(({ food, qty }) => {
    const eq = qty || food.qty;
    tFats    += scaleValue(food.fats,     food.qty, eq);
    tCarbs   += scaleValue(food.carbs,    food.qty, eq);
    tProtein += scaleValue(food.protein,  food.qty, eq);
    tCal     += scaleValue(food.calories, food.qty, eq);
  });
  rows.push([]);
  rows.push(["TOTAL", "", "", fmt(tFats), fmt(tCarbs), fmt(tProtein), Math.round(tCal)]);

  // ── Build worksheet ──────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 24 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 },
  ];

  // Merge title cell A1 across columns
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Diet Report");

  const today = new Date().toISOString().slice(0, 10);
  const safeName = patientName ? patientName.replace(/\s+/g, "_") : "patient";
  XLSX.writeFile(wb, `diet-report-${safeName}-${today}.xlsx`);
});

// ─── Add Food Modal ───────────────────────────────────────────

const modalOverlay = document.getElementById("modal-overlay");
const addFoodForm  = document.getElementById("add-food-form");
const formError    = document.getElementById("form-error");
const btnAddFood   = document.getElementById("btn-add-food");
const modalClose   = document.getElementById("modal-close");
const modalCancel  = document.getElementById("modal-cancel");

function openModal() {
  addFoodForm.reset();
  formError.classList.add("hidden");
  // Clear any invalid states
  addFoodForm.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
  modalOverlay.classList.remove("hidden");
  document.getElementById("f-item").focus();
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

btnAddFood.addEventListener("click", openModal);
modalClose.addEventListener("click", closeModal);
modalCancel.addEventListener("click", closeModal);

// Close on backdrop click
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeModal();
});

// Close on Escape key
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

// Form submit
addFoodForm.addEventListener("submit", async e => {
  e.preventDefault();
  formError.classList.add("hidden");

  const fields = {
    item:     document.getElementById("f-item"),
    qty:      document.getElementById("f-qty"),
    category: document.getElementById("f-category"),
    fats:     document.getElementById("f-fats"),
    carbs:    document.getElementById("f-carbs"),
    protein:  document.getElementById("f-protein"),
    calories: document.getElementById("f-calories"),
  };

  // Client-side validation
  let valid = true;
  Object.values(fields).forEach(el => {
    el.classList.remove("invalid");
    if (!el.value.trim()) { el.classList.add("invalid"); valid = false; }
  });

  if (!valid) {
    showFormError("Please fill in all required fields.");
    return;
  }

  const payload = {
    item:     fields.item.value.trim(),
    qty:      fields.qty.value.trim(),
    category: fields.category.value,
    fats:     parseFloat(fields.fats.value),
    carbs:    parseFloat(fields.carbs.value),
    protein:  parseFloat(fields.protein.value),
    calories: parseFloat(fields.calories.value),
  };

  const saveBtn = document.getElementById("btn-save-food");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const res = await fetch("/api/foods", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      showFormError(data.error || "Failed to save item.");
      return;
    }

    // Add to local DB and re-render without full reload
    FOOD_DB.push(data.food);
    closeModal();
    renderTable();
    showToast(`✅ "${data.food.item}" added successfully!`, "success");

  } catch (err) {
    showFormError("Network error. Please try again.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Item";
  }
});

function showFormError(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
}

function showToast(msg, type = "") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─── Patient History ──────────────────────────────────────────

const HISTORY_KEY = "diet_patient_history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(records) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

function renderHistory(filter = "") {
  const records  = loadHistory();
  const list     = document.getElementById("history-list");
  const empty    = document.getElementById("history-empty");
  const countEl  = document.getElementById("history-count");

  const query = filter.trim().toLowerCase();
  const filtered = query
    ? records.filter(r =>
        r.patient.name.toLowerCase().includes(query) ||
        r.patient.phone.toLowerCase().includes(query))
    : records;

  countEl.textContent = `${records.length} record${records.length !== 1 ? "s" : ""}`;

  // Remove existing cards (keep empty state node)
  list.querySelectorAll(".history-card").forEach(c => c.remove());

  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Render newest first
  [...filtered].reverse().forEach(record => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.dataset.id = record.id;

    card.innerHTML = `
      <div class="hcard-name">${record.patient.name || "Unnamed Patient"}</div>
      <div class="hcard-meta">
        ${record.patient.age   ? `<span>🎂 ${record.patient.age} yrs</span>` : ""}
        ${record.patient.phone ? `<span>📞 ${record.patient.phone}</span>` : ""}
        <span>📅 ${new Date(record.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</span>
      </div>
      <div class="hcard-pills">
        <span class="hcard-pill fats">${fmt(record.totals.fats)}g Fat</span>
        <span class="hcard-pill carbs">${fmt(record.totals.carbs)}g Carbs</span>
        <span class="hcard-pill protein">${fmt(record.totals.protein)}g Protein</span>
        <span class="hcard-pill cal">${Math.round(record.totals.calories)} kcal</span>
      </div>
      <div class="hcard-footer">
        <span class="hcard-items">${record.items.length} item${record.items.length !== 1 ? "s" : ""} selected</span>
        <button class="hcard-delete" data-id="${record.id}" title="Delete record" aria-label="Delete record">🗑</button>
      </div>
    `;

    // Open detail view on card click (not delete btn)
    card.addEventListener("click", e => {
      if (e.target.closest(".hcard-delete")) return;
      openHistoryModal(record);
    });

    // Delete button
    card.querySelector(".hcard-delete").addEventListener("click", e => {
      e.stopPropagation();
      deleteHistoryRecord(record.id);
    });

    list.appendChild(card);
  });
}

function deleteHistoryRecord(id) {
  const records = loadHistory().filter(r => r.id !== id);
  saveHistory(records);
  renderHistory(document.getElementById("history-search").value);
}

// Save current form + selection to history
document.getElementById("btn-save-history").addEventListener("click", () => {
  if (selected.size === 0) {
    alert("Please select at least one food item before saving.");
    return;
  }

  const patientName    = document.getElementById("p-name").value.trim();
  const patientAge     = document.getElementById("p-age").value.trim();
  const patientPhone   = document.getElementById("p-phone").value.trim();
  const patientAddress = document.getElementById("p-address").value.trim();

  if (!patientName) {
    alert("Please enter the patient name before saving.");
    document.getElementById("p-name").focus();
    return;
  }

  let tFats = 0, tCarbs = 0, tProtein = 0, tCal = 0;
  const items = [];

  selected.forEach(({ food, qty }) => {
    const eq = qty || food.qty;
    const sf = scaleValue(food.fats,     food.qty, eq);
    const sc = scaleValue(food.carbs,    food.qty, eq);
    const sp = scaleValue(food.protein,  food.qty, eq);
    const sk = scaleValue(food.calories, food.qty, eq);
    tFats    += sf; tCarbs += sc; tProtein += sp; tCal += sk;
    items.push({ item: food.item, qty: eq, category: food.category,
      fats: sf, carbs: sc, protein: sp, calories: sk });
  });

  const record = {
    id:      Date.now().toString(),
    date:    new Date().toISOString(),
    patient: { name: patientName, age: patientAge, phone: patientPhone, address: patientAddress },
    totals:  { fats: tFats, carbs: tCarbs, protein: tProtein, calories: tCal },
    items,
  };

  const records = loadHistory();
  records.push(record);
  saveHistory(records);
  renderHistory(document.getElementById("history-search").value);
  showToast(`✅ Report saved for ${patientName}`, "success");
});

// History search
document.getElementById("history-search").addEventListener("input", e => {
  renderHistory(e.target.value);
});

// Clear all history
document.getElementById("btn-clear-history").addEventListener("click", () => {
  if (!confirm("Delete all patient history records? This cannot be undone.")) return;
  saveHistory([]);
  renderHistory();
});

// ── History View Modal ────────────────────────────────────────

let activeHistoryRecord = null;

function openHistoryModal(record) {
  activeHistoryRecord = record;
  const body = document.getElementById("history-modal-body");

  const p = record.patient;
  body.innerHTML = `
    <div class="hview-patient">
      <div class="hview-patient-row">
        <span class="hview-label">Patient Name</span>
        <span class="hview-value">${p.name || "—"}</span>
      </div>
      <div class="hview-patient-row">
        <span class="hview-label">Age</span>
        <span class="hview-value">${p.age ? p.age + " years" : "—"}</span>
      </div>
      <div class="hview-patient-row">
        <span class="hview-label">Phone</span>
        <span class="hview-value">${p.phone || "—"}</span>
      </div>
      <div class="hview-patient-row">
        <span class="hview-label">Date</span>
        <span class="hview-value">${new Date(record.date).toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })}</span>
      </div>
      <div class="hview-patient-row full">
        <span class="hview-label">Address</span>
        <span class="hview-value">${p.address || "—"}</span>
      </div>
    </div>

    <table class="hview-table">
      <thead>
        <tr>
          <th>Item</th><th>Qty</th><th>Category</th>
          <th style="text-align:right">Fats (g)</th>
          <th style="text-align:right">Carbs (g)</th>
          <th style="text-align:right">Protein (g)</th>
          <th style="text-align:right">Calories</th>
        </tr>
      </thead>
      <tbody>
        ${record.items.map(i => `
          <tr>
            <td>${i.item}</td>
            <td>${i.qty}</td>
            <td>${i.category}</td>
            <td class="td-num">${fmt(i.fats)}</td>
            <td class="td-num">${fmt(i.carbs)}</td>
            <td class="td-num">${fmt(i.protein)}</td>
            <td class="td-num">${Math.round(i.calories)}</td>
          </tr>`).join("")}
        <tr class="hview-totals">
          <td colspan="3">TOTAL</td>
          <td class="td-num">${fmt(record.totals.fats)}</td>
          <td class="td-num">${fmt(record.totals.carbs)}</td>
          <td class="td-num">${fmt(record.totals.protein)}</td>
          <td class="td-num">${Math.round(record.totals.calories)}</td>
        </tr>
      </tbody>
    </table>
  `;

  document.getElementById("history-modal-overlay").classList.remove("hidden");
}

function closeHistoryModal() {
  document.getElementById("history-modal-overlay").classList.add("hidden");
  activeHistoryRecord = null;
}

document.getElementById("history-modal-close").addEventListener("click",  closeHistoryModal);
document.getElementById("history-modal-cancel").addEventListener("click", closeHistoryModal);
document.getElementById("history-modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("history-modal-overlay")) closeHistoryModal();
});

// Load into form
document.getElementById("history-modal-reload").addEventListener("click", () => {
  if (!activeHistoryRecord) return;
  const p = activeHistoryRecord.patient;
  document.getElementById("p-name").value    = p.name    || "";
  document.getElementById("p-age").value     = p.age     || "";
  document.getElementById("p-phone").value   = p.phone   || "";
  document.getElementById("p-address").value = p.address || "";

  // Restore selections
  selected.clear();
  activeHistoryRecord.items.forEach(i => {
    const match = FOOD_DB.find(f => f.item.toLowerCase() === i.item.toLowerCase());
    if (match) selected.set(normalise(match.item), { food: match, qty: i.qty });
  });

  closeHistoryModal();
  renderTable();
  showToast(`↩ Loaded report for ${p.name}`, "success");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Export from history modal
document.getElementById("history-modal-export").addEventListener("click", () => {
  if (!activeHistoryRecord) return;
  const r = activeHistoryRecord;
  const p = r.patient;

  const rows = [];
  rows.push(["MEDICAL DIET REPORT"]);
  rows.push([]);
  rows.push(["Patient Name", p.name  || "—"]);
  rows.push(["Age",          p.age   ? p.age + " years" : "—"]);
  rows.push(["Phone Number", p.phone || "—"]);
  rows.push(["Address",      p.address || "—"]);
  rows.push(["Report Date",  new Date(r.date).toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })]);
  rows.push([]);
  rows.push(["Item","Qty","Category","Fats (g)","Carbs (g)","Protein (g)","Calories (kcal)"]);
  r.items.forEach(i => rows.push([i.item, i.qty, i.category, fmt(i.fats), fmt(i.carbs), fmt(i.protein), Math.round(i.calories)]));
  rows.push([]);
  rows.push(["TOTAL","","", fmt(r.totals.fats), fmt(r.totals.carbs), fmt(r.totals.protein), Math.round(r.totals.calories)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch:24 },{ wch:12 },{ wch:12 },{ wch:10 },{ wch:10 },{ wch:12 },{ wch:16 }];
  ws["!merges"] = [{ s:{ r:0,c:0 }, e:{ r:0,c:6 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Diet Report");
  const safeName = (p.name || "patient").replace(/\s+/g, "_");
  const date = new Date(r.date).toISOString().slice(0,10);
  XLSX.writeFile(wb, `diet-report-${safeName}-${date}.xlsx`);
});

// ─── Init: fetch food data from backend API ───────────────────

async function init() {
  // Show loading state
  emptyState.classList.add("hidden");
  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center;padding:2.5rem;color:#64748b;font-size:.95rem;">
        ⏳ Loading food data...
      </td>
    </tr>`;

  try {
    const res = await fetch("/api/foods");
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    FOOD_DB = await res.json();

    if (!Array.isArray(FOOD_DB) || FOOD_DB.length === 0) {
      throw new Error("Empty or invalid data received from server.");
    }

    renderTable();
    renderHistory();
  } catch (err) {
    console.error("Failed to load food data:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:2.5rem;color:#dc2626;font-size:.95rem;">
          ❌ Failed to load food data: ${err.message}
        </td>
      </tr>`;
  }
}

init();
