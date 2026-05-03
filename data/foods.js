// ── Food Database ─────────────────────────────────────────────
// Single source of truth — used by the API and can be imported
// by any future service (DB seed, validation, etc.)

const foods = [
  // Breakfast / Snacks
  { item: "Aloo paratha",    qty: "1 pc",   category: "Veg",      fats: 10,  carbs: 45, protein: 6,  calories: 300 },
  { item: "Boiled egg",      qty: "1 pc",   category: "Non-Veg",  fats: 5,   carbs: 1,  protein: 6,  calories: 70  },
  { item: "Bhatura",         qty: "1 pc",   category: "Veg",      fats: 15,  carbs: 50, protein: 7,  calories: 350 },
  { item: "Chutney",         qty: "50g",    category: "Veg",      fats: 2,   carbs: 4,  protein: 1,  calories: 40  },
  { item: "Dahi",            qty: "100g",   category: "Veg",      fats: 4,   carbs: 5,  protein: 3,  calories: 60  },
  { item: "Dosa",            qty: "1 pc",   category: "Veg",      fats: 6,   carbs: 40, protein: 5,  calories: 220 },
  { item: "Idli",            qty: "1 pc",   category: "Veg",      fats: 1,   carbs: 30, protein: 4,  calories: 150 },
  { item: "Jalebi",          qty: "1 pc",   category: "Dessert",  fats: 8,   carbs: 50, protein: 2,  calories: 250 },
  { item: "Kachori",         qty: "1 pc",   category: "Veg",      fats: 20,  carbs: 40, protein: 6,  calories: 350 },
  { item: "Methi paratha",   qty: "1 pc",   category: "Veg",      fats: 8,   carbs: 40, protein: 5,  calories: 250 },
  { item: "Mix paratha",     qty: "1 pc",   category: "Veg",      fats: 9,   carbs: 42, protein: 6,  calories: 270 },
  { item: "Moong dal chila", qty: "1 pc",   category: "Veg",      fats: 5,   carbs: 20, protein: 8,  calories: 180 },
  { item: "Paneer paratha",  qty: "1 pc",   category: "Veg",      fats: 12,  carbs: 40, protein: 10, calories: 320 },
  { item: "Paratha",         qty: "1 pc",   category: "Veg",      fats: 10,  carbs: 40, protein: 5,  calories: 280 },
  { item: "Poha",            qty: "100g",   category: "Veg",      fats: 5,   carbs: 35, protein: 4,  calories: 200 },
  { item: "Puri",            qty: "1 pc",   category: "Veg",      fats: 12,  carbs: 35, protein: 4,  calories: 250 },
  { item: "Sambhar",         qty: "100g",   category: "Veg",      fats: 3,   carbs: 15, protein: 6,  calories: 120 },
  { item: "Sattu paratha",   qty: "1 pc",   category: "Veg",      fats: 8,   carbs: 40, protein: 8,  calories: 280 },
  { item: "Suji chila",      qty: "1 pc",   category: "Veg",      fats: 6,   carbs: 30, protein: 5,  calories: 200 },
  { item: "Upma",            qty: "100g",   category: "Veg",      fats: 7,   carbs: 35, protein: 5,  calories: 220 },
  { item: "Uttapam",         qty: "1 pc",   category: "Veg",      fats: 7,   carbs: 40, protein: 6,  calories: 250 },

  // Dry Fruits & Fruits
  { item: "Almond",          qty: "30g",    category: "Veg",      fats: 15,  carbs: 7,  protein: 6,  calories: 170 },
  { item: "Fried peanuts",   qty: "30g",    category: "Veg",      fats: 14,  carbs: 5,  protein: 7,  calories: 170 },
  { item: "Apple",           qty: "1 pc",   category: "Veg",      fats: 0,   carbs: 25, protein: 0,  calories: 95  },
  { item: "Banana",          qty: "1 pc",   category: "Veg",      fats: 0,   carbs: 27, protein: 1,  calories: 105 },
  { item: "Milk",            qty: "100ml",  category: "Veg",      fats: 4,   carbs: 5,  protein: 3,  calories: 60  },
  { item: "Mixed seeds",     qty: "30g",    category: "Veg",      fats: 13,  carbs: 6,  protein: 5,  calories: 150 },
  { item: "Roasted makhana", qty: "30g",    category: "Veg",      fats: 0.5, carbs: 23, protein: 3,  calories: 100 },
  { item: "Roasted nuts",    qty: "30g",    category: "Veg",      fats: 14,  carbs: 6,  protein: 5,  calories: 160 },
  { item: "Walnut",          qty: "30g",    category: "Veg",      fats: 20,  carbs: 4,  protein: 4,  calories: 200 },

  // Beverages
  { item: "Anaar juice",     qty: "100ml",  category: "Beverage", fats: 0,   carbs: 13, protein: 0,  calories: 54  },
  { item: "Coconut water",   qty: "100ml",  category: "Beverage", fats: 0,   carbs: 9,  protein: 0,  calories: 45  },
  { item: "Ganne juice",     qty: "100ml",  category: "Beverage", fats: 0,   carbs: 13, protein: 0,  calories: 60  },
  { item: "Mausambi juice",  qty: "100ml",  category: "Beverage", fats: 0,   carbs: 10, protein: 0,  calories: 45  },
  { item: "Orange juice",    qty: "100ml",  category: "Beverage", fats: 0,   carbs: 11, protein: 1,  calories: 47  },
  { item: "Pineapple juice", qty: "100ml",  category: "Beverage", fats: 0,   carbs: 13, protein: 0,  calories: 53  },

  // Desserts
  { item: "Besan halwa",     qty: "100g",   category: "Dessert",  fats: 15,  carbs: 50, protein: 6,  calories: 350 },
  { item: "Gajar halwa",     qty: "100g",   category: "Dessert",  fats: 10,  carbs: 45, protein: 4,  calories: 300 },
  { item: "Suji halwa",      qty: "100g",   category: "Dessert",  fats: 12,  carbs: 50, protein: 5,  calories: 320 },

  // Fried Snacks
  { item: "Aloo pakodi",     qty: "100g",   category: "Veg",      fats: 15,  carbs: 30, protein: 4,  calories: 280 },
  { item: "Paneer pakodi",   qty: "100g",   category: "Veg",      fats: 18,  carbs: 20, protein: 10, calories: 300 },
  { item: "Paneer tikka",    qty: "100g",   category: "Veg",      fats: 20,  carbs: 10, protein: 15, calories: 280 },
  { item: "Pyaaz pakodi",    qty: "100g",   category: "Veg",      fats: 14,  carbs: 28, protein: 4,  calories: 260 },

  // Main Meals
  { item: "Dalia",           qty: "100g",   category: "Veg",      fats: 2,   carbs: 35, protein: 5,  calories: 180 },
  { item: "Chawal",          qty: "100g",   category: "Veg",      fats: 0,   carbs: 45, protein: 4,  calories: 200 },
  { item: "Khichadi",        qty: "100g",   category: "Veg",      fats: 5,   carbs: 35, protein: 6,  calories: 220 },
  { item: "Kheer",           qty: "100g",   category: "Dessert",  fats: 8,   carbs: 40, protein: 6,  calories: 250 },
  { item: "Pulao",           qty: "100g",   category: "Veg",      fats: 8,   carbs: 45, protein: 6,  calories: 280 },
  { item: "Sewai",           qty: "100g",   category: "Dessert",  fats: 10,  carbs: 50, protein: 5,  calories: 300 },
  { item: "Bati",            qty: "1 pc",   category: "Veg",      fats: 12,  carbs: 40, protein: 6,  calories: 300 },
  { item: "Roti",            qty: "1 pc",   category: "Veg",      fats: 1,   carbs: 20, protein: 3,  calories: 100 },
  { item: "Aachar",          qty: "20g",    category: "Veg",      fats: 4,   carbs: 1,  protein: 0,  calories: 50  },
  { item: "Chokha",          qty: "100g",   category: "Veg",      fats: 5,   carbs: 20, protein: 3,  calories: 150 },
  { item: "Kadhi",           qty: "100g",   category: "Veg",      fats: 6,   carbs: 15, protein: 5,  calories: 150 },
  { item: "Raita",           qty: "100g",   category: "Veg",      fats: 4,   carbs: 6,  protein: 3,  calories: 70  },
  { item: "Salad",           qty: "100g",   category: "Veg",      fats: 0,   carbs: 5,  protein: 1,  calories: 30  },

  // Sabji
  { item: "Aloo chana",      qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Aloo matar",      qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Baigan",          qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Bhindi",          qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Gobhi",           qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Kaddu",           qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Lauki",           qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Mix veg",         qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 4,  calories: 140 },
  { item: "Paneer sabji",    qty: "100g",   category: "Veg",      fats: 15,  carbs: 18, protein: 10, calories: 250 },
  { item: "Palak paneer",    qty: "100g",   category: "Veg",      fats: 15,  carbs: 18, protein: 10, calories: 250 },
  { item: "Matar paneer",    qty: "100g",   category: "Veg",      fats: 15,  carbs: 18, protein: 10, calories: 250 },
  { item: "Soyabean sabji",  qty: "100g",   category: "Veg",      fats: 6,   carbs: 18, protein: 12, calories: 180 },

  // Non-Veg
  { item: "Chicken curry",   qty: "100g",   category: "Non-Veg",  fats: 15,  carbs: 5,  protein: 20, calories: 250 },
  { item: "Egg curry",       qty: "100g",   category: "Non-Veg",  fats: 12,  carbs: 5,  protein: 10, calories: 180 },

  // Dal
  { item: "Moong dal",       qty: "100g",   category: "Veg",      fats: 3,   carbs: 25, protein: 9,  calories: 160 },
  { item: "Masoor dal",      qty: "100g",   category: "Veg",      fats: 3,   carbs: 25, protein: 9,  calories: 160 },
  { item: "Chana dal",       qty: "100g",   category: "Veg",      fats: 3,   carbs: 25, protein: 9,  calories: 160 },
  { item: "Toor dal",        qty: "100g",   category: "Veg",      fats: 3,   carbs: 25, protein: 9,  calories: 160 },
  { item: "Urad dal",        qty: "100g",   category: "Veg",      fats: 3,   carbs: 25, protein: 9,  calories: 160 },
];

module.exports = foods;
