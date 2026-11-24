"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Tour, { TOUR_KEY } from "./Tour";
import { VibeMusic } from "@/lib/music";
import { loadMatches, overallScore, saveMatches, SOLID_AFTER, trend, VERDICTS, type Match, type Verdict } from "@/lib/matches";

const TONES = [
  { id: "flirty", label: "😏 Flirty" },
  { id: "funny", label: "😂 Funny" },
  { id: "smooth", label: "😎 Smooth" },
  { id: "sweet", label: "🥰 Sweet" },
  { id: "bold", label: "🔥 Bold" },
  { id: "chill", label: "🧊 Chill" },
] as const;

const THEMES = [
  { id: "love", name: "💘 Love", desc: "Romantic rose, after dark", sw: ["#14101f", "#ff4f8b", "#ff9a5a"] },
  { id: "friendship", name: "🤝 Friendship", desc: "Sunny and easygoing", sw: ["#fff8e7", "#f77f00", "#f4a259"] },
  { id: "colleague", name: "💼 Colleague", desc: "Clean and professional", sw: ["#f3f5f9", "#2563eb", "#0ea5e9"] },
  { id: "family", name: "🏡 Family", desc: "Warm and homely", sw: ["#f6efe6", "#c8553d", "#e09f3e"] },
  { id: "night", name: "🌙 Night Owl", desc: "Late-night neon", sw: ["#070b1a", "#7c5cff", "#22d3ee"] },
] as const;

const LANGS = [
  "English", "Hinglish", "Hindi", "Tanglish", "Tamil", "Telugu",
  "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi",
] as const;

type Img = { mediaType: string; data: string; preview: string };
type Reply = { text: string; vibe: string };
type Analysis = { interest: number; green: string[]; red: string[]; verdict: Verdict; nextMove: string; memory: string };
type Result = { read: string; replies: Reply[]; tip: string; analysis: Analysis };
type Status = { used: number; left: number; limit: number; email?: string };

