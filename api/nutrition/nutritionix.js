// Proxies Nutritionix so the App ID/Key stay server-side (their API doesn't
// support safe direct-from-browser use since keys go in plain headers).
// Free tier signup: https://developer.nutritionix.com/
// Degrades gracefully (empty results, configured:false) if the two env vars
// NUTRITIONIX_APP_ID / NUTRITIONIX_APP_KEY aren't set.

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Nutritionix nutrient values are per-serving, not per-100g — normalize so
// results are directly comparable/scalable with the other sources.
function normalizeFullFood(f) {
  const grams = f.serving_weight_grams || 100;
  const factor = grams > 0 ? 100 / grams : 1;
  return {
    source: "Nutritionix",
    name: f.food_name,
    brand: f.brand_name || "",
    kcal100: Math.round((f.nf_calories || 0) * factor),
    protein100: round1((f.nf_protein || 0) * factor),
    carbs100: round1((f.nf_total_carbohydrate || 0) * factor),
    fat100: round1((f.nf_total_fat || 0) * factor),
  };
}

module.exports = async (req, res) => {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const appKey = process.env.NUTRITIONIX_APP_KEY;
  if (!appId || !appKey) {
    res.status(200).json({ results: [], configured: false });
    return;
  }

  const { q, upc, itemId } = req.query;
  const headers = { "x-app-id": appId, "x-app-key": appKey };

  try {
    if (upc || itemId) {
      const param = upc ? `upc=${encodeURIComponent(upc)}` : `nix_item_id=${encodeURIComponent(itemId)}`;
      const resp = await fetch(`https://trackapi.nutritionix.com/v2/search/item?${param}`, { headers });
      if (!resp.ok) {
        res.status(200).json({ results: [], configured: true });
        return;
      }
      const json = await resp.json();
      res.status(200).json({ results: (json.foods || []).map(normalizeFullFood), configured: true });
      return;
    }

    if (q) {
      const resp = await fetch(`https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(q)}`, { headers });
      if (!resp.ok) {
        res.status(200).json({ results: [], configured: true });
        return;
      }
      const json = await resp.json();
      // Instant search doesn't include full macros for branded items — flag
      // them for a follow-up detail fetch (by nix_item_id) once selected.
      const results = (json.branded || []).slice(0, 10).map((b) => ({
        source: "Nutritionix",
        name: b.food_name,
        brand: b.brand_name || "",
        kcal100: null,
        protein100: null,
        carbs100: null,
        fat100: null,
        needsDetail: true,
        detailUrl: `/api/nutrition/nutritionix?itemId=${encodeURIComponent(b.nix_item_id)}`,
      }));
      res.status(200).json({ results, configured: true });
      return;
    }

    res.status(400).json({ error: "Missing q, upc, or itemId" });
  } catch (e) {
    res.status(200).json({ results: [], configured: true, error: "Nutritionix request failed" });
  }
};
