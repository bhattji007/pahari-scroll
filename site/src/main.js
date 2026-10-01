import { seedFromString } from "./prng.js";
import { W, H, LAYERS, BANDS, makeTerrain, generateChunk } from "./chunk.js";
import { chunkLayerString, defsString, skeletonString, standaloneSvg } from "./render.js";
import { aipanFrame } from "./aipan.js";

const BAND = 28;
const svg = document.getElementById("scene");
const frame = document.getElementById("frame");
const seedLabel = document.querySelector("#seed b");
const posLabel = document.getElementById("pos");

// ---------- state from the URL ----------
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const seedStr = q.get("seed") ?? String(Math.floor(Math.random() * 1e6));
  const seed = /^\d+$/.test(seedStr) ? Number(seedStr) >>> 0 : seedFromString(seedStr);
  const x = Number(q.get("x") ?? 0) || 0;
  return { seedStr, seed, x };
}
let { seedStr, seed, x } = readHash();
let terrain = makeTerrain(seed);
const chunks = new Map(); // c -> { el, data }
let writeHashTimer = null;
function writeHash() {
  clearTimeout(writeHashTimer);
  writeHashTimer = setTimeout(() => history.replaceState(null, "", `#seed=${encodeURIComponent(seedStr)}&x=${Math.round(x)}`), 250);
}

// ---------- viewport ----------
let vw = H; // viewBox width in scene units
function layout() {
  vw = H * (innerWidth / innerHeight);
  svg.setAttribute("viewBox", `${x} 0 ${vw} ${H}`);
  frame.innerHTML = aipanFrame(innerWidth, innerHeight, BAND);
  ensureChunks();
}
function setX(nx) {
  x = nx;
  svg.setAttribute("viewBox", `${x} 0 ${vw} ${H}`);
  posLabel.textContent = (x / W).toFixed(2);
  ensureChunks();
  revealFigures();
  writeHash();
}

// ---------- building animation ----------
// Each figure waits, invisible, until its ground point scrolls into view; then it is "built".
// After a jump (load, reseed, home) the visible figures build in a left-to-right sweep instead.
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
let pending = []; // { el, wx, c }
let sweep = true;
function revealFigures() {
  if (!pending.length) return;
  const lo = x - 40, hi = x + vw + 40, keep = [];
  for (const f of pending) {
    if (f.wx < lo || f.wx > hi) { keep.push(f); continue; }
    if (!REDUCED) f.el.style.setProperty("--d", sweep ? `${Math.round(((f.wx - x) / vw) * 900)}ms` : "0ms");
    f.el.classList.add("in");
  }
  pending = keep;
  sweep = false;
}
function sweepNext() { sweep = true; }
// ---------- chunk lifecycle ----------
const MIST = 0.6;
const layerEls = {};
function ensureChunks() {
  const c0 = Math.floor((x - W * 0.5) / W), c1 = Math.floor((x + vw + W * 0.5) / W);
  for (let c = c0; c <= c1; c++) if (!chunks.has(c)) addChunk(c);
  for (const [c, { els }] of chunks) if (c < c0 - 1 || c > c1 + 1) { els.forEach((el) => el.remove()); chunks.delete(c); pending = pending.filter((f) => f.c !== c); }
  // the translucent bands span every loaded chunk as one element each
  const loaded = [...chunks.keys()];
  const bx0 = Math.min(...loaded) * W, bx1 = (Math.max(...loaded) + 1) * W;
  for (const b of BANDS) { const el = document.getElementById(b.id); el.setAttribute("x", bx0); el.setAttribute("width", bx1 - bx0); el.setAttribute("opacity", b.id === "gold" ? b.opacity : b.opacity * MIST); }
}
function addChunk(c) {
  const data = generateChunk(seed, c, terrain);
  const els = LAYERS.map((layer) => {
    const tpl = document.createElementNS("http://www.w3.org/2000/svg", "g");
    tpl.innerHTML = chunkLayerString(data, layer);
    const el = tpl.firstChild, parent = layerEls[layer];
    const after = [...parent.children].find((g) => Number(g.dataset.chunk) > c);
    parent.insertBefore(el, after ?? null);
    for (const fig of el.querySelectorAll(".fig")) pending.push({ el: fig, wx: c * W + Number(fig.dataset.x), c });
    return el;
  });
  chunks.set(c, { els, data });
}
function reseed(newSeedStr) {
  seedStr = newSeedStr;
  seed = /^\d+$/.test(seedStr) ? Number(seedStr) >>> 0 : seedFromString(seedStr);
  terrain = makeTerrain(seed);
  for (const { els } of chunks.values()) els.forEach((el) => el.remove());
  chunks.clear();
  pending = [];
  seedLabel.textContent = seedStr;
  sweepNext();
  setX(0);
}

