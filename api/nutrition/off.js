// Proxies Open Food Facts search server-side. OFF's product-by-barcode
// endpoint is reliably CORS-enabled and is called directly from the browser
// elsewhere, but its search endpoints have been flaky/inconsistent about
// CORS headers — routing through here sidesteps that entirely, since CORS
// only applies to browser requests, not server-to-server ones.

function round1(n) {
  return Math.round(n * 10) / 10;
}

// OFF's `_100g` nutriment fields are always normalized to grams regardless
// of nutrient — convert to the mg/mcg units the app displays everything
// else in. Any field OFF doesn't have for a product is left at 0.
function microsFromNutriments(n) {
  n = n || {};
  const mg = (key) => round1((n[key] || 0) * 1000);
  const mcg = (key) => round1((n[key] || 0) * 1000000);
  return {
    vitaminA: mcg("vitamin-a_100g"),
    vitaminC: mg("vitamin-c_100g"),
    vitaminD: mcg("vitamin-d_100g"),
    vitaminE: mg("vitamin-e_100g"),
    vitaminK: mcg("vitamin-k_100g"),
    vitaminB1: mg("vitamin-b1_100g"),
    vitaminB2: mg("vitamin-b2_100g"),
    vitaminB3: mg("vitamin-pp_100g"),
    vitaminB5: mg("pantothenic-acid_100g"),
    vitaminB6: mg("vitamin-b6_100g"),
    vitaminB12: mcg("vitamin-b12_100g"),
    calcium: mg("calcium_100g"),
    iron: mg("iron_100g"),
    magnesium: mg("magnesium_100g"),
    phosphorus: mg("phosphorus_100g"),
    potassium: mg("potassium_100g"),
    sodium: mg("sodium_100g"),
    zinc: mg("zinc_100g"),
    copper: mg("copper_100g"),
    manganese: mg("manganese_100g"),
    transFat: round1(n["trans-fat_100g"] || 0),
    saturatedFat: round1(n["saturated-fat_100g"] || 0),
    fiber: round1(n["fiber_100g"] || 0),
  };
}

module.exports = async (req, res) => {
  const { q } = req.query;
  const query = (q || "").toString().trim();
  if (!query) {
    res.status(400).json({ error: "Missing q" });
    return;
  }

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=10&fields=product_name,brands,nutriments`;
    const resp = await fetch(url, { headers: { "User-Agent": "GoFitr-App" } });
    if (!resp.ok) {
      res.status(200).json({ results: [] });
      return;
    }
    const json = await resp.json();
    const results = (json.products || [])
      .filter((p) => p.product_name && p.nutriments && p.nutriments["energy-kcal_100g"] != null)
      .map((p) => ({
        source: "Open Food Facts",
        name: p.product_name,
        brand: p.brands || "",
        kcal100: p.nutriments["energy-kcal_100g"] || 0,
        protein100: p.nutriments["proteins_100g"] || 0,
        carbs100: p.nutriments["carbohydrates_100g"] || 0,
        fat100: p.nutriments["fat_100g"] || 0,
        micros100: microsFromNutriments(p.nutriments),
      }));
    res.status(200).json({ results });
  } catch (e) {
    res.status(200).json({ results: [], error: "Open Food Facts request failed" });
  }
};
