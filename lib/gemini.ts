import { SCHEMA, SYSTEM, RefusedError, type ImageInput, type ReplyResult } from "./claude";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/** Models to try in order. When the first hits its free daily quota (429), the next one is used. */
function models(): string[] {
  return (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export class QuotaError extends Error {}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export async function generateWithGemini(input: {
  images: ImageInput[];
  chatText: string;
  tone: string;
  language: string;
  goal: string;
}): Promise<ReplyResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const parts: Record<string, unknown>[] = input.images.map((img) => ({
    inline_data: { mime_type: img.mediaType, data: img.data },
  }));
  const lines = [
    input.chatText ? `Chat:\n"""\n${input.chatText}\n"""` : "The chat is in the screenshot(s) above.",
    `Tone: ${input.tone}`,
    `Language: ${input.language}. Write all 4 replies in ${input.language}${input.language === "Hinglish" ? " (Hindi + English mixed, Roman script, e.g. \"acha toh kab mil rahe ho?\")" : input.language === "Tanglish" ? " (Tamil + English mixed, Roman script)" : ""}, even if the chat is in another language.`,
  ];
  if (input.goal) lines.push(`What I want from this reply: ${input.goal}`);
  parts.push({ text: lines.join("\n\n") });

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA,
      temperature: 1,
      maxOutputTokens: 2048,
    },
  });

  let lastErr: Error = new Error("No Gemini model configured");
  for (const model of models()) {
    const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
      cache: "no-store",
    });
    if (res.status === 429 || res.status === 404) {
      // Free quota used up (or model not available): try the next model.
      lastErr = res.status === 429 ? new QuotaError(`${model} quota`) : new Error(`${model} not found`);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) throw new RefusedError(data.promptFeedback.blockReason);
    const cand = data.candidates?.[0];
    if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new RefusedError("safety");
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text) as ReplyResult;
    parsed.replies = (parsed.replies ?? []).filter((r) => r.text?.trim()).slice(0, 4);
    if (!parsed.replies.length) throw new Error("No replies returned");
    return parsed;
  }
  throw lastErr;
}
