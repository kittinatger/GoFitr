// Estimates nutrition from a photo of a plate of food using Google Gemini's
// vision API (has a genuine free tier via https://aistudio.google.com).
// Degrades gracefully (configured:false) if GEMINI_API_KEY isn't set.
// Unlike the other sources, this returns absolute numbers for the portion
// shown in the photo — not a per-100g base to scale by serving — since a
// prepared meal's weight can't be reliably inferred from a picture.

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
  const prompt = 'You are a nutrition estimator. Look at this photo of food and identify what it is, then estimate its nutrition for the portion actually shown in the photo (not per 100g). Respond with ONLY JSON, no other text, matching exactly this shape: {"name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "confidence": "high" | "medium" | "low"}. Calories in kcal, protein/carbs/fat in grams. If you cannot identify any food in the image, set name to "Unknown" and all numeric fields to 0.';

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
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
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

    res.status(200).json({
      configured: true,
      result: {
        source: "AI photo estimate",
        name: parsed.name || "Unknown food",
        calories: Number(parsed.calories) || 0,
        protein: Number(parsed.protein) || 0,
        carbs: Number(parsed.carbs) || 0,
        fat: Number(parsed.fat) || 0,
        confidence: parsed.confidence || "medium",
      },
    });
  } catch (e) {
    res.status(200).json({ configured: true, error: "Vision request failed: " + e.message });
  }
};
