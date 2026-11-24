import { config, istDay } from "./config";
import { store } from "./store";

const TTL = 60 * 60 * 48;

export type Status = { used: number; left: number; limit: number };

export async function status(device: string): Promise<Status> {
  const used = Math.min(Number((await store().get(`use:${device}:${istDay()}`)) ?? 0), config.perDay);
  return { used, left: Math.max(0, config.perDay - used), limit: config.perDay };
}

export type Claim = { ok: true; release: () => Promise<void> } | { ok: false };

/** Reserve one generation. Call release() if generation fails so it doesn't count. */
export async function claim(device: string, ip: string): Promise<Claim> {
  const s = store();
  const day = istDay();
  const dk = `use:${device}:${day}`;
  const ik = `useip:${ip}:${day}`;
  const n = await s.incr(dk, TTL);
  const m = await s.incr(ik, TTL);
  const release = async () => {
    await s.decr(dk);
    await s.decr(ik);
  };
  if (n > config.perDay || m > config.perIpPerDay) {
    await release();
    return { ok: false };
  }
  return { ok: true, release };
}
