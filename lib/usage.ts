import { config, istDay } from "./config";
import { store } from "./store";

const DAY = 60 * 60 * 48;

export type Status = {
  paid: boolean;
  passExpiresAt: number | null;
  freeUsed: number;
  freeLeft: number;
  freeLimit: number;
};

export async function passExpiry(device: string): Promise<number | null> {
  const v = await store().get(`pass:${device}`);
  const t = v ? Number(v) : 0;
  return t > Date.now() ? t : null;
}

export async function status(device: string): Promise<Status> {
  const [exp, used] = await Promise.all([
    passExpiry(device),
    store().get(`free:${device}:${istDay()}`),
  ]);
  const freeUsed = Math.min(Number(used ?? 0), config.freePerDay);
  return {
    paid: exp !== null,
    passExpiresAt: exp,
    freeUsed,
    freeLeft: Math.max(0, config.freePerDay - freeUsed),
    freeLimit: config.freePerDay,
  };
}

export type Claim =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; reason: "free_limit" | "fair_use" };

/** Reserve one generation. Call release() if generation fails so the user isn't charged. */
export async function claim(device: string, ip: string): Promise<Claim> {
  const s = store();
  const day = istDay();
  if (await passExpiry(device)) {
    const k = `paid:${device}:${day}`;
    const n = await s.incr(k, DAY);
    if (n > config.paidPerDay) {
      await s.decr(k);
      return { ok: false, reason: "fair_use" };
    }
    return { ok: true, release: async () => void (await s.decr(k)) };
  }
  const dk = `free:${device}:${day}`;
  const ik = `freeip:${ip}:${day}`;
  const n = await s.incr(dk, DAY);
  const m = await s.incr(ik, DAY);
  if (n > config.freePerDay || m > config.freePerIpPerDay) {
    await s.decr(dk);
    await s.decr(ik);
    return { ok: false, reason: "free_limit" };
  }
  return {
    ok: true,
    release: async () => {
      await s.decr(dk);
      await s.decr(ik);
    },
  };
}

/** Grant or extend a pass. Extends from the current expiry if one is still active. */
export async function grantPass(device: string, days = config.passDays): Promise<number> {
  const current = (await passExpiry(device)) ?? Date.now();
  const exp = current + days * 24 * 60 * 60 * 1000;
  await store().set(`pass:${device}`, String(exp), Math.ceil((exp - Date.now()) / 1000));
  return exp;
}
