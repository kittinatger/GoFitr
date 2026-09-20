// Reads a Nutrition Facts label from a photo of food packaging using Google
// Gemini's vision API (has a genuine free tier via https://aistudio.google.com).
// Degrades gracefully (configured:false) if GEMINI_API_KEY isn't set.
//
// This is OCR-style label reading, not meal-photo calorie guessing — the
// model extracts the serving size and per-serving values straight off the
// printed label, which we then normalize to per-100g here so this source
// behaves exactly like every other one (searchable/scalable via the normal
// Serving (g) field) instead of needing its own special handling client-side.

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ configured: false });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST required" });
    return;
  }

  const { image, mimeType } = req.body || {};
  if (!image) {
    res.status(400).json({ error: "Missing image" });
    return;
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = 'You are reading a Nutrition Facts label from a photo of food packaging. Find the product name (from the packaging/brand if visible) and the nutrition label, then extract the serving size and the calories/protein/carbs/fat listed for ONE serving. If the serving size is given in a non-gram unit (e.g. "2/3 cup"), convert it to your best estimate of grams using any gram equivalent shown on the label, or a reasonable estimate for that food if none is shown. Respond with ONLY JSON, no other text, matching exactly this shape: {"name": string, "servingGrams": number, "calories": number, "protein": number, "carbs": number, "fat": number, "confidence": "high" | "medium" | "low"}. Calories in kcal, protein/carbs/fat in grams, all for the one serving (not per 100g — that conversion happens elsewhere). If you cannot find or read a nutrition label in the image, set name to "Unknown" and all numeric fields to 0.';

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || "image/jpeg", data: image } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      }
    );
    const bodyText = await resp.text();
    if (!resp.ok) {
      const debug = req.query.debug ? bodyText.slice(0, 500) : undefined;
      res.status(200).json({ configured: true, error: "Vision request failed", debug });
      return;
    }

    const json = JSON.parse(bodyText);
    const text = json.candidates && json.candidates[0] && json.candidates[0].content &&
      json.candidates[0].content.parts && json.candidates[0].content.parts[0] &&
      json.candidates[0].content.parts[0].text;
    if (!text) {
      res.status(200).json({ configured: true, error: "No response from model" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      res.status(200).json({ configured: true, error: "Could not parse model response" });
      return;
    }

    if (!parsed.name || parsed.name === "Unknown") {
      res.status(200).json({ configured: true, error: "Could not find a nutrition label in that photo" });
      return;
    }

    const servingGrams = Number(parsed.servingGrams) > 0 ? Number(parsed.servingGrams) : 100;
    const factor = 100 / servingGrams;

    res.status(200).json({
      configured: true,
      result: {
        source: "AI label scan",
        name: parsed.name,
        brand: "",
        kcal100: Math.round((Number(parsed.calories) || 0) * factor),
        protein100: round1((Number(parsed.protein) || 0) * factor),
        carbs100: round1((Number(parsed.carbs) || 0) * factor),
        fat100: round1((Number(parsed.fat) || 0) * factor),
        confidence: parsed.confidence || "medium",
      },
    });
  } catch (e) {
    res.status(200).json({ configured: true, error: "Vision request failed: " + e.message });
  }
};
