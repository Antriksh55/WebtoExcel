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
    <span class="nutrient-pill"><span>${fmt(totalFats)}g</span><span class="pill-label">Fats</span></span>
    <span class="nutrient-pill"><span>${fmt(totalCarbs)}g</span><span class="pill-label">Carbs</span></span>
    <span class="nutrient-pill"><span>${fmt(totalProtein)}g</span><span class="pill-label">Protein</span></span>
    <span class="nutrient-pill"><span>${Math.round(totalCal)} kcal</span><span class="pill-label">Calories</span></span>
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

  const rows = [["Item", "Qty", "Category", "Fats (g)", "Carbs (g)", "Protein (g)", "Calories (kcal)"]];

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

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Diet Selection");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `diet-selection-${today}.xlsx`);
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
