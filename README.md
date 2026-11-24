# Rizz: AI chat reply helper

Paste a dating-app chat (screenshot or text), pick a vibe and a language, and get 4 witty replies to copy and send.
5 free replies a day, then ₹49 for 7 days of unlimited replies, paid by UPI through Razorpay.

## Stack
- Next.js 16 (App Router), mobile-first single page, no login
- AI, switchable with env vars:
  - **Free:** Google Gemini API free tier (Flash-Lite models, ~500 requests/day each, vision + JSON output).
    Note: Google may use free-tier inputs to improve its products. Move to a paid tier once revenue comes in.
  - **Paid upgrade:** Claude Opus 5.5 (`claude-opus-5-5`), better replies, about ₹1.5–2 per generation
- Razorpay Orders + Checkout (UPI shown first), signature verified on the server
- Usage and passes in Upstash Redis (or a local JSON file in dev)

## Run locally
```bash
cp .env.example .env.local   # fill in GEMINI_API_KEY (free), Razorpay TEST keys, SESSION_SECRET
npm install
npm run dev                  # http://localhost:3000
```
Razorpay test mode: use UPI ID `success@razorpay` to simulate a successful payment, `failure@razorpay` for a failure.

## Deploy (Vercel, ~10 minutes)
1. Push this folder to a GitHub repo and import it in Vercel.
2. Create a free Upstash Redis database and copy its REST URL and token.
3. Add all variables from `.env.example` in Vercel > Settings > Environment Variables.
4. Deploy. For real money, switch the Razorpay keys from `rzp_test_` to `rzp_live_` after KYC.

## How it works
- **Identity:** an anonymous, signed, httpOnly cookie per device. No signup friction.
- **Free limit:** 5 generations per device per IST day, plus a 20/day cap per IP so clearing cookies doesn't give unlimited use.
  A failed generation doesn't count.
- **Pass:** `/api/pay/order` creates a ₹49 order, Checkout opens, `/api/pay/verify` checks the HMAC signature and grants 7 days.
  No auto-renew. Paid users have a 150/day fair-use cap.
- **Restore:** a user who switches phone or clears cookies enters the `pay_...` ID from their Razorpay receipt. The pass moves to the new device.
- **Privacy:** screenshots are sent to Claude and never stored.

## Files
- `app/page.tsx`: the whole UI (upload, vibe and language chips, results, paywall sheet)
- `lib/claude.ts`: prompt, schema, and the Claude call
- `lib/usage.ts`: free limits and passes
- `lib/razorpay.ts`: orders, payments, signature check
- `app/api/*`: `me`, `reply`, `pay/order`, `pay/verify`, `pay/restore`

## Next steps after launch
- Razorpay webhook (`payment.captured`) as a backup for users who close the tab mid-payment
- Share card ("my Rizz reply") for Instagram Stories to drive organic growth
- Analytics (PostHog) on paywall views vs. purchases
- Privacy policy and terms pages (Razorpay needs these for live mode)
