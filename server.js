const express = require("express");
const path    = require("path");
const fs      = require("fs");

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data", "foods.json");

// ── Helpers ───────────────────────────────────────────────────

/** Read foods from JSON file (always fresh, no require cache issues) */
function readFoods() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch (e) {
    console.error("Failed to read foods.json:", e.message);
    return [];
  }
}

/** Write foods array back to JSON file */
function writeFoods(foods) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(foods, null, 2), "utf8");
}

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());

// ── API Routes (must be before static + catch-all) ────────────

// GET /api/foods — return the food database as JSON
app.get("/api/foods", (req, res) => {
  const foods = readFoods();
  res.json(foods);
});

// POST /api/foods — add a new food item and persist
app.post("/api/foods", (req, res) => {
  const { item, qty, category, fats, carbs, protein, calories } = req.body;

  // Validate required fields
  if (!item || !qty || !category || fats == null || carbs == null || protein == null || calories == null) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const validCategories = ["Veg", "Non-Veg", "Beverage", "Dessert"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Invalid category." });
  }

  const foods = readFoods();

  // Check for duplicate (case-insensitive)
  const exists = foods.some(f => f.item.trim().toLowerCase() === item.trim().toLowerCase());
  if (exists) {
    return res.status(409).json({ error: `"${item}" already exists in the database.` });
  }

  const newFood = {
    item:     item.trim(),
    qty:      qty.trim(),
    category,
    fats:     parseFloat(fats),
    carbs:    parseFloat(carbs),
    protein:  parseFloat(protein),
    calories: parseFloat(calories),
  };

  foods.push(newFood);
  writeFoods(foods);

  res.status(201).json({ message: "Food item added successfully.", food: newFood });
});

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Catch-all: serve index.html ───────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
