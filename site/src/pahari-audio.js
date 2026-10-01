// Seeded, dependency-free soundscape for the Pahari Scroll. Everything is synthesised with the
// Web Audio API from the same seed that paints the valley: a tanpura drone, a bansuri improvising
// in Raag Pahadi, temple bells, wind and river. No files, no libraries, no network.

// ---------- seeding ----------
function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function mix(...ints) { let h = 0x9e3779b9; for (const v of ints) { h ^= (v | 0) + 0x7f4a7c15 + (h << 6) + (h >>> 2); h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; } return h >>> 0; }
const seedInt = (seed) => (typeof seed === "number" ? seed >>> 0 : fnv1a(String(seed)));

// Raag Pahadi in just intonation, relative to Sa. Index 0 is Sa; negatives reach the lower octave.
const SCALE = [[-2, 3 / 4, "P."], [-1, 5 / 6, "D."], [0, 1, "S"], [1, 9 / 8, "R"], [2, 5 / 4, "G"], [3, 3 / 2, "P"], [4, 5 / 3, "D"], [5, 2, "S'"], [6, 9 / 4, "R'"], [7, 5 / 2, "G'"]];
const RATIO = Object.fromEntries(SCALE.map(([d, r]) => [d, r]));
const GRACE = { 2: 4 / 3, 4: 15 / 8 }; // touch notes above G (Ma) and above D (Ni), used only as 80 ms kan
const BELL_RATIOS = [0.5, 1, 1.18, 1.5, 2, 2.5, 2.66, 3.0];

