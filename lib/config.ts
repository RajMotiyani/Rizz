export const config = {
  // Free replies per device per day. Keeps one person from using up the shared free AI quota.
  perDay: Number(process.env.REPLIES_PER_DAY ?? 50),
  // Extra guard against people clearing cookies to reset their limit.
  perIpPerDay: Number(process.env.REPLIES_PER_IP_PER_DAY ?? 150),
};

/** Today's date in India (YYYY-MM-DD), so limits reset at IST midnight. */
export function istDay(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
