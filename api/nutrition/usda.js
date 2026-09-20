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
