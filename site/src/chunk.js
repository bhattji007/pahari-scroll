// Terrain is global (a function of absolute x), content is per chunk (seeded by the chunk index).
// That is what makes the scroll infinite, deterministic, and generatable in any order.

import { hash32, hash01, makeRng } from "./prng.js";
import { makeFbm } from "./noise.js";
import { C, makePainter, poly, line, stroke, deodar, temple, templeCluster, house } from "./elements.js";

export const W = 2400; // chunk width
export const H = 900;  // scroll height

// Draw order. Chunks are split into these layers so translucent bands can be one continuous element.
export const LAYERS = ["sky", "snow", "far", "mid", "near", "river"];
// Full-width translucent bands drawn between layers, continuous across chunks (per-chunk rects would seam).
export const BANDS = [
  { id: "gold", after: "sky", y: H * 0.3, h: H * 0.06, fill: C.gold + "55", opacity: 1 },
  { id: "mistFar", after: "snow", y: H * 0.38, h: H * 0.14, fill: "url(#mistFar)", opacity: 1 },
  { id: "mistNear", after: "mid", y: H * 0.62, h: H * 0.12, fill: "url(#mistNear)", opacity: 0.8 },
];

const MARGIN = 150;    // content stays this far from chunk edges so nothing spills into a neighbour

// ---------- global terrain ----------
export function makeTerrain(seed) {
  const snowF = makeFbm(seed, 1, W / 10, 3);
  const farF = makeFbm(seed, 2, W / 7, 3);
  const midF = makeFbm(seed, 3, W / 9, 3);
  const nearF = makeFbm(seed, 4, W / 6, 2);
  const bankF = makeFbm(seed, 5, W / 8, 2);

  // Gaussian peaks belong to chunks but reach into their neighbours, so the mid ridge at x
  // sums the peaks of chunks c-1, c, c+1.
  const peakCache = new Map();
  const peaksFor = (c) => {
    if (!peakCache.has(c)) {
      const { rand, rint } = makeRng(hash32(seed, 101, c));
      const np = rint(3, 5), list = [];
      for (let i = 0; i < np; i++) list.push({ x: c * W + ((i + 0.5) / np) * W + rand(-0.25, 0.25) * (W / np), h: rand(70, 140), s: rand(90, 160) });
      peakCache.set(c, list);
    }
    return peakCache.get(c);
  };

  const snow = (x) => H * 0.36 - Math.abs(snowF(x) - 0.5) * 2 * H * 0.16 - 10;
  const far = (x) => H * 0.52 - 40 * (farF(x) - 0.5) * 2;
  const mid = (x) => {
    let y = H * 0.66 - 28 * (midF(x) - 0.5) * 2;
    const c = Math.floor(x / W);
    for (const cc of [c - 1, c, c + 1]) for (const p of peaksFor(cc)) y -= p.h * Math.exp(-((x - p.x) * (x - p.x)) / (2 * p.s * p.s));
    return y;
  };
  const near = (x) => H * 0.8 - 36 * (nearF(x) - 0.5) * 2;
  const bank = (x, flow) => H * (0.96 - 0.12 * flow) + (bankF(x) - 0.5) * 24;
  return { snow, far, mid, near, bank };
}

// ---------- chunk planner + painter ----------
function makeOccupancy(rand) {
  const spans = [];
  return {
    claim: (x0, x1) => spans.push([x0, x1]),
    place: (width, lo, hi, tries = 24) => {
      for (let t = 0; t < tries; t++) {
        const x = rand(lo, hi);
        if (spans.every(([a, b]) => x + width / 2 < a || x - width / 2 > b)) { spans.push([x - width / 2, x + width / 2]); return x; }
      }
      return null;
    },
  };
}

// Which chunks hold the great complex: chunk 0 always, then one per block of five.
export function hasComplex(seed, c) {
  if (c === 0) return true;
  const block = Math.floor(c / 5);
  if (block === 0) return false;
  return c % 5 === Math.floor(hash01(seed, 55, block) * 5);
}

