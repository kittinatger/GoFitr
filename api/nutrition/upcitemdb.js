// Proxies UPCitemdb's free "trial" lookup (no key required, rate-limited).
// This is a general product database, not a nutrition one — it never has
// calorie/macro data, only product identification. Used as a last-resort
// fallback for barcode scans so the user at least gets the product name
// pre-filled (with nutrition fields left at 0 to fill in manually) instead
// of a flat "no match anywhere" dead end.

module.exports = async (req, res) => {
  const { upc } = req.query;
  if (!upc) {
    res.status(400).json({ error: "Missing upc" });
    return;
  }

  try {
    const resp = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`);
    if (!resp.ok) {
      res.status(200).json({ results: [] });
      return;
    }
    const json = await resp.json();
    const item = (json.items || [])[0];
    if (!item || !item.title) {
      res.status(200).json({ results: [] });
      return;
    }
    res.status(200).json({
      results: [
        {
          source: "UPCitemdb (name only)",
          name: item.title,
          brand: item.brand || "",
          kcal100: 0,
          protein100: 0,
          carbs100: 0,
          fat100: 0,
          nameOnly: true,
        },
      ],
    });
  } catch (e) {
    res.status(200).json({ results: [], error: "UPCitemdb request failed" });
  }
};
