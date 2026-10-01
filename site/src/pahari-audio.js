// Seeded, dependency-free soundscape for the Pahari Scroll: a Pahadi bansuri folk track synthesised
// with the Web Audio API from the same seed that paints the valley. Harmonium-style drone, a bright
// bansuri playing rhythmic call-and-response phrases in Raag Pahadi, a light hudka pulse, a harmonic
// temple ghanta, and the river. No files, no libraries, no network.

// ---------- seeding ----------
function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function mix(...ints) { let h = 0x9e3779b9; for (const v of ints) { h ^= (v | 0) + 0x7f4a7c15 + (h << 6) + (h >>> 2); h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; } return h >>> 0; }
const seedInt = (seed) => (typeof seed === "number" ? seed >>> 0 : fnv1a(String(seed)));
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
const rint = (R, a, b) => a + Math.floor(R() * (b - a + 1));
const dB = (d) => Math.pow(10, d / 20);

// Raag Pahadi, just intonation. Degrees 0..7 = S R G P D S' R' G'. No touch notes.
export const SARGAM = ["S", "R", "G", "P", "D", "S'", "R'", "G'"];
const RATIO = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];

// ---------- composition (pure, so it can be inspected in Node) ----------
// A phrase is two bars of 4/4 on an eighth-note grid: 16 slots, the last four a held half note.
function makeRhythm(R) {
  for (let tries = 0; tries < 60; tries++) {
    const lens = []; let rem = 12;
    while (rem > 0) { const r = R(); const l = Math.min(rem, r < 0.3 ? 1 : r < 0.8 ? 2 : 3); lens.push(l); rem -= l; }
    if (lens.length >= 5 && lens.length <= 9) return [...lens, 4];
  }
  return [2, 2, 2, 2, 2, 2, 4];
}
// Mostly stepwise runs of 3–5 steps in one direction before turning; arches are the most common shape.
function makeContour(R, n, phraseIdx) {
  const shape = R() < 0.5 ? "arch" : R() < 0.5 ? "ascend" : "descend";
  let cur = shape === "descend" ? pick(R, [4, 5]) : shape === "arch" ? pick(R, [0, 1, 2]) : pick(R, [0, 1]);
  let dir = shape === "descend" ? -1 : 1, run = rint(R, 3, 5);
  const top = shape === "arch" ? pick(R, [3, 5]) : 7, bottom = 0;
  const wantS = phraseIdx % 2 === 0 ? R() < 0.7 : R() < 0.3;
  const degs = [];
  let target = null;
  for (let i = 0; i < n - 1; i++) {
    degs.push(cur);
    const remaining = n - 1 - i; // notes left before the final one
    if (target === null && remaining <= 3) target = wantS ? 0 : [0, 2, 3].reduce((b, d) => (Math.abs(d - cur) < Math.abs(b - cur) ? d : b), 0);
    const step = R() < 0.8 ? 1 : 2;
    let next;
    if (target !== null && Math.abs(cur - target) >= remaining) next = cur + Math.sign(target - cur) * Math.min(2, Math.abs(cur - target)); // walk home
    else {
      next = cur + dir * step;
      if (next > top || next < bottom || --run <= 0) { dir = -dir; run = rint(R, 3, 5); next = Math.max(bottom, Math.min(top, cur + dir * step)); }
    }
    cur = next;
  }
  const last = degs[degs.length - 1];
  if (target === null) target = wantS ? 0 : [0, 2, 3].reduce((b, d) => (Math.abs(d - last) < Math.abs(b - last) ? d : b), 0);
  degs.push(Math.abs(last - target) <= 2 ? target : [0, 2, 3].reduce((b, d) => (Math.abs(d - last) < Math.abs(b - last) ? d : b), 0));
  return degs;
}
function makePhrase(R, phraseIdx) {
  const lens = makeRhythm(R), degs = makeContour(R, lens.length, phraseIdx);
  let kanBudget = Math.floor(lens.length / 5);
  return lens.map((len, i) => {
    const deg = degs[i], prev = degs[i - 1];
    const meend = i > 0 && ((prev === 2 && deg === 1) || (prev === 4 && deg === 3));
    const kan = !meend && i > 0 && kanBudget > 0 && R() < 0.2 && deg < 7 ? (kanBudget--, true) : false;
    return { deg, len, meend, kan, gamak: false };
  });
}
function vary(R, phrase) {
  const out = phrase.map((n) => ({ ...n }));
  const changes = rint(R, 1, 2);
  for (let k = 0; k < changes; k++) { const i = rint(R, 0, out.length - 2); out[i].deg = Math.max(0, Math.min(7, out[i].deg + (R() < 0.5 ? -1 : 1))); out[i].meend = false; }
  return out;
}
// One round = A, A', B, A. Returns phrases plus whether the final note carries a gamak.
export function composeRound(seed, screenIndex, round) {
  const R = mulberry32(mix(seedInt(seed), screenIndex, round));
  const A = makePhrase(R, 0), A2 = vary(R, A), B = makePhrase(R, 2);
  const phrases = [A, A2, B, A.map((n) => ({ ...n }))];
  if (R() < 0.2) phrases[3][phrases[3].length - 1].gamak = true;
  const restBars = rint(R, 2, 4), drops = Array.from({ length: 32 }, () => R() < 0.3);
  return { phrases, restBars, drops };
}
export const sargam = (phrase) => phrase.map((n) => (n.kan ? "(" + SARGAM[Math.min(7, n.deg + 1)] + ")" : "") + SARGAM[n.deg] + (n.meend ? "~" : "") + "·".repeat(n.len - 1) + (n.gamak ? "≈" : "")).join(" ");

