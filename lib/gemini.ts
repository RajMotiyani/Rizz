import { SCHEMA, SYSTEM, RefusedError, normalize, userPrompt, type ImageInput, type MatchContext, type ReplyResult } from "./claude";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/** Models to try in order. When the first hits its free daily quota (429), the next one is used. */
function models(): string[] {
  return (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.1-flash-lite")
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

  // Google's free tier is often slow or answers 503 "high demand". Instead of waiting on one
  // request, run a staggered race: start the first model, and if it hasn't answered within a
  // few seconds (or fails), start the next one too. The first good answer wins and the rest
  // are cancelled.
  const list = models();
  const plan = [...list, ...list].slice(0, Math.max(4, list.length)); // second round reuses models
  const HEDGE_MS = 3500;
  const DEADLINE_MS = 45_000;
  const controllers: AbortController[] = [];
  let quotaHits = 0;
  let lastErr: Error = new Error("No Gemini model configured");

  const attempt = async (model: string, ctrl: AbortController): Promise<ReplyResult> => {
    const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      quotaHits++;
      throw new QuotaError(`${model} quota`);
    }
    if (res.status === 404 || res.status >= 500) throw new BusyError(`${model} ${res.status}`);
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) throw new RefusedError(data.promptFeedback.blockReason);
    const cand = data.candidates?.[0];
    if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new RefusedError("safety");
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text) as ReplyResult; // malformed output throws and counts as a failed attempt
    parsed.replies = (parsed.replies ?? []).filter((r) => r.text?.trim()).slice(0, 4);
    if (!parsed.replies.length) throw new Error("No replies returned");
    return normalize(parsed);
  };

  try {
    return await new Promise<ReplyResult>((resolve, reject) => {
      let next = 0;
      let running = 0;
      let done = false;
      let hedgeTimer: ReturnType<typeof setTimeout> | null = null;
      const deadline = setTimeout(() => finish(null, new BusyError("deadline")), DEADLINE_MS);

      const finish = (value: ReplyResult | null, err?: Error) => {
        if (done) return;
        done = true;
        clearTimeout(deadline);
        if (hedgeTimer) clearTimeout(hedgeTimer);
        if (value) resolve(value);
        else reject(err);
      };
      const launch = () => {
        if (done) return;
        if (hedgeTimer) clearTimeout(hedgeTimer);
        if (next >= plan.length) {
          if (running === 0) {
            const e =
              quotaHits >= list.length && !(lastErr instanceof BusyError)
                ? new QuotaError("all models out of quota")
                : lastErr instanceof QuotaError || lastErr instanceof RefusedError
                  ? lastErr
                  : new BusyError(lastErr.message);
            finish(null, e);
          }
          return;
        }
        const model = plan[next++];
        const ctrl = new AbortController();
        controllers.push(ctrl);
        running++;
        attempt(model, ctrl)
          .then((r) => finish(r))
          .catch((e: Error) => {
            if (done || ctrl.signal.aborted) return;
            lastErr = e;
            if (e instanceof RefusedError) return finish(null, e);
            console.warn(`Gemini ${model} failed: ${e.message}`);
          })
          .finally(() => {
            running--;
            // A failure starts the next model right away.
            if (!done) launch();
          });
        // If this one is slow, start the next in parallel.
        hedgeTimer = setTimeout(launch, HEDGE_MS);
      };
      launch();
    });
  } finally {
    for (const c of controllers) c.abort();
  }
}
