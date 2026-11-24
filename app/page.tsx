"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VibeMusic } from "@/lib/music";

const TONES = [
  { id: "flirty", label: "😏 Flirty" },
  { id: "funny", label: "😂 Funny" },
  { id: "smooth", label: "😎 Smooth" },
  { id: "sweet", label: "🥰 Sweet" },
  { id: "bold", label: "🔥 Bold" },
  { id: "chill", label: "🧊 Chill" },
] as const;

const LANGS = [
  "English", "Hinglish", "Hindi", "Tanglish", "Tamil", "Telugu",
  "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi",
] as const;

type Img = { mediaType: string; data: string; preview: string };
type Reply = { text: string; vibe: string };
type Result = { read: string; replies: Reply[]; tip: string };
type Status = { used: number; left: number; limit: number };

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
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/me");
    if (r.ok) setStatus(await r.json());
  }, []);

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
        }),
      });
      const data = await r.json();
      if (data.status) setStatus(data.status);
      if (!r.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data.result);
      setCopied(null);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
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


  return (
    <main className="wrap">
      <div className="top">
        <div className="logo">
          <span>Rizz</span> ✨
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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

      <section className="card">
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

      <section className="card">
        <p className="label">Vibe</p>
        <div className="chips">
          {TONES.map((t) => (
            <button key={t.id} className={`chip ${tone === t.id ? "on" : ""}`} onClick={() => setTone(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="label" style={{ marginTop: 14 }}>Language</p>
        <div className="chips">
          {LANGS.map((l) => (
            <button key={l} className={`chip ${language === l ? "on" : ""}`} onClick={() => setLanguage(l)}>
              {l}
            </button>
          ))}
        </div>
        <p className="label" style={{ marginTop: 14 }}>Goal (optional)</p>
        <input
          type="text"
          placeholder="e.g. ask for a chai date, revive a dead chat"
          value={goal}
          maxLength={200}
          onChange={(e) => setGoal(e.target.value)}
        />
      </section>

      <button className="cta" onClick={generate} disabled={loading}>
        {loading ? (<><span className="spinner" />Cooking up replies…</>) : result ? "Get new replies ✨" : "Get replies ✨"}
      </button>
      {error && <p className="err">{error}</p>}

      {result && (
        <section className="card" ref={resultsRef} style={{ marginTop: 16 }}>
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


      <footer className="foot">
        100% free. Rizz never stores your screenshots; they are sent to Google Gemini to write replies.
        <br />Be kind. Respect a no. 💜
        {!installed && (
          <>
            <br />
            <button className="link" onClick={install}>📲 Install Rizz as an app</button>
          </>
        )}
      </footer>

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
