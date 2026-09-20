// Proxies Open Food Facts search server-side. OFF's product-by-barcode
// endpoint is reliably CORS-enabled and is called directly from the browser
// elsewhere, but its search endpoints have been flaky/inconsistent about
// CORS headers — routing through here sidesteps that entirely, since CORS
// only applies to browser requests, not server-to-server ones.

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
      }));
    res.status(200).json({ results });
  } catch (e) {
    res.status(200).json({ results: [], error: "Open Food Facts request failed" });
  }
};
