/* ============================================================
   Medical Diet Selection System G�� script.js
   Fetches food data from /api/foods (Node.js backend)
   ============================================================ */

// G��G��G�� State G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
let FOOD_DB      = [];          // populated from API
let visibleItems = [];          // current filtered view
const selected   = new Map();   // normalised name G�� { food, qty }

// G��G��G�� DOM References G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

// G��G��G�� Helpers G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

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
 * "100g" G�� 100, "1 pc" G�� 1, "30g" G�� 30, "0.5" G�� 0.5
 * Returns null if no number found (e.g. pure text).
 */
function parseQtyNumber(qtyStr) {
  if (!qtyStr) return null;
  const match = String(qtyStr).match(/^(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Split a qty string into { num, unit, step }.
 * "100g"  G�� { num: 100, unit: "g",   step: 10 }
 * "1 pc"  G�� { num: 1,   unit: " pc", step: 1  }
 * "30g"   G�� { num: 30,  unit: "g",   step: 5  }
 * "100ml" G�� { num: 100, unit: "ml",  step: 10 }
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

// G��G��G�� Meal Tab State G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
let activeMeal = "all";
const collapsedMeals = new Set(); // tracks which meal sections are collapsed

const MEAL_ORDER  = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const MEAL_EMOJI  = { Breakfast:"=���", Lunch:"G��n+�", Snacks:"=���", Dinner:"=���" };
const MEAL_BADGE  = { Breakfast:"meal-badge-breakfast", Lunch:"meal-badge-lunch",
                      Snacks:"meal-badge-snacks",       Dinner:"meal-badge-dinner" };

// Wire up meal tabs
document.getElementById("meal-tabs").addEventListener("click", e => {
  const tab = e.target.closest(".meal-tab");
  if (!tab) return;
  document.querySelectorAll(".meal-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  activeMeal = tab.dataset.meal;
  renderTable();
});

// G��G��G�� Render G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

function renderTable() {
  const query     = normalise(searchInput.value);
  const catFilter = categoryFilter.value;

  // Filter by search + category + active meal tab
  visibleItems = FOOD_DB.filter(f => {
    const matchSearch = !query || normalise(f.item).includes(query);
    const matchCat    = !catFilter || f.category === catFilter;
    const matchMeal   = activeMeal === "all" || f.meal === activeMeal;
    return matchSearch && matchCat && matchMeal;
  });

  emptyState.classList.toggle("hidden", visibleItems.length > 0);
  tbody.innerHTML = "";

  if (visibleItems.length === 0) {
    syncMasterCheckbox();
    updateSummary();
    return;
  }

  const fragment = document.createDocumentFragment();

  // Group items by meal
  const groups = {};
  const order  = activeMeal === "all" ? MEAL_ORDER : [activeMeal];

  order.forEach(meal => { groups[meal] = []; });
  visibleItems.forEach(food => {
    const m = food.meal || "Lunch";
    if (!groups[m]) groups[m] = [];
    groups[m].push(food);
  });

  order.forEach(meal => {
    const items = groups[meal];
    if (!items || items.length === 0) return;

    const isCollapsed = collapsedMeals.has(meal);

    // G��G�� Group header row G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
    const groupTr = document.createElement("tr");
    groupTr.className = "meal-group-row";
    groupTr.dataset.meal = meal;

    const groupTd = document.createElement("td");
    groupTd.colSpan = 8;
    groupTd.className = "meal-group-cell";
    groupTd.innerHTML = `
      <span>${MEAL_EMOJI[meal]}</span>
      <span class="meal-group-label">${meal}</span>
      <span class="meal-group-badge ${MEAL_BADGE[meal]}">${items.length} items</span>
      <button class="meal-group-select" data-meal="${meal}">Select All</button>
      <span class="meal-group-chevron ${isCollapsed ? "collapsed" : ""}">G�+</span>
    `;
    groupTr.appendChild(groupTd);

    // Toggle collapse on header click
    groupTr.addEventListener("click", e => {
      if (e.target.closest(".meal-group-select")) return;
      if (collapsedMeals.has(meal)) collapsedMeals.delete(meal);
      else collapsedMeals.add(meal);
      renderTable();
    });

    // Select all in this meal group
    groupTd.querySelector(".meal-group-select").addEventListener("click", e => {
      e.stopPropagation();
      const allSelected = items.every(f => selected.has(normalise(f.item)));
      items.forEach(food => {
        const key = normalise(food.item);
        if (allSelected) selected.delete(key);
        else if (!selected.has(key)) selected.set(key, { food, qty: food.qty || "" });
      });
      renderTable();
    });

    fragment.appendChild(groupTr);

    if (isCollapsed) return; // skip item rows if collapsed

    // G��G�� Item rows G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
    items.forEach(food => {
      const key        = normalise(food.item);
      const isSelected = selected.has(key);
      const qty        = isSelected ? selected.get(key).qty : "";

      const displayQty     = qty || food.qty;
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
            <button class="qty-btn qty-dec" ${!isSelected ? "disabled" : ""} aria-label="Decrease quantity">G��</button>
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

      tr.querySelector(".qty-input").addEventListener("input", e => applyQty(e.target.value));

      tr.querySelector(".qty-inc").addEventListener("click", () => {
        if (!selected.has(key)) return;
        const input  = tr.querySelector(".qty-input");
        const parsed = parseQtyStr(input.value || food.qty);
        const newQty = (parsed.num + parsed.step) + parsed.unit;
        input.value  = newQty;
        applyQty(newQty);
      });

      tr.querySelector(".qty-dec").addEventListener("click", () => {
        if (!selected.has(key)) return;
        const input  = tr.querySelector(".qty-input");
        const parsed = parseQtyStr(input.value || food.qty);
        const newQty = Math.max(0, parsed.num - parsed.step) + parsed.unit;
        input.value  = newQty;
        applyQty(newQty);
      });

      fragment.appendChild(tr);
    });
  });

  tbody.appendChild(fragment);
  syncMasterCheckbox();
  updateSummary();
}

// G��G��G�� Selection Logic G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

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

// G��G��G�� Summary G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

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

// G��G��G�� Master Checkbox G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

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

// G��G��G�� Select All / Clear All G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

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

// G��G��G�� Search & Filter G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

searchInput.addEventListener("input", renderTable);

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  renderTable();
});

categoryFilter.addEventListener("change", renderTable);

// G��G��G�� Excel Export G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

btnExport.addEventListener("click", () => {
  if (selected.size === 0) {
    alert("Please select at least one food item before downloading.");
    return;
  }

  const patientName = document.getElementById("p-name").value.trim();
  const MEAL_ORDER  = ["Breakfast", "Snacks", "Lunch", "Dinner"];
  const groups      = {};
  MEAL_ORDER.forEach(m => { groups[m] = []; });

  selected.forEach(({ food, qty }) => {
    const eq  = qty || food.qty;
    const key = MEAL_ORDER.includes(food.meal) ? food.meal : "Lunch";
    groups[key].push({
      item:     food.item,
      qty:      eq,
      fats:     fmt(scaleValue(food.fats,     food.qty, eq)),
      carbs:    fmt(scaleValue(food.carbs,    food.qty, eq)),
      protein:  fmt(scaleValue(food.protein,  food.qty, eq)),
      calories: Math.round(scaleValue(food.calories, food.qty, eq)),
      _fats:    scaleValue(food.fats,     food.qty, eq),
      _carbs:   scaleValue(food.carbs,    food.qty, eq),
      _protein: scaleValue(food.protein,  food.qty, eq),
      _cal:     scaleValue(food.calories, food.qty, eq),
    });
  });

  const aoa    = [];
  const merges = [];
  aoa.push(["Meal", "Item", "Qty", "Fats (g)", "Carbs (g)", "Protein (g)", "Calories (kcal)"]);

  let tFats = 0, tCarbs = 0, tProtein = 0, tCal = 0;

  MEAL_ORDER.forEach(meal => {
    const items = groups[meal];
    if (!items || items.length === 0) return;

    const startRow = aoa.length;
    const lastIdx  = items.length - 1;

    items.forEach((d, i) => {
      aoa.push([
        i === 0 ? meal : "",   // label on FIRST row so merge shows it correctly
        d.item, d.qty,
        d.fats, d.carbs, d.protein, d.calories,
      ]);
      tFats    += d._fats;
      tCarbs   += d._carbs;
      tProtein += d._protein;
      tCal     += d._cal;
    });

    // Merge meal label column across all rows of this group
    if (items.length > 1) {
      merges.push({ s:{r:startRow,c:0}, e:{r:startRow+lastIdx,c:0} });
    }

    // blank separator between meals
    aoa.push(["", "", "", "", "", "", ""]);
  });

  aoa.push(["TOTAL", "", "", fmt(tFats), fmt(tCarbs), fmt(tProtein), Math.round(tCal)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    {wch:16},{wch:22},{wch:12},{wch:10},{wch:10},{wch:12},{wch:16}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Diet Selection");

  const today    = new Date().toISOString().slice(0, 10);
  const safeName = patientName ? patientName.replace(/\s+/g, "_") : "patient";
  XLSX.writeFile(wb, `diet-report-${safeName}-${today}.xlsx`);
});

// G��G��G�� Add Food Modal G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

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
    meal:     document.getElementById("f-meal"),
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
    meal:     fields.meal.value,
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
    showToast(`G�� "${data.food.item}" added successfully!`, "success");

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

// G��G��G�� Diet Log Sheet export G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
document.getElementById("btn-diet-log").addEventListener("click", e => {
  e.preventDefault();

  // Save patient meta
  const meta = {
    name:  document.getElementById("p-name").value.trim(),
    age:   document.getElementById("p-age").value.trim(),
    phone: document.getElementById("p-phone").value.trim(),
  };
  localStorage.setItem("diet_patient_meta", JSON.stringify(meta));

  // Save selected items with scaled nutrition
  const items = [];
  selected.forEach(({ food, qty }) => {
    const eq = qty || food.qty;
    items.push({
      item:     food.item,
      meal:     food.meal || "Lunch",
      qty:      eq,
      category: food.category,
      fats:     scaleValue(food.fats,     food.qty, eq),
      carbs:    scaleValue(food.carbs,    food.qty, eq),
      protein:  scaleValue(food.protein,  food.qty, eq),
      calories: scaleValue(food.calories, food.qty, eq),
    });
  });
  localStorage.setItem("diet_log_export", JSON.stringify(items));

  window.location.href = "/diet-log.html";
});

// ─── Day-wise Planner ─────────────────────────────────────────

const DAY_PLANS_KEY = "diet_day_plans";
const MEAL_ORDER_DP = ["Breakfast", "Snacks", "Lunch", "Dinner"];

const planDateInput = document.getElementById("plan-date");
planDateInput.value = new Date().toISOString().slice(0, 10);

function loadDayPlans() {
  try { return JSON.parse(localStorage.getItem(DAY_PLANS_KEY)) || []; }
  catch { return []; }
}
function saveDayPlans(plans) {
  localStorage.setItem(DAY_PLANS_KEY, JSON.stringify(plans));
}

function renderDayPlans() {
  const plans = loadDayPlans();
  const list  = document.getElementById("dpp-list");
  const empty = document.getElementById("dpp-empty");
  const count = document.getElementById("dpp-count");
  const savedCount = document.getElementById("dsb-saved-count");

  count.textContent = `${plans.length} day${plans.length !== 1 ? "s" : ""}`;
  savedCount.textContent = plans.length > 0
    ? `${plans.length} day${plans.length !== 1 ? "s" : ""} saved`
    : "";

  list.querySelectorAll(".day-card").forEach(c => c.remove());

  if (plans.length === 0) { empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");

  plans.forEach((plan, idx) => {
    const card = document.createElement("div");
    card.className = "day-card";

    const dateLabel = new Date(plan.date + "T00:00:00").toLocaleDateString("en-IN", {
      weekday:"short", day:"2-digit", month:"short", year:"numeric"
    });
    const totalCal = Math.round(plan.items.reduce((s, i) => s + (i.calories || 0), 0));

    const groups = {};
    MEAL_ORDER_DP.forEach(m => { groups[m] = []; });
    plan.items.forEach(i => {
      const k = MEAL_ORDER_DP.includes(i.meal) ? i.meal : "Lunch";
      groups[k].push(i.item);
    });

    const mealHtml = MEAL_ORDER_DP.map(meal => {
      if (!groups[meal].length) return "";
      return `<div class="day-meal-group">
        <div class="day-meal-label">${meal}</div>
        <div class="day-meal-items">
          ${groups[meal].map(n => `<span class="day-item-chip">${n}</span>`).join("")}
        </div>
      </div>`;
    }).join("");

    card.innerHTML = `
      <div class="day-card-header">
        <span class="day-card-date">📅 ${dateLabel}</span>
        <div class="day-card-meta">
          <span>${plan.items.length} items</span>
          <span>${totalCal} kcal</span>
        </div>
        <div class="day-card-actions">
          <button class="btn-day-load" data-idx="${idx}">↩ Load</button>
          <button class="btn-day-delete" data-idx="${idx}" title="Delete">🗑</button>
        </div>
      </div>
      <div class="day-card-body">${mealHtml}</div>
    `;

    card.querySelector(".btn-day-load").addEventListener("click", () => loadDayPlan(idx));
    card.querySelector(".btn-day-delete").addEventListener("click", () => deleteDayPlan(idx));
    list.appendChild(card);
  });
}

document.getElementById("btn-save-day").addEventListener("click", () => {
  const date = planDateInput.value;
  if (!date) { alert("Please pick a date first."); return; }
  if (selected.size === 0) { alert("Please select at least one food item."); return; }

  const plans = loadDayPlans();
  const items = [];
  selected.forEach(({ food, qty }) => {
    const eq = qty || food.qty;
    items.push({
      item: food.item, meal: food.meal || "Lunch", qty: eq, category: food.category,
      fats:     scaleValue(food.fats,     food.qty, eq),
      carbs:    scaleValue(food.carbs,    food.qty, eq),
      protein:  scaleValue(food.protein,  food.qty, eq),
      calories: scaleValue(food.calories, food.qty, eq),
    });
  });

  const existingIdx = plans.findIndex(p => p.date === date);
  if (existingIdx >= 0) {
    if (!confirm(`A plan for ${date} already exists. Replace it?`)) return;
    plans[existingIdx] = { date, items };
  } else {
    plans.push({ date, items });
    plans.sort((a, b) => a.date.localeCompare(b.date));
  }

  saveDayPlans(plans);
  renderDayPlans();

  // Advance date by 1 for next day convenience
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + 1);
  planDateInput.value = next.toISOString().slice(0, 10);

  selected.clear();
  renderTable();
  showToast(`✅ Day plan saved for ${date}`, "success");
});

function loadDayPlan(idx) {
  const plan = loadDayPlans()[idx];
  if (!plan) return;
  planDateInput.value = plan.date;
  selected.clear();
  plan.items.forEach(i => {
    const match = FOOD_DB.find(f => normalise(f.item) === normalise(i.item));
    if (match) selected.set(normalise(match.item), { food: match, qty: i.qty });
  });
  renderTable();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(`↩ Loaded plan for ${plan.date}`, "success");
}

function deleteDayPlan(idx) {
  const plans = loadDayPlans();
  plans.splice(idx, 1);
  saveDayPlans(plans);
  renderDayPlans();
}

document.getElementById("btn-clear-day-plan").addEventListener("click", () => {
  if (!confirm("Delete all day plans?")) return;
  saveDayPlans([]);
  renderDayPlans();
});

document.getElementById("btn-export-days").addEventListener("click", () => {
  const plans = loadDayPlans();
  if (plans.length === 0) { alert("No day plans saved yet."); return; }

  const aoa    = [];
  const merges = [];

  plans.forEach(plan => {
    const dateLabel = new Date(plan.date + "T00:00:00").toLocaleDateString("en-IN", {
      weekday:"long", day:"2-digit", month:"long", year:"numeric"
    });

    const dateRow = aoa.length;
    aoa.push([dateLabel, "", "", "", "", "", ""]);
    merges.push({ s:{r:dateRow,c:0}, e:{r:dateRow,c:6} });
    aoa.push(["Meal", "Item", "Qty", "Fats (g)", "Carbs (g)", "Protein (g)", "Calories (kcal)"]);

    const groups = {};
    MEAL_ORDER_DP.forEach(m => { groups[m] = []; });
    plan.items.forEach(i => {
      const k = MEAL_ORDER_DP.includes(i.meal) ? i.meal : "Lunch";
      groups[k].push(i);
    });

    let dFats = 0, dCarbs = 0, dProtein = 0, dCal = 0;

    MEAL_ORDER_DP.forEach(meal => {
      const items = groups[meal];
      if (!items.length) return;
      const startRow = aoa.length;
      const lastIdx  = items.length - 1;
      items.forEach((d, i) => {
        aoa.push([
          i === 0 ? meal : "",   // label on FIRST row — merge reads from first cell
          d.item, d.qty,
          fmt(d.fats), fmt(d.carbs), fmt(d.protein), Math.round(d.calories),
        ]);
        dFats += d.fats; dCarbs += d.carbs; dProtein += d.protein; dCal += d.calories;
      });
      // Merge meal label column across all rows of this group
      if (items.length > 1) merges.push({ s:{r:startRow,c:0}, e:{r:startRow+lastIdx,c:0} });
    });

    aoa.push(["TOTAL","","", fmt(dFats), fmt(dCarbs), fmt(dProtein), Math.round(dCal)]);
    aoa.push(["","","","","","",""]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"]   = [{wch:22},{wch:22},{wch:12},{wch:10},{wch:10},{wch:12},{wch:16}];
  ws["!sheetViews"] = [{ showGridLines: false }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Day Plans");
  const name  = (document.getElementById("p-name")?.value || "patient").replace(/\s+/g,"_");
  const today = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `day-plan-${name}-${today}.xlsx`);

  // Reset all saved day plans after download
  saveDayPlans([]);
  renderDayPlans();
  showToast("✅ Downloaded! Day plans have been reset for next use.", "success");
});

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
        ${record.patient.age   ? `<span>=��� ${record.patient.age} yrs</span>` : ""}
        ${record.patient.phone ? `<span>=��P ${record.patient.phone}</span>` : ""}
        <span>=��� ${new Date(record.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</span>
      </div>
      <div class="hcard-pills">
        <span class="hcard-pill fats">${fmt(record.totals.fats)}g Fat</span>
        <span class="hcard-pill carbs">${fmt(record.totals.carbs)}g Carbs</span>
        <span class="hcard-pill protein">${fmt(record.totals.protein)}g Protein</span>
        <span class="hcard-pill cal">${Math.round(record.totals.calories)} kcal</span>
      </div>
      <div class="hcard-footer">
        <span class="hcard-items">${record.items.length} item${record.items.length !== 1 ? "s" : ""} selected</span>
        <button class="hcard-delete" data-id="${record.id}" title="Delete record" aria-label="Delete record">=���</button>
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
  showToast(`G�� Report saved for ${patientName}`, "success");
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

// G��G�� History View Modal G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

let activeHistoryRecord = null;

function openHistoryModal(record) {
  activeHistoryRecord = record;
  const body = document.getElementById("history-modal-body");

  const p = record.patient;
  body.innerHTML = `
    <div class="hview-patient">
      <div class="hview-patient-row">
        <span class="hview-label">Patient Name</span>
        <span class="hview-value">${p.name || "G��"}</span>
      </div>
      <div class="hview-patient-row">
        <span class="hview-label">Age</span>
        <span class="hview-value">${p.age ? p.age + " years" : "G��"}</span>
      </div>
      <div class="hview-patient-row">
        <span class="hview-label">Phone</span>
        <span class="hview-value">${p.phone || "G��"}</span>
      </div>
      <div class="hview-patient-row">
        <span class="hview-label">Date</span>
        <span class="hview-value">${new Date(record.date).toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })}</span>
      </div>
      <div class="hview-patient-row full">
        <span class="hview-label">Address</span>
        <span class="hview-value">${p.address || "G��"}</span>
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
  showToast(`G� Loaded report for ${p.name}`, "success");
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
  rows.push(["Patient Name", p.name  || "G��"]);
  rows.push(["Age",          p.age   ? p.age + " years" : "G��"]);
  rows.push(["Phone Number", p.phone || "G��"]);
  rows.push(["Address",      p.address || "G��"]);
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

// G��G��G�� Init: fetch food data from backend API G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

async function init() {
  // Show loading state
  emptyState.classList.add("hidden");
  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center;padding:2.5rem;color:#64748b;font-size:.95rem;">
        GŦ Loading food data...
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
    renderDayPlans();
  } catch (err) {
    console.error("Failed to load food data:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:2.5rem;color:#dc2626;font-size:.95rem;">
          G�� Failed to load food data: ${err.message}
        </td>
      </tr>`;
  }
}

init();
