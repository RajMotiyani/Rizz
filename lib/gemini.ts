import { SCHEMA, SYSTEM, RefusedError, normalize, userPrompt, type ImageInput, type MatchContext, type ReplyResult } from "./claude";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/** Models to try in order. When the first hits its free daily quota (429), the next one is used. */
function models(): string[] {
  return (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export class QuotaError extends Error {}
/** Gemini kept failing with temporary errors (overloaded, timeouts). */
export class BusyError extends Error {}

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
  match?: MatchContext | null;
}): Promise<ReplyResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const parts: Record<string, unknown>[] = input.images.map((img) => ({
    inline_data: { mime_type: img.mediaType, data: img.data },
  }));
  parts.push({ text: userPrompt(input) });

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA,
      temperature: 1,
      maxOutputTokens: 4096,
    },
  });

  // Google's free tier often answers 503 "high demand". Retry with a short backoff,
  // alternating between models, before giving up.
  const list = models();
  const attempts = Math.max(5, list.length);
  const started = Date.now();
  let lastErr: Error = new Error("No Gemini model configured");
  let quotaHits = 0;
  for (let i = 0; i < attempts && Date.now() - started < 40_000; i++) {
    const model = list[i % list.length];
    if (i > 0) await new Promise((r) => setTimeout(r, Math.min(400 * 2 ** (i - 1), 3000) + Math.random() * 300));
    let res: Response;
    try {
      res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn(`Gemini ${model} network error, retrying`, lastErr.message);
      continue;
    }
    if (res.status === 429) {
      quotaHits++;
      lastErr = new QuotaError(`${model} quota`);
      continue;
    }
    if (res.status === 404 || res.status >= 500) {
      lastErr = new BusyError(`${model} ${res.status}`);
      console.warn(`Gemini ${model} ${res.status}, retrying`);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) throw new RefusedError(data.promptFeedback.blockReason);
    const cand = data.candidates?.[0];
    if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new RefusedError("safety");
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      const parsed = JSON.parse(text) as ReplyResult;
      parsed.replies = (parsed.replies ?? []).filter((r) => r.text?.trim()).slice(0, 4);
      if (!parsed.replies.length) throw new Error("No replies returned");
      return normalize(parsed);
    } catch (e) {
      // Truncated or malformed output: try again.
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn(`Gemini ${model} bad output (${cand?.finishReason}), retrying`);
    }
  }
  if (quotaHits >= list.length && !(lastErr instanceof BusyError)) throw new QuotaError("all models out of quota");
  throw lastErr instanceof QuotaError ? lastErr : new BusyError(lastErr.message);
}
