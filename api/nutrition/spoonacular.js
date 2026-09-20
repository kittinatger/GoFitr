// Proxies Spoonacular's Food API so the API key stays server-side.
// Free tier signup: https://spoonacular.com/food-api
// Degrades gracefully (empty results, configured:false) if
// SPOONACULAR_API_KEY isn't set.

function round1(n) {
  return Math.round(n * 10) / 10;
}

function findNutrient(nutrients, name) {
  const hit = (nutrients || []).find((n) => (n.name || "").toLowerCase() === name);
  return hit ? hit.amount || 0 : 0;
}

// Spoonacular gives nutrients per-serving (via weightPerServing), not
// per-100g — normalize so results are directly comparable/scalable with
// every other source.
function normalizeProduct(p) {
  if (!p) return null;
  const nutrients = (p.nutrition && p.nutrition.nutrients) || [];
  const grams = (p.nutrition && p.nutrition.weightPerServing && p.nutrition.weightPerServing.amount) || 100;
  const factor = grams > 0 ? 100 / grams : 1;
  return {
    source: "Spoonacular",
    name: p.title || "Unknown food",
    brand: p.brand || "",
    kcal100: Math.round(findNutrient(nutrients, "calories") * factor),
    protein100: round1(findNutrient(nutrients, "protein") * factor),
    carbs100: round1(findNutrient(nutrients, "carbohydrates") * factor),
    fat100: round1(findNutrient(nutrients, "fat") * factor),
  };
}

module.exports = async (req, res) => {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    res.status(200).json({ results: [], configured: false });
    return;
  }

  const { q, upc, id } = req.query;

  try {
    if (upc) {
      const resp = await fetch(`https://api.spoonacular.com/food/products/upc/${encodeURIComponent(upc)}?apiKey=${encodeURIComponent(apiKey)}`);
      if (!resp.ok) {
        res.status(200).json({ results: [], configured: true });
        return;
      }
      const json = await resp.json();
      const normalized = normalizeProduct(json);
      res.status(200).json({ results: normalized ? [normalized] : [], configured: true });
      return;
    }

    if (id) {
      const resp = await fetch(`https://api.spoonacular.com/food/products/${encodeURIComponent(id)}?apiKey=${encodeURIComponent(apiKey)}`);
      if (!resp.ok) {
        res.status(200).json({ results: [], configured: true });
        return;
      }
      const json = await resp.json();
      const normalized = normalizeProduct(json);
      res.status(200).json({ results: normalized ? [normalized] : [], configured: true });
      return;
    }

    if (q) {
      const resp = await fetch(`https://api.spoonacular.com/food/products/search?query=${encodeURIComponent(q)}&number=10&apiKey=${encodeURIComponent(apiKey)}`);
      if (!resp.ok) {
        res.status(200).json({ results: [], configured: true });
        return;
      }
      const json = await resp.json();
      // The search endpoint doesn't include nutrition — flag for a
      // follow-up detail fetch (by id) once the user picks a result.
      const results = (json.products || []).slice(0, 10).map((p) => ({
        source: "Spoonacular",
        name: p.title,
        brand: "",
        kcal100: null,
        protein100: null,
        carbs100: null,
        fat100: null,
        needsDetail: true,
        detailUrl: `/api/nutrition/spoonacular?id=${encodeURIComponent(p.id)}`,
      }));
      res.status(200).json({ results, configured: true });
      return;
    }

    res.status(400).json({ error: "Missing q, upc, or id" });
  } catch (e) {
    res.status(200).json({ results: [], configured: true, error: "Spoonacular request failed" });
  }
};
