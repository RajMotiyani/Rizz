/**
 * Background music made live in the browser with the Web Audio API.
 * No audio files and no licensing: each vibe is a small generative loop
 * (chords, a melody pattern and drums) with its own tempo and sound.
 */

type Wave = OscillatorType;

type Style = {
  bpm: number;
  chords: number[][]; // MIDI notes, one chord per bar
  padWave: Wave;
  padVol: number;
  lead: { wave: Wave; vol: number; pattern: (number | null)[]; octave: number; decay: number } | null;
  bass: { wave: Wave; vol: number; pattern: (0 | 1)[] } | null;
  kick: (0 | 1)[] | null;
  snare: (0 | 1)[] | null;
  hat: (0 | 1)[] | null;
  filter: number; // low-pass cutoff in Hz
};

// 16 steps per bar (16th notes). Lead pattern values are indexes into the current chord (+ octave).
const STYLES: Record<string, Style> = {
  // Slow R&B: soft pads, sparse lead, gentle beat
  flirty: {
    bpm: 82,
    chords: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]],
    padWave: "sine", padVol: 0.05,
    lead: { wave: "triangle", vol: 0.05, octave: 12, decay: 0.5, pattern: [0, null, null, 2, null, null, 1, null, 3, null, null, 2, null, null, null, null] },
    bass: { wave: "sine", vol: 0.12, pattern: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0] },
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    filter: 2200,
  },
  // Bouncy, cartoonish plucks
  funny: {
    bpm: 124,
    chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    padWave: "square", padVol: 0.0,
    lead: { wave: "square", vol: 0.035, octave: 12, decay: 0.12, pattern: [0, null, 1, null, 2, null, 1, 0, null, 2, null, 1, 2, null, 0, null] },
    bass: { wave: "square", vol: 0.05, pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0] },
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    filter: 3500,
  },
  // Lo-fi jazz: 7th chords, mellow keys, lazy beat
  smooth: {
    bpm: 74,
    chords: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 60, 64, 67]],
    padWave: "triangle", padVol: 0.045,
    lead: { wave: "sine", vol: 0.05, octave: 12, decay: 0.7, pattern: [null, null, 3, null, null, 2, null, null, null, 1, null, null, 2, null, null, null] },
    bass: { wave: "sine", vol: 0.13, pattern: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0] },
    kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    filter: 1400,
  },
  // Music box: high, twinkly arpeggios, no drums
  sweet: {
    bpm: 92,
    chords: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]],
    padWave: "sine", padVol: 0.03,
    lead: { wave: "sine", vol: 0.09, octave: 24, decay: 0.45, pattern: [0, null, 1, null, 2, null, 1, null, 0, null, 1, null, 2, null, 3, null] },
    bass: null,
    kick: null,
    snare: null,
    hat: null,
    filter: 5000,
  },
  // Punchy minor groove
  bold: {
    bpm: 100,
    chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]],
    padWave: "sawtooth", padVol: 0.025,
    lead: { wave: "sawtooth", vol: 0.025, octave: 12, decay: 0.15, pattern: [0, null, null, 0, null, null, 2, null, 0, null, null, 0, null, 1, null, 2] },
    bass: { wave: "sawtooth", vol: 0.06, pattern: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0] },
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
    filter: 1800,
  },
  // Ambient: long pads, slow notes, no drums
  chill: {
    bpm: 60,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [62, 65, 69, 72]],
    padWave: "sine", padVol: 0.1,
    lead: { wave: "sine", vol: 0.07, octave: 12, decay: 1.6, pattern: [2, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null] },
    bass: { wave: "sine", vol: 0.14, pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    kick: null,
    snare: null,
    hat: null,
    filter: 1200,
  },
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export class VibeMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private style: Style = STYLES.chill;
  private step = 0;
  private nextTime = 0;
  playing = false;

  private init() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.bus = ctx.createBiquadFilter();
    this.bus.type = "lowpass";
    this.bus.connect(this.master);
    const len = ctx.sampleRate * 0.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    return ctx;
  }

  setVibe(vibe: string) {
    this.style = STYLES[vibe] ?? STYLES.chill;
    if (this.ctx && this.bus) this.bus.frequency.setTargetAtTime(this.style.filter, this.ctx.currentTime, 0.3);
    this.step = 0; // restart the bar so the new vibe starts cleanly
  }

  /** Must be called from a user gesture (tap/click) because of browser autoplay rules. */
  async start(vibe: string) {
    const ctx = this.init();
    if (ctx.state === "suspended") await ctx.resume();
    this.setVibe(vibe);
    this.bus!.frequency.value = this.style.filter;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setTargetAtTime(0.7, ctx.currentTime, 0.6); // fade in
    if (this.timer) return;
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (!this.ctx || !this.master) return;
    this.playing = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); // fade out
    const t = this.timer;
    this.timer = null;
    setTimeout(() => {
      if (t) clearInterval(t);
      if (!this.playing) this.ctx?.suspend();
    }, 800);
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.style.bpm / 4;
      this.step = (this.step + 1) % 64; // 4 bars
    }
  }

  private playStep(step: number, t: number) {
    const s = this.style;
    const bar = Math.floor(step / 16) % s.chords.length;
    const i = step % 16;
    const chord = s.chords[bar];
    const stepLen = 60 / s.bpm / 4;

    if (i === 0 && s.padVol > 0) {
      for (const n of chord) this.tone(hz(n), t, stepLen * 16, s.padWave, s.padVol, 0.4, stepLen * 16 * 0.9);
    }
    const leadNote = s.lead?.pattern[i];
    if (s.lead && leadNote !== null && leadNote !== undefined) {
      const n = chord[leadNote % chord.length] + s.lead.octave;
      this.tone(hz(n), t, s.lead.decay, s.lead.wave, s.lead.vol, 0.005, s.lead.decay);
    }
    if (s.bass?.pattern[i]) this.tone(hz(chord[0] - 24), t, stepLen * 3, s.bass.wave, s.bass.vol, 0.01, stepLen * 2.5);
    if (s.kick?.[i]) this.kick(t);
    if (s.snare?.[i]) this.noiseHit(t, 0.18, 1800, 0.09);
    if (s.hat?.[i]) this.noiseHit(t, 0.04, 8000, 0.025);
  }

  private tone(freq: number, t: number, dur: number, wave: Wave, vol: number, attack: number, release: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    osc.connect(g).connect(this.bus!);
    osc.start(t);
    osc.stop(t + Math.max(dur, attack + release) + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(this.master!); // skip the filter so the kick stays punchy
    osc.start(t);
    osc.stop(t + 0.35);
  }

  private noiseHit(t: number, dur: number, cutoff: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
