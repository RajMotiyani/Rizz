/**
 * Sends the login code by email using Brevo's free plan (300 emails/day).
 * Without BREVO_API_KEY (local dev), the code is printed to the server log instead.
 */
export async function sendLoginCode(to: string, code: string): Promise<void> {
  const key = (process.env.BREVO_API_KEY ?? process.env.BREVO_KEY);
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV === "production" && process.env.AUTH_DEV_LOG !== "1") {
      throw new Error("Email is not configured (BREVO_API_KEY / EMAIL_FROM)");
    }
    console.log(`[dev] Login code for ${to}: ${code}`);
    return;
  }
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1f1930">
    <h2 style="margin:0 0 8px;color:#ff4f8b">Rizz ✨</h2>
    <p>Your login code is:</p>
    <p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:12px 0">${code}</p>
    <p style="color:#6b6680;font-size:14px">It expires in 10 minutes. If you didn't ask for this, you can ignore this email.</p>
  </div>`;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: from, name: "Rizz" },
      to: [{ email: to }],
      subject: `${code} is your Rizz login code`,
      htmlContent: html,
      textContent: `Your Rizz login code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
