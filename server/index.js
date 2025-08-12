import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in /server/.env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = "gemini-2.0-flash";

function buildSystemPrompt(language, verbosity) {
  return `
Return ONLY JSON in this exact schema (no code fences, no extra text):
{
  "language":"${language}",
  "verbosity":"${verbosity}",
  "sections":[
    { "id":"", "title":"", "body":"", "children":[] }
  ]
}
Rules:
- Titles short & descriptive (one line).
- Body plain text (no markdown), concise at verbosity=${verbosity}.
- Children optional; same shape if present.
- No commentary or extra keys. Only the JSON object above.
`.trim();
}

app.post("/api/outline", async (req, res) => {
  try {
    const { prompt, verbosity = "medium", language = "en" } = req.body || {};
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Missing 'prompt'." });
    }

    const model = genAI.getGenerativeModel({ model: MODEL });
    const system = buildSystemPrompt(language, verbosity);

    const result = await model.generateContent({
      contents: [
        {
          parts: [
            { text: system + "\n\nTopic: " + prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const text = result?.response?.text?.() || "{}";

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.error("Parse error. Raw model text:", text);
      return res.status(502).json({
        error: "Model did not return valid JSON",
        raw: text
      });
    }

    if (!json || !Array.isArray(json.sections)) {
      return res.status(502).json({
        error: "Invalid outline format (missing 'sections' array).",
        raw: json
      });
    }

    res.json(json);
  } catch (err) {
    console.error("Gemini error:", err);
    const status = err?.status || 500;
    const msg = err?.statusText || err?.message || "Gemini request failed";
    res.status(status).json({ error: msg, details: err?.errorDetails || null });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running at http://localhost:${port}`));
