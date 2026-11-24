import { generateWithClaude, type ImageInput, type Language, type MatchContext, type ReplyResult, type Tone } from "./claude";
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
  match?: MatchContext | null;
  style?: string;
}): Promise<ReplyResult> {
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("No AI key set: add GEMINI_API_KEY in your environment variables.");
  }
  const provider =
    process.env.AI_PROVIDER ?? (process.env.GEMINI_API_KEY ? "gemini" : "claude");
  return provider === "gemini" ? generateWithGemini(input) : generateWithClaude(input);
}
