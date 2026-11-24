"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
        {status && <span className="badge">{status.left}/{status.limit} left today</span>}
      </div>
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
      </footer>

    </main>
  );
}