/** Shrink screenshots in the browser so uploads are fast on mobile data. */
async function toImg(file: File): Promise<Img> {
  const url = URL.createObjectURL(file);
  const el = new Image();
  await new Promise((res, rej) => {
    el.onload = res;
    el.onerror = rej;
    el.src = url;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(el.width, el.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(el.width * scale);
  canvas.height = Math.round(el.height * scale);
  canvas.getContext("2d")!.drawImage(el, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl };
}

export default function Home() {
  const [mode, setMode] = useState<"shot" | "text">("shot");
  const [images, setImages] = useState<Img[]>([]);
  const [chatText, setChatText] = useState("");
  const [tone, setTone] = useState<string>("flirty");
  const [language, setLanguage] = useState<string>("Hinglish");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  // Matches (people the user is chatting with), saved on this phone only.
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [resultMatchId, setResultMatchId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  useEffect(() => {
    const list = loadMatches();
    setMatches(list);
    const lastId = localStorage.getItem("rizz_last_match");
    if (lastId && list.some((m) => m.id === lastId)) setMatchId(lastId);
  }, []);
  function updateMatches(list: Match[]) {
    setMatches(list);
    saveMatches(list);
  }
  function selectMatch(id: string | null) {
    setMatchId(id);
    if (id) localStorage.setItem("rizz_last_match", id);
    else localStorage.removeItem("rizz_last_match");
  }
  function addMatch() {
    const name = newName.trim().slice(0, 40);
    if (!name) return;
    const m: Match = { id: crypto.randomUUID(), name, memory: "", checkins: [] };
    updateMatches([...matches, m]);
    selectMatch(m.id);
    setNewName("");
    setAdding(false);
  }
  function forgetMatch(id: string) {
    updateMatches(matches.filter((m) => m.id !== id));
    if (matchId === id) selectMatch(null);
    if (resultMatchId === id) setResultMatchId(null);
  }
  const selected = matches.find((m) => m.id === matchId) ?? null;
  const [copied, setCopied] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // null = still checking, false = needs to log in, true = logged in
  const [authed, setAuthed] = useState<boolean | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me");
      if (r.status === 401) return setAuthed(false);
      if (r.ok) {
        setStatus(await r.json());
        setAuthed(true);
      }
    } catch {
      setAuthed((a) => a ?? false);
    }
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setStatus(null);
    setResult(null);
    setAuthed(false);
  }

  // Colour theme, saved on this phone. The <head> script in layout.tsx applies it before first paint.
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (!authed) return;
    try {
      if (!localStorage.getItem(TOUR_KEY)) setTourOpen(true);
    } catch {}
  }, [authed]);

  const [theme, setTheme] = useState("love");
  const [themeOpen, setThemeOpen] = useState(false);
  useEffect(() => {
    setTheme(localStorage.getItem("rizz_theme") || "love");
  }, []);
  function pickTheme(id: string) {
    setTheme(id);
    localStorage.setItem("rizz_theme", id);
    document.documentElement.dataset.theme = id;
    const bg = THEMES.find((t) => t.id === id)?.sw[0];
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }

  // Background music that follows the selected vibe. On by default; browsers only allow
  // sound after the first tap, so it starts on the first interaction.
  const musicRef = useRef<VibeMusic | null>(null);
  const [musicOn, setMusicOn] = useState(true);
  const toneRef = useRef(tone);
  toneRef.current = tone;
  useEffect(() => {
    if (localStorage.getItem("rizz_music") === "off") setMusicOn(false);
  }, []);
  useEffect(() => {
    if (!musicOn) {
      musicRef.current?.stop();
      return;
    }
    const begin = () => {
      musicRef.current ??= new VibeMusic();
      musicRef.current.start(toneRef.current).catch(() => {});
    };
    if (musicRef.current?.playing) return;
    if (musicRef.current) {
      begin();
      return;
    }
    window.addEventListener("pointerdown", begin, { once: true });
    window.addEventListener("keydown", begin, { once: true });
    return () => {
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
    };
  }, [musicOn]);
  useEffect(() => {
    musicRef.current?.setVibe(tone);
  }, [tone]);
  useEffect(() => {
    // Pause when the app is in the background.
    const onVis = () => {
      if (!musicOn || !musicRef.current) return;
      if (document.hidden) musicRef.current.stop();
      else musicRef.current.start(toneRef.current).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [musicOn]);
  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    localStorage.setItem("rizz_music", next ? "on" : "off");
    if (next) {
      // Start right away, inside this tap, so the browser allows sound.
      musicRef.current ??= new VibeMusic();
      musicRef.current.start(toneRef.current).catch(() => {});
    }
  }

  // Install-to-home-screen support. Android Chrome fires beforeinstallprompt (one-tap install);
  // everywhere else we show the right manual steps for the user's phone and browser.
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | "inapp" | "desktop">("desktop");
  const [installed, setInstalled] = useState(false);
  const [bannerOff, setBannerOff] = useState(true);
  const [installHelp, setInstallHelp] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const ua = navigator.userAgent;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(!!standalone);
    setPlatform(
      /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Snapchat|Line\/|; wv\)/i.test(ua)
        ? "inapp"
        : /iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
          ? "ios"
          : /android/i.test(ua)
            ? "android"
            : "desktop",
    );
    setBannerOff(!!standalone || localStorage.getItem("rizz_install_dismissed") === "1");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as Event & { prompt: () => Promise<void> });
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  function dismissInstall() {
    localStorage.setItem("rizz_install_dismissed", "1");
    setBannerOff(true);
  }
  async function install() {
    if (installEvt) {
      await installEvt.prompt();
      setInstallEvt(null);
    } else {
      setInstallHelp(true);
    }
  }

  useEffect(() => {
    refresh();
    const saved = localStorage.getItem("rizz_prefs");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.tone) setTone(p.tone);
        if (p.language) setLanguage(p.language);
      } catch {}
    }
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem("rizz_prefs", JSON.stringify({ tone, language }));
  }, [tone, language]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setError("");
    try {
      const imgs = await Promise.all(list.map(toImg));
      setImages((prev) => [...prev, ...imgs].slice(0, 3));
      setMode("shot");
    } catch {
      setError("Couldn't open that image. Try another screenshot.");
    }
  }, []);

  // Paste a screenshot straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  async function generate() {
    setError("");
    if (mode === "shot" && !images.length) return setError("Add a chat screenshot first.");
    if (mode === "text" && !chatText.trim()) return setError("Paste the chat first.");
    setLoading(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 7000);
    try {
      const r = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: mode === "shot" ? images.map(({ mediaType, data }) => ({ mediaType, data })) : [],
          chatText: mode === "text" ? chatText : "",
          tone,
          language,
          goal,
          style: (() => { try { return localStorage.getItem("rizz_style") ?? ""; } catch { return ""; } })(),
          match: selected
            ? { name: selected.name, memory: selected.memory, scores: selected.checkins.slice(-10).map((c) => c.interest) }
            : null,
        }),
      });
      const data = await r.json();
      if (r.status === 401) {
        setAuthed(false);
        return;
      }
      if (data.status) setStatus((s) => ({ ...s, ...data.status }));
      if (!r.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data.result);
      try {
        if (data.result.style) localStorage.setItem("rizz_style", data.result.style);
      } catch {}
      setResultMatchId(selected?.id ?? null);
      if (selected) {
        const a: Analysis = data.result.analysis;
        updateMatches(
          matches.map((m) =>
            m.id === selected.id
              ? {
                  ...m,
                  memory: a.memory || m.memory,
                  checkins: [...m.checkins, { at: Date.now(), interest: a.interest, verdict: a.verdict }].slice(-20),
                  last: { verdict: a.verdict, nextMove: a.nextMove, green: a.green, red: a.red },
                }
              : m,
          ),
        );
      }
      setCopied(null);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
    }
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(i);
  }


  if (authed === null) {
    return (
      <main className="wrap center">
        <div className="logo"><span>Rizz</span> ✨</div>
        <span className="spinner big" />
      </main>
    );
  }
  if (!authed) return <Login onDone={refresh} />;

  return (
    <main className="wrap">
      <div className="top">
        <div className="logo">
          <span>Rizz</span> ✨
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} data-tour="toolbar">
          <button className="badge" onClick={() => setTourOpen(true)} aria-label="How Rizz works" title="How Rizz works">❔</button>
          <button className="badge" onClick={() => setThemeOpen(true)} aria-label="Change theme">🎨</button>
          <button
            className="badge"
            onClick={toggleMusic}
            aria-label={musicOn ? "Turn music off" : "Turn music on"}
            title={musicOn ? "Music on" : "Music off"}
          >
            {musicOn ? "🔊 Music" : "🔇 Music"}
          </button>
          {status && <span className="badge">{status.left}/{status.limit} left</span>}
        </div>
      </div>
      {!installed && !bannerOff && platform !== "desktop" && (
        <div className="install">
          <span>📲 Get Rizz on your home screen</span>
          <button onClick={install}>Install</button>
          <button className="x" aria-label="Dismiss" onClick={dismissInstall}>×</button>
        </div>
      )}
      <p className="hero">Stuck on what to text back? Drop the chat, pick a vibe, get 4 replies you can send right away.</p>

      <section className="card" data-tour="input">
        <div className="tabs">
          <button className={mode === "shot" ? "on" : ""} onClick={() => setMode("shot")}>📸 Screenshot</button>
          <button className={mode === "text" ? "on" : ""} onClick={() => setMode("text")}>💬 Paste text</button>
        </div>
        {mode === "shot" ? (
          <>
            <label className="drop">
              <strong>Upload chat screenshot</strong>
              Hinge, Bumble, Insta, WhatsApp… up to 3
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {!!images.length && (
              <div className="thumbs">
                {images.map((img, i) => (
                  <div className="thumb" key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt={`Screenshot ${i + 1}`} />
                    <button aria-label="Remove" onClick={() => setImages((p) => p.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <textarea
            placeholder={"Them: so what do you do on weekends?\nMe: honestly depends on the mood\nThem: hmm mysterious 👀"}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            maxLength={6000}
          />
        )}
      </section>

      <section className="card" data-tour="match">
        <p className="label">Who&apos;s this chat with?</p>
        <div className="chips">
          <button className={`chip ${!matchId ? "on" : ""}`} onClick={() => selectMatch(null)}>Just this once</button>
          {matches.map((m) => (
            <button key={m.id} className={`chip ${matchId === m.id ? "on" : ""}`} onClick={() => selectMatch(m.id)}>
              {m.name}
              {m.checkins.length > 0 && <span className="chip-score"> {overallScore(m)}</span>}
            </button>
          ))}
          {!adding && (
            <button className="chip add" onClick={() => setAdding(true)}>＋ Add person</button>
          )}
        </div>
        {adding && (
          <div className="row">
            <input
              type="text"
              autoFocus
              placeholder="Their name or nickname"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMatch()}
            />
            <button onClick={addMatch}>Save</button>
          </div>
        )}
        <p className="hint">
          {selected
            ? `Rizz remembers your chats with ${selected.name} and scores their interest over time. ${selected.checkins.length < SOLID_AFTER ? `${SOLID_AFTER - selected.checkins.length} more chat${SOLID_AFTER - selected.checkins.length === 1 ? "" : "s"} for a solid score.` : ""}`
            : "Add the person to track how interested they are across chats. Saved only on this phone."}
          {selected && (
            <>
              {" "}
              <button className="link inline" onClick={() => forgetMatch(selected.id)}>Forget {selected.name}</button>
            </>
          )}
        </p>
      </section>

      <section className="card">
        <div data-tour="vibe">
          <p className="label">Vibe</p>
          <div className="chips">
            {TONES.map((t) => (
              <button key={t.id} className={`chip ${tone === t.id ? "on" : ""}`} onClick={() => setTone(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div data-tour="language" style={{ marginTop: 14 }}>
          <p className="label">Language</p>
          <div className="chips">
            {LANGS.map((l) => (
              <button key={l} className={`chip ${language === l ? "on" : ""}`} onClick={() => setLanguage(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div data-tour="goal" style={{ marginTop: 14 }}>
          <p className="label">Goal (optional)</p>
          <input
            type="text"
            placeholder="e.g. ask for a chai date, revive a dead chat"
            value={goal}
            maxLength={200}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
      </section>

      <button className="cta" data-tour="cta" onClick={generate} disabled={loading}>
        {loading ? (<><span className="spinner" />{slow ? "AI is busy, still trying…" : "Cooking up replies…"}</>) : result ? "Get new replies ✨" : "Get replies ✨"}
      </button>
      {error && <p className="err">{error}</p>}

      {result && (
        <section className="card" ref={resultsRef} style={{ marginTop: 16 }}>
          <InterestMeter result={result} match={matches.find((m) => m.id === resultMatchId) ?? null} />
          <p className="read">👀 {result.read}</p>
          {result.replies.map((r, i) => (
            <div className="reply" key={i}>
              <div className="vibe">{r.vibe}</div>
              <p>{r.text}</p>
              <div className="acts">
                <button className={copied === i ? "done" : ""} onClick={() => copy(r.text, i)}>
                  {copied === i ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))}
          <p className="tip">💡 {result.tip}</p>
        </section>
      )}


      <Tour open={tourOpen} onClose={() => setTourOpen(false)} />

      <footer className="foot">
        100% free. Rizz never stores your screenshots; they are sent to Google Gemini to write replies.
        <br />Be kind. Respect a no. 💜
        {status?.email && (
          <>
            <br />
            Logged in as {status.email} ·{" "}
            <button className="link inline" onClick={logout}>Log out</button>
          </>
        )}
        {!installed && (
          <>
            <br />
            <button className="link" onClick={install}>📲 Install Rizz as an app</button>
          </>
        )}
      </footer>

      {themeOpen && (
        <div className="sheet-bg" onClick={() => setThemeOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Pick a theme 🎨</h2>
            <div className="themes">
              {THEMES.map((t) => (
                <button key={t.id} className={`theme-opt ${theme === t.id ? "on" : ""}`} onClick={() => pickTheme(t.id)}>
                  <div className="sw" style={{ background: t.sw[0], border: "1px solid #0002" }}>
                    <i style={{ background: t.sw[1] }} />
                    <i style={{ background: t.sw[2] }} />
                  </div>
                  <b>{t.name}</b>
                  <small>{t.desc}</small>
                </button>
              ))}
            </div>
            <button className="ghost" onClick={() => setThemeOpen(false)}>Done</button>
          </div>
        </div>
      )}

      {installHelp && (
        <div className="sheet-bg" onClick={() => setInstallHelp(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Install Rizz 📲</h2>
            {platform === "inapp" ? (
              <ol className="steps">
                <li>You&apos;re inside another app&apos;s browser (like Instagram or WhatsApp), which can&apos;t install apps.</li>
                <li>Tap the <b>⋮</b> or <b>…</b> menu at the top and choose <b>Open in Chrome</b> / <b>Open in browser</b> (on iPhone, <b>Open in Safari</b>).</li>
                <li>Then tap <b>Install</b> again.</li>
              </ol>
            ) : platform === "ios" ? (
              <ol className="steps">
                <li>Tap the <b>Share</b> button <span aria-hidden>(square with an arrow ⬆️)</span>. In Safari it&apos;s at the bottom; in Chrome it&apos;s at the top right.</li>
                <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
                <li>Tap <b>Add</b>. Rizz appears on your home screen.</li>
              </ol>
            ) : platform === "android" ? (
              <ol className="steps">
                <li>Tap the <b>⋮</b> menu at the top right of Chrome.</li>
                <li>Tap <b>Add to Home screen</b> or <b>Install app</b>.</li>
                <li>Tap <b>Install</b>. Rizz appears on your home screen.</li>
                <li>Using Samsung Internet? Tap <b>☰</b> at the bottom, then <b>Add page to</b> → <b>Home screen</b>.</li>
              </ol>
            ) : (
              <ol className="steps">
                <li>Open this page on your phone: <b>{typeof window !== "undefined" ? window.location.host : ""}</b></li>
                <li>On Android: Chrome <b>⋮</b> menu → <b>Add to Home screen</b>.</li>
                <li>On iPhone: Safari <b>Share</b> → <b>Add to Home Screen</b>.</li>
              </ol>
            )}
            <button className="ghost" onClick={() => setInstallHelp(false)}>Got it</button>
          </div>
        </div>
      )}
    </main>
  );
}

function InterestMeter({ result, match }: { result: Result; match: Match | null }) {
  const a = result.analysis;
  if (!a) return null;
  const n = match?.checkins.length ?? 0;
  const score = match && n ? overallScore(match)! : a.interest;
  const solid = !!match && n >= SOLID_AFTER;
  const t = match ? trend(match) : null;
  const v = VERDICTS[a.verdict] ?? VERDICTS.keep_going;
  const color = score >= 70 ? "var(--ok)" : score >= 45 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="meter">
      <div className="meter-top">
        <div>
          <div className="meter-label">
            {match ? `${match.name}'s interest` : "Interest in this chat"}
            {match && !solid && <span className="tag">Early read · {n}/{SOLID_AFTER} chats</span>}
            {solid && <span className="tag solid">Based on {n} chats</span>}
          </div>
          <div className="meter-score" style={{ color }}>
            {score}
            <small>/100</small>
            {t && <span className="trend">{t === "up" ? "▲ rising" : t === "down" ? "▼ dropping" : "● steady"}</span>}
          </div>
        </div>
        <div className="verdict" style={{ borderColor: v.color, color: v.color }}>{v.label}</div>
      </div>
      <div className="bar"><div style={{ width: `${score}%`, background: color }} /></div>
      {a.nextMove && <p className="next">➡️ {a.nextMove}</p>}
      {(a.green.length > 0 || a.red.length > 0) && (
        <div className="signals">
          {a.green.map((g, i) => <span key={`g${i}`} className="sig good">✓ {g}</span>)}
          {a.red.map((r, i) => <span key={`r${i}`} className="sig bad">✗ {r}</span>)}
        </div>
      )}
      {!match && <p className="hint">Tip: add this person above to track their interest over 3+ chats.</p>}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"details" | "code">("details");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const d = await r.json().catch(() => ({ error: "Server error. Please try again." }));
      if (!r.ok) throw new Error(d.error);
      setStep("code");
      setCode("");
      setCooldown(30);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length !== 6) return;
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      const d = await r.json().catch(() => ({ error: "Server error. Please try again." }));
      if (!r.ok) throw new Error(d.error);
      onDone();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't verify the code.");
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <div className="top">
        <div className="logo"><span>Rizz</span> ✨</div>
      </div>
      <p className="hero">Your AI wingman for dating chats. Log in to get started, it&apos;s free.</p>
      <section className="card">
        {step === "details" ? (
          <form onSubmit={(e) => { e.preventDefault(); sendCode(); }}>
            <p className="label">Email</p>
            <input type="text" inputMode="email" autoComplete="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="label" style={{ marginTop: 14 }}>Mobile number</p>
            <div className="phone">
              <span>+91</span>
              <input type="text" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210"
                value={phone} maxLength={16} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button className="cta" style={{ marginTop: 18 }} disabled={busy || !email || !phone}>
              {busy ? (<><span className="spinner" />Sending code…</>) : "Send login code"}
            </button>
            <p className="hint">We&apos;ll email you a 6-digit code. Your mobile number is saved with your account.</p>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }}>
            <p className="label">Enter the code</p>
            <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>We sent a 6-digit code to <b>{email}</b>. Check spam if you don&apos;t see it.</p>
            <input className="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
              value={code} maxLength={6} autoFocus
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v);
              }} />
            <button className="cta" style={{ marginTop: 18 }} disabled={busy || code.length !== 6}>
              {busy ? (<><span className="spinner" />Checking…</>) : "Log in"}
            </button>
            <div className="row-links">
              <button type="button" className="link inline" disabled={cooldown > 0 || busy} onClick={sendCode}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
              <button type="button" className="link inline" onClick={() => { setStep("details"); setError(""); }}>Change email</button>
            </div>
          </form>
        )}
        {error && <p className="err">{error}</p>}
      </section>
      <footer className="foot">By logging in you agree to be kind. Rizz never stores your chats or screenshots.</footer>
    </main>
  );
}
