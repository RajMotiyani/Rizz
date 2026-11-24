"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export const TOUR_KEY = "rizz_tour_done";

type Step = { target?: string; title: string; body: string };

const STEPS: Step[] = [
  {
    title: "Welcome to Rizz ✨",
    body: "Your AI wingman for dating chats. Here's a 30-second tour of what each part does. You can skip anytime.",
  },
  {
    target: "input",
    title: "1. Drop the chat",
    body: "Upload up to 3 screenshots from WhatsApp, Insta, Hinge or Bumble. Or switch to “Paste text” and paste the messages.",
  },
  {
    target: "match",
    title: "2. Who's it with?",
    body: "Add the person's name and Rizz remembers your chats with them. After a few chats you get an Interest Score that tells you whether to keep going, ask them out or move on. Saved only on this phone.",
  },
  {
    target: "vibe",
    title: "3. Pick a vibe",
    body: "Flirty, funny, smooth, sweet, bold or chill. The replies (and the background music) follow the vibe.",
  },
  {
    target: "language",
    title: "4. Pick a language",
    body: "Get replies in English, Hinglish, Hindi, Tamil, Telugu and more, written the way people actually text.",
  },
  {
    target: "goal",
    title: "5. Add a goal (optional)",
    body: "Tell Rizz what you want, like “ask for a chai date” or “revive a dead chat”, and the replies steer that way.",
  },
  {
    target: "cta",
    title: "6. Get replies",
    body: "Tap here for 4 ready-to-send replies plus a quick read of the chat. Tap Copy on the one you like and paste it into your chat.",
  },
  {
    target: "toolbar",
    title: "Make it yours",
    body: "🎨 changes the theme, 🔊 turns the music on or off, and the counter shows how many free replies you have left today. Tap ❔ to see this tour again.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

export default function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[i];

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  const measure = useCallback(() => {
    if (!step?.target) return setRect(null);
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const t1 = setTimeout(measure, 350);
    const t2 = setTimeout(measure, 700);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, measure]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open || !step) return null;
  const last = i === STEPS.length - 1;
  const pad = 6;

  // Place the tip below the highlighted box if there's room, otherwise above it.
  let tipStyle: React.CSSProperties = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  if (rect) {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const below = rect.top + rect.height + pad + 12;
    tipStyle = below + 200 < vh
      ? { top: below, left: "50%", transform: "translateX(-50%)" }
      : { bottom: vh - rect.top + pad + 12, left: "50%", transform: "translateX(-50%)" };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="How Rizz works">
      {rect ? (
        <div
          className="tour-hole"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-tip" style={tipStyle}>
        <div className="tour-head">
          <strong>{step.title}</strong>
          <span className="tour-count">{i + 1}/{STEPS.length}</span>
        </div>
        <p>{step.body}</p>
        <div className="tour-dots">
          {STEPS.map((_, n) => <span key={n} className={n === i ? "on" : ""} />)}
        </div>
        <div className="tour-acts">
          {!last && <button className="tour-skip" onClick={finish}>Skip tutorial</button>}
          <span style={{ flex: 1 }} />
          {i > 0 && <button className="tour-back" onClick={() => setI(i - 1)}>Back</button>}
          <button className="tour-next" onClick={() => (last ? finish() : setI(i + 1))}>
            {i === 0 ? "Show me" : last ? "Got it 🚀" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
