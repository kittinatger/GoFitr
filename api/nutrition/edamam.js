// Proxies Edamam's Food Database API so the App ID/Key stay server-side.
// Free tier signup: https://developer.edamam.com/food-database-api
// Degrades gracefully (empty results, configured:false) if EDAMAM_APP_ID /
// EDAMAM_APP_KEY aren't set.

function round1(n) {
  return Math.round(n * 10) / 10;
}

function normalizeFood(food) {
  if (!food || !food.label) return null;
  const n = food.nutrients || {};
  return {
    source: "Edamam",
    name: food.label,
    brand: food.brand || food.category || "",
    // Edamam's `nutrients` on the food object are already per-100g.
    kcal100: Math.round(n.ENERC_KCAL || 0),
    protein100: round1(n.PROCNT || 0),
    carbs100: round1(n.CHOCDF || 0),
    fat100: round1(n.FAT || 0),
  };
}

module.exports = async (req, res) => {
  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;
  if (!appId || !appKey) {
    res.status(200).json({ results: [], configured: false });
    return;
  }

  const { q, upc } = req.query;

  try {
    const params = new URLSearchParams({ app_id: appId, app_key: appKey });
    if (upc) params.set("upc", upc.toString());
    else if (q) params.set("ingr", q.toString());
    else {
      res.status(400).json({ error: "Missing q or upc" });
      return;
    }

    const resp = await fetch(`https://api.edamam.com/api/food-database/v2/parser?${params.toString()}`);
    if (!resp.ok) {
      res.status(200).json({ results: [], configured: true });
      return;
    }
    const json = await resp.json();
    const foods = (json.hints || []).map((h) => h.food).concat(json.parsed ? json.parsed.map((p) => p.food) : []);
    const seen = new Set();
    const results = [];
    for (const f of foods) {
      const normalized = normalizeFood(f);
      if (!normalized || seen.has(f.foodId)) continue;
      seen.add(f.foodId);
      results.push(normalized);
      if (results.length >= 10) break;
    }
    res.status(200).json({ results, configured: true });
  } catch (e) {
    res.status(200).json({ results: [], configured: true, error: "Edamam request failed" });
  }
};
