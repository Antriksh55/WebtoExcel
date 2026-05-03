const express = require("express");
const path    = require("path");
const fs      = require("fs");

const app       = express();
const PORT      = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data", "foods.json");

// ── Vercel read-only filesystem detection ─────────────────────
// On Vercel, __dirname is /var/task (read-only). Writes are not
// persisted across requests. For production persistence, replace
// writeFoods() with a database (MongoDB, PlanetScale, etc.)
const IS_READONLY = process.env.VERCEL === "1";

// ── In-memory store (used on Vercel to support POST in-session) 
let memoryFoods = null;

// ── Helpers ───────────────────────────────────────────────────

function readFoods() {
  // Use in-memory store if already loaded (Vercel session)
  if (memoryFoods) return memoryFoods;
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    memoryFoods = data;
    return data;
  } catch (e) {
    console.error("Failed to read foods.json:", e.message);
    memoryFoods = [];
    return [];
  }
}

function writeFoods(foods) {
  memoryFoods = foods; // always update memory
  if (IS_READONLY) return; // skip disk write on Vercel
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(foods, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write foods.json:", e.message);
  }
}

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────

// GET /api/foods
app.get("/api/foods", (req, res) => {
  res.json(readFoods());
});

// POST /api/foods
app.post("/api/foods", (req, res) => {
  const { item, qty, meal, category, fats, carbs, protein, calories } = req.body;

  if (!item || !qty || !meal || !category || fats == null || carbs == null || protein == null || calories == null) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const validCategories = ["Veg", "Non-Veg", "Beverage", "Dessert"];
  const validMeals      = ["Breakfast", "Lunch", "Snacks", "Dinner"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Invalid category." });
  }
  if (!validMeals.includes(meal)) {
    return res.status(400).json({ error: "Invalid meal section." });
  }

  const foods = readFoods();

  const exists = foods.some(f => f.item.trim().toLowerCase() === item.trim().toLowerCase());
  if (exists) {
    return res.status(409).json({ error: `"${item}" already exists in the database.` });
  }

  const newFood = {
    item:     item.trim(),
    qty:      qty.trim(),
    meal,
    category,
    fats:     parseFloat(fats),
    carbs:    parseFloat(carbs),
    protein:  parseFloat(protein),
    calories: parseFloat(calories),
  };

  foods.push(newFood);
  writeFoods(foods);

  res.status(201).json({
    message: IS_READONLY
      ? "Food item added for this session. Deploy a database for permanent storage."
      : "Food item added successfully.",
    food: newFood,
  });
});

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Catch-all ─────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start (local only — Vercel handles this automatically) ────
if (!IS_READONLY) {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