// ---------- input ----------
let auto = false, lastT = 0;
function tick(t) {
  if (auto) { const dt = Math.min(50, t - lastT); setX(x + dt * 0.04); }
  lastT = t;
  requestAnimationFrame(tick);
}
addEventListener("wheel", (e) => { e.preventDefault(); setX(x + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.2); }, { passive: false });
let drag = null;
svg.addEventListener("pointerdown", (e) => { drag = { px: e.clientX, x0: x }; svg.setPointerCapture(e.pointerId); });
svg.addEventListener("pointermove", (e) => { if (drag) setX(drag.x0 - (e.clientX - drag.px) * (vw / innerWidth)); });
svg.addEventListener("pointerup", () => (drag = null));
svg.addEventListener("pointercancel", () => (drag = null));
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") setX(x + 120);
  if (e.key === "ArrowLeft") setX(x - 120);
  if (e.key === " ") { auto = !auto; document.getElementById("auto").classList.toggle("on", auto); e.preventDefault(); }
});
addEventListener("resize", layout);
addEventListener("hashchange", () => { const h = readHash(); if (h.seedStr !== seedStr) reseed(h.seedStr); else { sweepNext(); setX(h.x); } });

document.getElementById("new").addEventListener("click", () => reseed(String(Math.floor(Math.random() * 1e6))));
document.getElementById("auto").addEventListener("click", (e) => { auto = !auto; e.currentTarget.classList.toggle("on", auto); });
document.getElementById("home").addEventListener("click", () => { sweepNext(); setX(0); });
document.getElementById("save").addEventListener("click", () => {
  const visible = [...chunks.values()].map((v) => v.data).filter((d) => (d.c + 1) * W > x && d.c * W < x + vw).sort((a, b) => a.c - b.c);
  const text = standaloneSvg(visible, x, x + vw, `Pahari Scroll · Jageshwar · seed ${seedStr} · x ${Math.round(x)}`, MIST);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  a.download = `jageshwar-${seedStr}-${Math.round(x)}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
});
// ---------- background music ----------
// A plain looped track, on by default. Browsers only allow unmuted autoplay after an interaction,
// so we try at once and otherwise start on the first pointer, key or wheel event.
const bgm = document.getElementById("bgm");
const soundBtn = document.getElementById("sound");
bgm.volume = 0.7;
let muted = false;
function showSound() { soundBtn.classList.toggle("on", !muted && !bgm.paused); soundBtn.setAttribute("aria-pressed", String(!muted)); }
async function playMusic() { if (muted) return; try { await bgm.play(); } catch {} showSound(); }
function armAutoplay() {
  const once = () => { playMusic(); for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) removeEventListener(ev, once, true); };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(ev, once, true);
}
soundBtn.addEventListener("click", (e) => { e.stopPropagation(); muted = !muted; if (muted) bgm.pause(); else playMusic(); showSound(); });
bgm.addEventListener("play", showSound); bgm.addEventListener("pause", showSound);
playMusic().then(() => { if (bgm.paused) armAutoplay(); });

document.getElementById("seed").addEventListener("click", () => {
  const s = prompt("Seed (number or word)", seedStr);
  if (s && s.trim()) reseed(s.trim());
});

// ---------- go ----------
svg.innerHTML = defsString() + skeletonString();
for (const l of LAYERS) layerEls[l] = document.getElementById("L-" + l);
seedLabel.textContent = seedStr;
layout();
setX(x);
requestAnimationFrame(tick);
