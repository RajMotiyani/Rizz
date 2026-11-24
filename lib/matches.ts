/** Matches are saved only on this phone (localStorage). Nothing about them is stored on the server. */

export type Verdict = "keep_going" | "ask_out" | "slow_down" | "move_on";
export type Checkin = { at: number; interest: number; verdict: Verdict };
export type Match = {
  id: string;
  name: string;
  memory: string;
  checkins: Checkin[];
  last?: { verdict: Verdict; nextMove: string; green: string[]; red: string[] };
};

const KEY = "rizz_matches";
export const SOLID_AFTER = 3; // check-ins before the score counts as reliable

export function loadMatches(): Match[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveMatches(list: Match[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Recent chats count more: weighted average of the last 5 scores. */
export function overallScore(m: Match): number | null {
  const recent = m.checkins.slice(-5);
  if (!recent.length) return null;
  let sum = 0;
  let w = 0;
  recent.forEach((c, i) => {
    sum += c.interest * (i + 1);
    w += i + 1;
  });
  return Math.round(sum / w);
}

export function trend(m: Match): "up" | "down" | "flat" | null {
  if (m.checkins.length < 2) return null;
  const last = m.checkins[m.checkins.length - 1].interest;
  const prev = m.checkins.slice(-4, -1);
  const avg = prev.reduce((s, c) => s + c.interest, 0) / prev.length;
  if (last - avg >= 8) return "up";
  if (avg - last >= 8) return "down";
  return "flat";
}

export const VERDICTS: Record<Verdict, { label: string; color: string }> = {
  ask_out: { label: "💘 Ask them out", color: "#3ddc97" },
  keep_going: { label: "🙂 Keep it going", color: "#ffd166" },
  slow_down: { label: "🐢 Slow down", color: "#ff9a5a" },
  move_on: { label: "👋 Time to move on", color: "#ff6b6b" },
};
