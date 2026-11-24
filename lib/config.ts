export const config = {
  freePerDay: Number(process.env.FREE_REPLIES_PER_DAY ?? 5),
  // Extra guard against people clearing cookies to reset the free limit.
  freePerIpPerDay: Number(process.env.FREE_PER_IP_PER_DAY ?? 20),
  passPricePaise: Number(process.env.PASS_PRICE_PAISE ?? 4900),
  passDays: Number(process.env.PASS_DAYS ?? 7),
  // Fair-use cap for paid users, per day.
  paidPerDay: Number(process.env.PAID_PER_DAY ?? 150),
};

/** Today's date in India (YYYY-MM-DD), so free limits reset at IST midnight. */
export function istDay(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
