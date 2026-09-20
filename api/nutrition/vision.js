// Reads nutrition from a photo using Google Gemini's vision API (has a
// genuine free tier via https://aistudio.google.com). Handles three kinds of
// photos in one pass: a Nutrition Facts label (OCR-read exactly), packaging
// with no visible label (identified from branding), or plain food with no
// packaging at all (visually estimated, including an estimated portion
// weight). Degrades gracefully (configured:false) if GEMINI_API_KEY isn't
// set.
//
// Whichever case it is, the result is normalized to per-100g here (using
// either the label's own serving size or the estimated portion weight), so
// this source behaves exactly like every other one — searchable/scalable
// via the normal Serving (g) field — instead of needing special handling
// client-side. The `method` field lets the client show the user how the
// numbers were derived (read off a label vs. visually estimated), since
// the two carry very different confidence.

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
  const prompt = 'Look at this photo, which is one of: (1) a Nutrition Facts label, (2) food packaging with no legible label, or (3) plain food with no packaging at all. ' +
    'If a Nutrition Facts label is legible anywhere in the image, read it exactly: extract the product name (from packaging/brand if visible), the serving size, and the calories/protein/carbs/fat listed for ONE serving. If the serving size is a non-gram unit (e.g. "2/3 cup"), convert it to grams using any gram equivalent shown on the label, or a reasonable estimate if none is shown. Set method to "label". ' +
    'If there is no legible label, identify the food (from packaging/branding, or by appearance if it is unpackaged food) and estimate its typical nutrition for a plausible single serving, along with your best-guess weight of that serving in grams. Set method to "estimate". ' +
    'Respond with ONLY JSON, no other text, matching exactly this shape: {"name": string, "method": "label" | "estimate", "servingGrams": number, "calories": number, "protein": number, "carbs": number, "fat": number, "confidence": "high" | "medium" | "low"}. Calories in kcal, protein/carbs/fat in grams, all for the one serving (not per 100g — that conversion happens elsewhere). If you cannot identify any food or label in the image at all, set name to "Unknown" and all numeric fields to 0.';

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
      res.status(200).json({ configured: true, error: "Couldn't identify any food or label in that photo" });
      return;
    }

    const method = parsed.method === "label" ? "label" : "estimate";
    const servingGrams = Number(parsed.servingGrams) > 0 ? Number(parsed.servingGrams) : 100;
    const factor = 100 / servingGrams;

    res.status(200).json({
      configured: true,
      result: {
        source: method === "label" ? "AI label scan" : "AI photo estimate",
        method,
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