// ---------- the instrument ----------
export function createPahariAudio({ seed, screenWidth = 1440 } = {}) {
  let ctx = null, master = null, noiseBuf = null, params = null, bus = {};
  let drone = [], timer = null, running = false, volume = 0.9;
  let screenIndex = 0, roundCounter = 0, lastRing = -Infinity;
  let queue = null; // { phrases, phraseIdx, nextAt, restBars, drops }

  function derive(s) {
    const R = mulberry32(seedInt(s));
    return { seed: s, sa: 130 + R() * 35, bpm: 90 + R() * 15, bellF0: 800 + R() * 300 };
  }
  params = derive(seed ?? 7);
  const now = () => ctx.currentTime;
  const beat = () => 60 / params.bpm;
  const flute = (deg) => params.sa * 4 * RATIO[deg];
  function gain(v, dest) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
  function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.ratio.value = 4; limiter.knee.value = 6; limiter.attack.value = 0.003; limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    master = gain(0, limiter);
    // Mix targets relative to the flute: drone -14 dB, percussion -18 dB, bell -10 dB, river -30 dB.
    const ref = 0.25;
    bus = { flute: gain(ref, master), drone: gain(ref * dB(-14), master), perc: gain(ref * dB(-18), master), bell: gain(ref * dB(-10), master), river: gain(ref * dB(-30), master) };
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildDrone(); buildRiver();
  }

  // Drone: harmonium-style pad. Sa and Pa (and Sa' at half gain), three triangles each at -6/0/+6 cents,
  // through a static 2.5 kHz lowpass. Nothing moves.
  function buildDrone() {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2500; lp.connect(bus.drone);
    drone = [[1, 0.3], [1.5, 0.24], [2, 0.15]].map(([ratio, level]) => {
      const g = gain(level, lp);
      const oscs = [-6, 0, 6].map((c) => { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = params.sa * ratio; o.detune.value = c; o.connect(g); o.start(); return o; });
      return { ratio, oscs };
    });
  }
  function retuneDrone() { for (const s of drone) for (const o of s.oscs) o.frequency.exponentialRampToValueAtTime(params.sa * s.ratio, now() + 1); }

  // River only: bandpassed noise, 1.2–2 kHz, steady.
  function buildRiver() {
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1550; bp.Q.value = 1.9; bp.connect(bus.river);
    const n = noise(); n.connect(bp); n.start();
  }

  // Bansuri: sine + triangle 0.4 + second-harmonic sine 0.25, lowpass 4 kHz, per-note ADSR
  // (40 ms attack, short decay to 0.8, 150 ms release), vibrato 5.5 Hz / 12 cents on notes > 600 ms,
  // a little breath, meend slides on G→R and D→P, kan grace notes, optional gamak on a final note.
  function schedulePhrase(phrase, t0) {
    const e = beat() / 2, total = phrase.reduce((s, n) => s + n.len, 0) * e;
    const env = gain(0, bus.flute);
    const pan = ctx.createStereoPanner(); pan.pan.value = -0.15; pan.pan.linearRampToValueAtTime(0.15, t0 + total); pan.connect(env);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4000; lp.connect(pan);
    const sine = ctx.createOscillator(); sine.type = "sine"; sine.connect(lp);
    const tri = ctx.createOscillator(); tri.type = "triangle"; tri.connect(gain(0.4, lp));
    const h2 = ctx.createOscillator(); h2.type = "sine"; h2.connect(gain(0.25, lp));
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vibG = ctx.createGain(); vibG.gain.value = 0;
    vib.connect(vibG); vibG.connect(sine.detune); vibG.connect(tri.detune); vibG.connect(h2.detune); vib.start(t0); vib.stop(t0 + total + 0.4);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = params.sa * 8; bp.Q.value = 2; bp.connect(gain(0.012, lp));
    const br = noise(); br.connect(bp); br.start(t0); br.stop(t0 + total + 0.4);
    const setF = (f, at, slide) => { for (const [o, m] of [[sine, 1], [tri, 1], [h2, 2]]) { if (slide) o.frequency.exponentialRampToValueAtTime(f * m, at + 0.12); else o.frequency.setValueAtTime(f * m, at); } };
    let t = t0;
    phrase.forEach((n, i) => {
      const f = flute(n.deg), dur = n.len * e, last = i === phrase.length - 1;
      if (n.meend) { setF(f, t, true); }                                   // slide in, no re-attack
      else {
        if (i > 0) { env.gain.setValueAtTime(0.8, t - 0.15); env.gain.linearRampToValueAtTime(0, t - 0.005); } // release of the previous note
        if (n.kan) { setF(flute(Math.min(7, n.deg + 1)), t, false); setF(f, t + 0.08, false); } else setF(f, t, false);
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.04); env.gain.linearRampToValueAtTime(0.8, t + 0.12);
      }
      if (n.gamak) { const up = flute(Math.min(7, n.deg + 1)); for (let k = 0; k < 3; k++) { setF(up, t + 0.07 + k * 0.14, false); setF(f, t + 0.14 + k * 0.14, false); } }
      if (dur > 0.6) { vibG.gain.setValueAtTime(0, t + 0.2); vibG.gain.linearRampToValueAtTime(12, t + 0.45); vibG.gain.setValueAtTime(12, t + dur - 0.1); vibG.gain.linearRampToValueAtTime(0, t + dur); }
      else vibG.gain.setValueAtTime(0, t);
      if (last) { env.gain.setValueAtTime(0.8, t + dur - 0.15); env.gain.linearRampToValueAtTime(0, t + dur); }
      t += dur;
    });
    for (const o of [sine, tri, h2]) { o.start(t0); o.stop(t + 0.3); }
    sine.onended = () => env.disconnect();
  }

  // Percussion: hudka thump on beats 1 and 3, a filtered tick on the off-beats with seeded drops.
  function schedulePulse(t0, drops, offset) {
    const b = beat();
    for (let k = 0; k < 8; k++) {
      const at = t0 + k * b;
      if (k % 2 === 0) {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(70, at + 0.06);
        const g = gain(0, bus.perc); g.gain.setValueAtTime(1.6, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
        o.connect(g); o.start(at); o.stop(at + 0.2);
      }
      if (!drops[(offset + k) % drops.length]) {
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 3;
        const g = gain(0, bus.perc); g.gain.setValueAtTime(0.8, at + b / 2); g.gain.exponentialRampToValueAtTime(0.001, at + b / 2 + 0.04);
        bp.connect(g); const n = noise(); n.connect(bp); n.start(at + b / 2); n.stop(at + b / 2 + 0.05);
      }
    }
  }

  // Lookahead scheduler: rounds of four phrases with the pulse underneath, then 2–4 bars of rest.
  function tick() {
    if (!running) return;
    if (!queue) queue = { ...composeRound(params.seed, screenIndex, roundCounter++), phraseIdx: 0, nextAt: now() + 0.3 };
    if (queue.nextAt - now() < 0.5) {
      const phrase = queue.phrases[queue.phraseIdx];
      schedulePhrase(phrase, queue.nextAt);
      schedulePulse(queue.nextAt, queue.drops, queue.phraseIdx * 8);
      queue.nextAt += 8 * beat();
      if (++queue.phraseIdx === 4) { const restAt = queue.nextAt + queue.restBars * 4 * beat(); queue = null; pendingRoundAt = restAt; }
    }
    if (!queue && pendingRoundAt && now() > pendingRoundAt - 0.5) { queue = { ...composeRound(params.seed, screenIndex, roundCounter++), phraseIdx: 0, nextAt: pendingRoundAt }; pendingRoundAt = 0; }
  }
  let pendingRoundAt = 0;

  // Temple ghanta: harmonic partials 1, 2, 3, 4.2, 5.4, 2.5 s decay, 20 ms strike noise.
  function strike(size, at) {
    const out = gain(1, bus.bell);
    [1, 2, 3, 4.2, 5.4].forEach((r, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = params.bellF0 * r;
      const g = gain(0, out); g.gain.setValueAtTime(1.3 * size / (1 + i * 0.8), at); g.gain.exponentialRampToValueAtTime(0.0005, at + 2.5 / (1 + i * 0.25));
      o.connect(g); o.start(at); o.stop(at + 2.6);
    });
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = params.bellF0 * 2; bp.Q.value = 1;
    const g = gain(0, out); g.gain.setValueAtTime(0.3 * size, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.02);
    bp.connect(g); const n = noise(); n.connect(bp); n.start(at); n.stop(at + 0.03);
    setTimeout(() => out.disconnect(), 3500);
  }

  // ---------- public API ----------
  async function start() {
    ensureContext();
    if (ctx.state !== "running") await ctx.resume();
    running = true; queue = null; pendingRoundAt = 0;
    master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(master.gain.value, now()); master.gain.linearRampToValueAtTime(volume, now() + 1.2);
    clearInterval(timer); timer = setInterval(tick, 100);
  }
  function stop() {
    if (!ctx || !running) return;
    running = false; clearInterval(timer); timer = null;
    master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(master.gain.value, now()); master.gain.linearRampToValueAtTime(0, now() + 1.5);
    setTimeout(() => { if (!running) ctx.suspend(); }, 1600);
  }
  function setSeed(s) { params = derive(s); roundCounter = 0; if (ctx) retuneDrone(); }
  function setPosition(x) { screenIndex = Math.floor(x / screenWidth); }
  function ring(size = 0.5, count = 1) {
    if (!ctx || !running || now() - lastRing < 20) return;
    lastRing = now();
    let t = now() + 0.02;
    for (let i = 0; i < count; i++) { strike(size * (i === 0 ? 1 : 0.7), t); t += 0.08 + Math.random() * 0.22; }
  }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (ctx && running) { master.gain.cancelScheduledValues(now()); master.gain.linearRampToValueAtTime(volume, now() + 0.3); } }
  return { start, stop, setSeed, setPosition, ring, setVolume, get running() { return running; } };
}
