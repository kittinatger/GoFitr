// Proxies USDA FoodData Central so the API key stays server-side.
// Free key, instant signup: https://fdc.nal.usda.gov/api-key-signup
// Degrades gracefully (empty results, configured:false) if USDA_API_KEY isn't set.

function round1(n) {
  return Math.round(n * 10) / 10;
}

function getNutrient(food, matchers) {
  const list = food.foodNutrients || [];
  for (const n of list) {
    const name = (n.nutrientName || "").toLowerCase();
    if (matchers.some((m) => name.includes(m))) return n.value || 0;
  }
  return 0;
}

// Per-100g, matching the units the app displays (mg/mcg/g). Any nutrient USDA
// doesn't report for a given food is left at 0 — the client shows every row
// regardless, since these are still useful "0 / not significant" values.
function getMicros(food) {
  return {
    vitaminA: round1(getNutrient(food, ["vitamin a, rae"])),
    vitaminC: round1(getNutrient(food, ["vitamin c, total ascorbic"])),
    vitaminD: round1(getNutrient(food, ["vitamin d (d2"])),
    vitaminE: round1(getNutrient(food, ["vitamin e (alpha"])),
    vitaminK: round1(getNutrient(food, ["vitamin k (phylloquinone"])),
    vitaminB1: round1(getNutrient(food, ["thiamin"])),
    vitaminB2: round1(getNutrient(food, ["riboflavin"])),
    vitaminB3: round1(getNutrient(food, ["niacin"])),
    vitaminB5: round1(getNutrient(food, ["pantothenic"])),
    vitaminB6: round1(getNutrient(food, ["vitamin b-6"])),
    vitaminB12: round1(getNutrient(food, ["vitamin b-12"])),
    calcium: round1(getNutrient(food, ["calcium, ca"])),
    iron: round1(getNutrient(food, ["iron, fe"])),
    magnesium: round1(getNutrient(food, ["magnesium, mg"])),
    phosphorus: round1(getNutrient(food, ["phosphorus, p"])),
    potassium: round1(getNutrient(food, ["potassium, k"])),
    sodium: round1(getNutrient(food, ["sodium, na"])),
    zinc: round1(getNutrient(food, ["zinc, zn"])),
    copper: round1(getNutrient(food, ["copper, cu"])),
    manganese: round1(getNutrient(food, ["manganese, mn"])),
    transFat: round1(getNutrient(food, ["fatty acids, total trans"])),
    saturatedFat: round1(getNutrient(food, ["fatty acids, total saturated"])),
    fiber: round1(getNutrient(food, ["fiber, total dietary"])),
  };
}

function normalizeUsdaFood(f) {
  if (!f.description) return null;
  return {
    source: "USDA",
    name: f.description,
    brand: f.brandName || f.brandOwner || "",
    kcal100: Math.round(getNutrient(f, ["energy"])),
    protein100: round1(getNutrient(f, ["protein"])),
    carbs100: round1(getNutrient(f, ["carbohydrate"])),
    fat100: round1(getNutrient(f, ["total lipid", "fat"])),
    micros100: getMicros(f),
  };
}

module.exports = async (req, res) => {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    res.status(200).json({ results: [], configured: false });
    return;
  }

  const { q, upc } = req.query;
  const query = (upc || q || "").toString().trim();
  if (!query) {
    res.status(400).json({ error: "Missing q or upc" });
    return;
  }

  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&dataType=Branded&pageSize=10`;
    const resp = await fetch(url);
    const bodyText = await resp.text();
    if (!resp.ok) {
      const debug = req.query.debug ? { upstreamStatus: resp.status, upstreamBody: bodyText.slice(0, 500) } : undefined;
      res.status(200).json({ results: [], configured: true, debug });
      return;
    }
    const json = JSON.parse(bodyText);
    const results = (json.foods || []).map(normalizeUsdaFood).filter(Boolean);
    const debug = req.query.debug ? { totalHits: json.totalHits, foodsReturned: (json.foods || []).length } : undefined;
    res.status(200).json({ results, configured: true, debug });
  } catch (e) {
    res.status(200).json({ results: [], configured: true, error: "USDA request failed: " + e.message });
  }
};
