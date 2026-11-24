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
- Each device gets 50 replies a day (resets at midnight IST), plus 150/day per IP so clearing cookies doesn't bypass it.
  Failed generations don't count. Change with `REPLIES_PER_DAY`.
- Gemini's free tier allows roughly 500 requests a day per model, so ~1,000 a day across both models.
  If you outgrow it, enable billing on the Gemini key; Flash-Lite costs a fraction of a rupee per reply.

## Files
- `app/page.tsx`: the whole UI (upload, vibe and language chips, results)
- `lib/gemini.ts`: Gemini call; `lib/claude.ts`: prompt, schema and optional Claude call; `lib/ai.ts`: picks the provider
- `lib/usage.ts`: daily limits; `lib/store.ts`: Redis/file storage; `lib/session.ts`: anonymous device cookie
- `app/api/reply`, `app/api/me`: API routes

## Login and user database
Users log in with email + mobile number; a 6-digit code is emailed to them (Brevo, free 300/day).
Users are stored in Supabase (free). Login turns on automatically once `BREVO_API_KEY` and `EMAIL_FROM` are set.

1. **Supabase:** create a free project at supabase.com → SQL Editor → New query → paste `supabase/schema.sql` → Run.
   Then Project Settings → API (or API Keys): copy the Project URL and the **secret** (service role) key.
2. **Brevo:** sign up at brevo.com → Senders, Domains & Dedicated IPs → add and verify your sender email →
   SMTP & API → API Keys → Generate.
3. In Vercel add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `EMAIL_FROM` (your verified sender), then redeploy.
4. Check `/api/health`: `login` should be `on` and `database` should be `working`.

**Reviewing users:** Supabase → Table Editor → `users` (email, phone, signup date, last login, logins, replies used).
Use the Export button for a CSV. Chats and screenshots are never stored.
