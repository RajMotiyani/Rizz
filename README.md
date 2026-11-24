# Rizz: free AI chat reply helper

Paste a dating-app chat (screenshot or text), pick a vibe and a language, and get 4 witty replies to copy and send.
Completely free for users, and free to run on Google Gemini's free tier.

## Stack
- Next.js 16 (App Router), mobile-first single page, no login
- Google Gemini free tier (`gemini-3.5-flash-lite`, falls back to `gemini-3.1-flash-lite` when its daily quota runs out),
  with vision for screenshots and JSON output. Google may use free-tier inputs to improve its products.
- Optional: Claude Opus 5.5 (`AI_PROVIDER=claude`) for higher-quality replies, paid per use
- Usage counts in Upstash Redis (or a local JSON file in dev)

## Run locally
```bash
cp .env.example .env.local   # add GEMINI_API_KEY and SESSION_SECRET
npm install
npm run dev                  # http://localhost:3000
```

## Deploy on Vercel (free, ~10 minutes)
1. In Vercel, click Add New → Project and import this GitHub repo.
2. Before clicking Deploy, open Environment Variables and add `GEMINI_API_KEY` and `SESSION_SECRET`.
3. Deploy. Share the link.
4. Recommended once you have users: add a free Upstash Redis database (Vercel → Storage → Upstash) and set
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without it the app still works, but daily limits
   are only approximate because Vercel doesn't keep files between requests.

## Limits
- Each device gets 10 replies a day (resets at midnight IST), plus 30/day per IP so clearing cookies doesn't bypass it.
  Failed generations don't count. Change with `REPLIES_PER_DAY`.
- Gemini's free tier allows roughly 500 requests a day per model, so ~1,000 a day across both models.
  If you outgrow it, enable billing on the Gemini key; Flash-Lite costs a fraction of a rupee per reply.

## Files
- `app/page.tsx`: the whole UI (upload, vibe and language chips, results)
- `lib/gemini.ts`: Gemini call; `lib/claude.ts`: prompt, schema and optional Claude call; `lib/ai.ts`: picks the provider
- `lib/usage.ts`: daily limits; `lib/store.ts`: Redis/file storage; `lib/session.ts`: anonymous device cookie
- `app/api/reply`, `app/api/me`: API routes
