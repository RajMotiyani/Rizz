import { generateWithClaude, type ImageInput, type Language, type ReplyResult, type Tone } from "./claude";
import { generateWithGemini } from "./gemini";

/**
 * Picks the AI provider. Gemini's free tier is used when GEMINI_API_KEY is set (no cost),
 * otherwise Claude (paid, higher quality). Set AI_PROVIDER to force one.
 */
export async function generateReplies(input: {
  images: ImageInput[];
  chatText: string;
  tone: Tone;
  language: Language;
  goal: string;
}): Promise<ReplyResult> {
  const provider =
    process.env.AI_PROVIDER ?? (process.env.GEMINI_API_KEY ? "gemini" : "claude");
  return provider === "gemini" ? generateWithGemini(input) : generateWithClaude(input);
}