export function generateChunk(seed, c, terrain, opts = {}) {
  const flow = opts.flow ?? 0.5;
  const rng = makeRng(hash32(seed, 7, c));
  const p = makePainter(rng, W, H);
  const setLayer = (l) => { p.layer = l; };
  const { rand, rint, R } = rng;
  const ox = c * W;
  const mid = (x) => terrain.mid(ox + x), near = (x) => terrain.near(ox + x), far = (x) => terrain.far(ox + x), snow = (x) => terrain.snow(ox + x);
  // Fills overrun the chunk by OVER px on both sides so neighbours overlap and no hairline seam shows.
  const OVER = 2;
  const ridgePoly = (ridge, step) => { const pts = []; for (let x = -OVER; x <= W + OVER; x += step) pts.push([x, ridge(x)]); pts.push([W + OVER, H], [-OVER, H]); return pts; };
  // Fills carry no stroke (a stroked polygon would draw its vertical side at the chunk edge); the ridge line is a separate open path.
  const ridgeLayer = (name, ridge, step, fill, lineColor, lineW) => {
    p.path(name, poly(ridgePoly(ridge, step)), { fill });
    if (lineColor) { const pts = []; for (let x = -OVER; x <= W + OVER; x += step) pts.push([x, ridge(x)]); p.path(name + " line", line(pts), stroke(lineColor, lineW)); }
  };

  setLayer("sky");
  p.rect("Sky", -OVER, 0, W + OVER * 2, H, { fill: "url(#sky)" });

  setLayer("snow");
  ridgeLayer("Snow range", snow, 6, C.snow, C.snowShade, 1);
  let shade = "";
  for (let x = 20; x < W; x += 90) { const y = snow(x); shade += line([[x, y], [x + 28, y + 24], [x + 40, y + 70]]); }
  p.path("Snow shading", shade, stroke(C.snowShade, 1.2));

  setLayer("far");
  ridgeLayer("Far hills", far, 8, C.far);
  setLayer("mid");
  ridgeLayer("Mid hills", mid, 6, C.mid, C.nearLine, 0.8);

  // plan
  const complex = hasComplex(seed, c);
  const nShr = rint(8, 13), nTrees = rint(36, 52), nHouses = rint(2, 5);
  const siteX = complex ? W * rand(0.35, 0.65) : null;

  // far shrines on the mid ridge
  const midOcc = makeOccupancy(rand);
  for (let i = 0; i < Math.round(nShr * 0.4); i++) {
    const k = R() < 0.6 ? 1 : 2, x = midOcc.place(60 * k, MARGIN, W - MARGIN);
    if (x === null) continue;
    for (let j = 0; j < k; j++) { const tx = x + (j - (k - 1) / 2) * 26, th = rand(22, 36); temple(p, tx, (xx) => mid(xx) + 2, th, th * rand(0.42, 0.5), `mid.${i}.${j}`, true); }
  }
  // deodar grove on the mid ridge, densest around the complex
  for (let i = 0; i < nTrees; i++) {
    const nearSite = siteX !== null && R() < 0.55;
    const x = nearSite ? siteX + rand(-W * 0.14, W * 0.14) : rand(MARGIN * 0.3, W - MARGIN * 0.3);
    deodar(p, x, mid(x) + 3, rand(26, 46), "mid." + i);
  }
  setLayer("near");
  ridgeLayer("Near slope", near, 6, C.near, C.nearLine, 1);
  let d = "";
  for (let i = 1; i < 7; i++) { const pts = []; for (let x = -OVER; x <= W + OVER; x += 10) pts.push([x, near(x) + i * 13 + Math.sin((ox + x) / 37 + i) * 2]); d += line(pts); }
  p.path("Terraces", d, stroke(C.nearLine + "AA", 0.8));

  // temples, houses, shrines on the near slope
  const occ = makeOccupancy(rand);
  const g = (x) => near(x) - 2;
  if (complex) {
    const mainH = 170, count = rint(18, 26);
    const spread = mainH * 1.5 * Math.sqrt(count / 10) * 1.5;
    occ.claim(siteX - spread / 2, siteX + spread / 2);
    templeCluster(p, siteX, g, mainH, count, "complex");
  }
  if (R() < (complex ? 0.35 : 0.65)) {
    const dx = occ.place(320, MARGIN + 80, W - MARGIN - 80);
    if (dx !== null) templeCluster(p, dx, g, rand(80, 105), rint(5, 8), "group");
  }
  for (let i = 0; i < nHouses; i++) { const x = occ.place(70, MARGIN, W - MARGIN); if (x !== null) house(p, x - 23, near(x) - 4, rand(0.8, 1.15), "near." + i); }
  for (let i = 0; i < Math.round(nShr * 0.6); i++) {
    const k = rint(1, 3), x = occ.place(60 * k + 20, MARGIN, W - MARGIN);
    if (x === null) continue;
    for (let j = 0; j < k; j++) { const tx = x + (j - (k - 1) / 2) * 42, th = rand(40, 64) * (j === Math.floor(k / 2) ? 1.15 : 1); temple(p, tx, near, th, th * rand(0.42, 0.5), `near.${i}.${j}`, true); }
  }
  for (let i = 0; i < Math.round(nTrees * 0.35); i++) { const x = rand(MARGIN * 0.3, W - MARGIN * 0.3); deodar(p, x, near(x) + 2, rand(40, 70), "near." + i); }

  setLayer("river");
  const riverTop = H * (0.96 - 0.12 * flow);
  p.path("River", poly(ridgePoly((x) => terrain.bank(ox + x, flow), 8)), { fill: C.river });
  let ripples = "";
  for (let i = 0; i < 40 + flow * 60; i++) { const x = rand(0, W - 60), y = rand(riverTop + 10, H - 6), l = rand(20, 60); ripples += `M${x.toFixed(1)},${y.toFixed(1)}q${(l / 2).toFixed(1)},-3 ${l.toFixed(1)},0`; }
  p.path("Ripples", ripples, stroke(C.riverLight, 1));

  return { c, nodes: p.nodes, complex };
}