export function createPahariAudio({ seed, screenWidth = 1440 } = {}) {
  let ctx = null, master = null, noiseBuf = null, params = null;
  let drone = [], bell = null, timer = null, nextPhraseAt = 0, phraseCounter = 0, screenIndex = 0, volume = 0.5, running = false;

  // ---------- seeded parameters ----------
  function derive(s) {
    const R = mulberry32(seedInt(s));
    const sa = 98 + R() * 33;                                   // tanpura Sa, 98–131 Hz
    const bellF0 = 600 + R() * 300;                             // ghanta fundamental, 600–900 Hz
    const bellRatios = BELL_RATIOS.map((r, i) => (i === 1 ? 1 : r * (1 + (R() - 0.5) * 0.04)));
    return { seed: s, sa, bellF0, bellRatios, jawariRate: 0.1 + R() * 0.2, windCut: 300 + R() * 200 };
  }
  params = derive(seed ?? 7);

  // ---------- helpers ----------
  const now = () => ctx.currentTime;
  function noise() { const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; return src; }
  function gain(v, dest) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
  function lfo(rate, depth, target) { const o = ctx.createOscillator(); o.frequency.value = rate; const g = ctx.createGain(); g.gain.value = depth; o.connect(g).connect(target); o.start(); return o; }

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildDrone(); buildAmbience();
  }

  // 1. Tanpura: Sa, Pa, Sa'. Two detuned saws per string through a slowly breathing lowpass (jawari).
  function buildDrone() {
    const strings = [[1, 0.055], [1.5, 0.04], [2, 0.035]];
    drone = strings.map(([ratio, level], i) => {
      const out = gain(level, master);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1200; lp.Q.value = 0.8; lp.connect(out);
      lfo(params.jawariRate * (1 + i * 0.17), 350, lp.frequency);
      const oscs = [-4, 4].map((cents) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = params.sa * ratio; o.detune.value = cents; o.connect(lp); o.start(); return o; });
      return { ratio, oscs };
    });
  }
  function retuneDrone() { for (const s of drone) for (const o of s.oscs) o.frequency.exponentialRampToValueAtTime(params.sa * s.ratio, now() + 2); }

  // 5. Ambience: wind (lowpassed noise, breathing) and river (steady bandpassed noise).
  function buildAmbience() {
    const windOut = gain(0.05, master);
    const wind = ctx.createBiquadFilter(); wind.type = "lowpass"; wind.frequency.value = params.windCut; wind.connect(windOut);
    lfo(0.05, 120, wind.frequency); lfo(0.08, 0.02, windOut.gain);
    const w = noise(); w.connect(wind); w.start();
    const riverOut = gain(0.035, master);
    const river = ctx.createBiquadFilter(); river.type = "bandpass"; river.frequency.value = 1500; river.Q.value = 0.7; river.connect(riverOut);
    const r = noise(); r.connect(river); r.start();
  }

  // 2 + 3. Bansuri phrase: one voice per phrase, frequency slides (meend) between notes, kan grace notes,
  // vibrato ramping in, breath noise under the same envelope, slow stereo drift.
  function schedulePhrase(t0) {
    const R = mulberry32(mix(seedInt(params.seed), screenIndex, phraseCounter++));
    const saF = params.sa * 4;
    const n = 5 + Math.floor(R() * 5);
    const notes = [];
    let deg = [0, 2, 3][Math.floor(R() * 3)];
    for (let i = 0; i < n; i++) {
      if (i > 0) { const step = R() < 0.72 ? (R() < 0.5 ? -1 : 1) : (R() < 0.5 ? -2 : 2); deg = Math.max(-2, Math.min(7, deg + step)); }
      if (i === n - 1) deg = [0, 2, 3, 5][Math.floor(R() * 4)];                   // resolve to S, G, P or S'
      const dur = i === n - 1 ? 2 + R() * 2 : 0.5 + R() * 0.9;
      notes.push({ deg, dur, kan: i > 0 && R() < 0.25 });
    }
    const total = notes.reduce((s, x) => s + x.dur, 0);
    const out = gain(0, master);
    const pan = ctx.createStereoPanner(); pan.pan.value = (R() - 0.5) * 0.6; pan.connect(out);
    pan.pan.linearRampToValueAtTime((R() - 0.5) * 0.6, t0 + total);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.5; lp.connect(pan);
    const sine = ctx.createOscillator(); sine.type = "sine"; sine.connect(lp);
    const tri = ctx.createOscillator(); tri.type = "triangle"; tri.connect(gain(0.178, lp));
    const vib = ctx.createOscillator(); vib.frequency.value = 4.8 + R() * 0.6;
    const vibG = ctx.createGain(); vibG.gain.setValueAtTime(0, t0); vibG.gain.linearRampToValueAtTime(10, t0 + 0.3);
    vib.connect(vibG); vibG.connect(sine.detune); vibG.connect(tri.detune); vib.start(t0); vib.stop(t0 + total + 0.6);
    const breath = ctx.createBiquadFilter(); breath.type = "bandpass"; breath.frequency.value = saF * 2; breath.Q.value = 2;
    const breathG = gain(0.018, lp); breath.connect(breathG);
    const b = noise(); b.connect(breath); b.start(t0); b.stop(t0 + total + 0.6);
    let t = t0;
    const setF = (o, f, at, slide) => { if (slide) o.frequency.exponentialRampToValueAtTime(f, at + 0.12); else o.frequency.setValueAtTime(f, at); };
    notes.forEach((note, i) => {
      const f = saF * RATIO[note.deg];
      if (note.kan) { const gf = saF * (GRACE[note.deg] ?? RATIO[Math.min(7, note.deg + 1)]); setF(sine, gf, t, i > 0); setF(tri, gf, t, i > 0); t += 0.08; setF(sine, f, t, true); setF(tri, f, t, true); }
      else { setF(sine, f, t, i > 0); setF(tri, f, t, i > 0); }
      if (i > 0) { out.gain.setValueAtTime(0.09, t); out.gain.linearRampToValueAtTime(0.11, t + 0.08); } // soft re-articulation
      t += note.dur;
    });
    out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(0.11, t0 + 0.25);           // attack
    out.gain.setValueAtTime(0.11, t - 0.6); out.gain.exponentialRampToValueAtTime(0.0005, t + 0.5); // release
    sine.start(t0); tri.start(t0); sine.stop(t + 0.6); tri.stop(t + 0.6);
    sine.onended = () => out.disconnect();
    return total + 0.5;
  }
  function tick() {
    if (!running) return;
    if (nextPhraseAt - now() < 0.3) {
      const start = Math.max(nextPhraseAt, now() + 0.05);
      const dur = schedulePhrase(start);
      const R = mulberry32(mix(seedInt(params.seed), screenIndex, phraseCounter, 99));
      nextPhraseAt = start + dur + 3 + R() * 5;                    // 3–8 s of silence
    }
  }

  // 4. Temple bell: additive inharmonic partials with their own decays, plus a short strike burst.
  function strike(size, at) {
    const out = gain(1, master);
    params.bellRatios.forEach((r, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = params.bellF0 * r;
      const amp = size * (i === 1 ? 0.12 : 0.12 / (1 + i * 0.6));
      const tau = (i <= 1 ? 4 + size * 2 : 2.5 / (1 + i * 0.5)) * (0.8 + size * 0.4);
      const g = gain(0, out); g.gain.setValueAtTime(amp, at); g.gain.exponentialRampToValueAtTime(0.0003, at + tau);
      o.connect(g); o.start(at); o.stop(at + tau + 0.1);
    });
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = params.bellF0 * 2; bp.Q.value = 1;
    const sg = gain(0, out); sg.gain.setValueAtTime(0.08 * size, at); sg.gain.exponentialRampToValueAtTime(0.0005, at + 0.05);
    bp.connect(sg); const n = noise(); n.connect(bp); n.start(at); n.stop(at + 0.08);
    setTimeout(() => out.disconnect(), 8000);
  }

  // ---------- public API ----------
  async function start() {
    ensureContext();
    if (ctx.state !== "running") await ctx.resume();
    running = true;
    master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(master.gain.value, now()); master.gain.linearRampToValueAtTime(volume, now() + 1.5);
    nextPhraseAt = now() + 1.5;
    clearInterval(timer); timer = setInterval(tick, 100);
  }
  function stop() {
    if (!ctx || !running) return;
    running = false; clearInterval(timer); timer = null;
    master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(master.gain.value, now()); master.gain.linearRampToValueAtTime(0, now() + 1.5);
    setTimeout(() => { if (!running) ctx.suspend(); }, 1600);
  }
  function setSeed(s) { params = derive(s); phraseCounter = 0; if (ctx) retuneDrone(); }
  function setPosition(x) { screenIndex = Math.floor(x / screenWidth); }
  function ring(size = 0.5, count = 1) {
    if (!ctx || !running) return;
    let t = now() + 0.02;
    for (let i = 0; i < count; i++) { strike(size * (i === 0 ? 1 : 0.6 + Math.random() * 0.3), t); t += 0.08 + Math.random() * 0.22; }
  }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (ctx && running) { master.gain.cancelScheduledValues(now()); master.gain.linearRampToValueAtTime(volume, now() + 0.3); } }
  return { start, stop, setSeed, setPosition, ring, setVolume, get running() { return running; } };
}
