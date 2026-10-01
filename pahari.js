/**
 * @schema 2.11
 * @input seed: number = 7
 * @input element: enum("scene", "temple", "deodar", "house", "terrace") = "scene"
 * @input peaks: number = 4
 * @input shrines: number = 12
 * @input houses: number = 4
 * @input trees: number = 44
 * @input terraces: boolean = true
 * @input storm: boolean = false
 * @input mist: number = 0.6
 * @input flow: number = 0.5
 */

// ---------- randomness ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry32(Math.floor(pencil.input.seed) * 7919 + 1);
const rand = (a, b) => a + (b - a) * R();
const rint = (a, b) => Math.floor(rand(a, b + 1));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// 1-D value noise: a lattice of random heights, smoothly interpolated.
function makeNoise(cells) {
  const lat = Array.from({ length: cells + 2 }, () => R());
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const a = lat[((i % cells) + cells) % cells], b = lat[(((i + 1) % cells) + cells) % cells];
    return lerp(a, b, smooth(f));
  };
}
// fractional Brownian motion: octaves at double frequency, half amplitude.
function makeFbm(octaves, cells) {
  const layers = Array.from({ length: octaves }, () => makeNoise(cells));
  return (x) => {
    let v = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) { v += amp * layers[o](x * freq); norm += amp; amp *= 0.5; freq *= 2; }
    return v / norm;
  };
}

// ---------- palette (Kangra mineral pigments, flattened) ----------
const C = {
  skyTop: "#E6D5B4", skyBot: "#F4ECDC", gold: "#D9B45A",
  stormTop: "#3E4A66", stormBot: "#8C93A3",
  snow: "#F6F3EC", snowShade: "#AEB8C6",
  far: "#9AAAB8", mid: "#7A9474", near: "#56704E", nearLine: "#3A4D35",
  stone: "#6B6248", stoneDark: "#3C3626", stoneLight: "#857A5C", stoneLighter: "#9A8F6E",
  deodar: "#2F4A3A", deodarDark: "#1F3328",
  wall: "#F2EBDD", geru: "#B5553B", slate: "#5B5F62", wood: "#4A3524",
  river: "#7FA3B8", riverLight: "#C3D8E2", mist: "#F2EADA", saffron: "#D9772B",
};

// ---------- node helpers (all paths share the scroll coordinate space) ----------
const W = pencil.width, H = pencil.height;
const nodes = [];
function path(name, d, style) { nodes.push({ type: "path", name, x: 0, y: 0, width: W, height: H, viewBox: [0, 0, W, H], geometry: d, ...style }); }
function rect(name, x, y, w, h, style) { nodes.push({ type: "rectangle", name, x, y, width: w, height: h, ...style }); }
function ellipse(name, cx, cy, rx, ry, style) { nodes.push({ type: "ellipse", name, x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2, ...style }); }
const poly = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z";
const line = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
const seg = (x0, y0, x1, y1) => `M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}`;
const stroke = (color, w) => ({ stroke: color, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" });

// ---------- elements ----------
function deodar(cx, by, h, tag) {
  const hw = h * rand(0.22, 0.3), tiers = rint(5, 8), top = by - h, trunkTop = by - h * 0.18;
  const right = [], left = []; const spacing = (trunkTop - top) / tiers;
  for (let t = 1; t <= tiers; t++) {
    const f = t / tiers, y = lerp(top, trunkTop, f), w = hw * lerp(0.15, 1, f) * rand(0.85, 1.1);
    const tipY = y + h * 0.04 * f, notchY = tipY + spacing * 0.22, nw = w * 0.55;
    right.push([cx + w, tipY]); if (t < tiers) right.push([cx + nw, notchY]);
    left.unshift([cx - w, tipY]); if (t < tiers) left.unshift([cx - nw, notchY]);
  }
  const pts = [[cx, top], ...right, [cx + 1.5, trunkTop], [cx + 1.5, by], [cx - 1.5, by], [cx - 1.5, trunkTop], ...left];
  path("Deodar " + tag, poly(pts), { fill: C.deodar, ...stroke(C.deodarDark, 1) });
}

// Nagara (latina) temple, stepped: jagati plinth -> vedibandha mouldings -> jangha wall with rathas
// -> shikhara of receding bhumi tiers with corner bhumi-amalakas -> griva -> amalaka -> kalasha.
// Five path nodes per temple, grouped by pigment, so a valley of 60 shrines stays light.
// A footing: flat top at `top`, bottom edge following the ground so nothing floats on a slope.
function footing(x0, x1, top, ground, sink) {
  const pts = [[x0, top], [x1, top]];
  for (let x = x1; x >= x0; x -= 6) pts.push([x, Math.max(top + 1, ground(x) + sink)]);
  pts.push([x0, Math.max(top + 1, ground(x0) + sink)]);
  return poly(pts);
}
// Stone courses on the exposed part of a footing wall.
function courses(x0, x1, top, ground, sink, step) {
  let d = "";
  for (let y = top + step; y < top + 400; y += step) {
    let run = null, any = false;
    for (let x = x0; x <= x1 + 0.1; x += 6) {
      const inside = ground(x) + sink > y + 1;
      if (inside && run === null) run = x;
      if ((!inside || x + 6 > x1) && run !== null) { d += seg(run, y, inside ? x : x - 6, y); run = null; }
      any = any || inside;
    }
    if (!any) break;
  }
  return d;
}
const groundFn = (g) => (typeof g === "function" ? g : () => g);
const groundTop = (g, x0, x1) => { const G = groundFn(g); let m = Infinity; for (let x = x0; x <= x1; x += 4) m = Math.min(m, G(x)); return m; };
const ell = (cx, cy, rx, ry) => `M${(cx - rx).toFixed(1)},${cy.toFixed(1)}a${rx.toFixed(1)},${ry.toFixed(1)} 0 1,0 ${(rx * 2).toFixed(1)},0a${rx.toFixed(1)},${ry.toFixed(1)} 0 1,0 ${(-rx * 2).toFixed(1)},0`;
const box = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
function temple(cx, ground, h, w, tag, ownPlinth) {
  const lw = Math.max(0.6, h / 150);
  let stone = "", light = "", lighter = "", dark = "", lines = "";
  const G = groundFn(ground);
  let base = ownPlinth ? groundTop(G, cx - w * 0.85, cx + w * 0.85) : G(cx);
  if (ownPlinth) {
    const sh = h * 0.035;
    light += footing(cx - w * 0.85, cx + w * 0.85, base - sh, G, 3);
    lines += courses(cx - w * 0.85, cx + w * 0.85, base - sh + sh, G, 3, Math.max(3, sh));
    base -= sh;
    light += box(cx - w * 0.7, base - sh, w * 1.4, sh);
    base -= sh;
  }
  const wallH = h * 0.3, wallTop = base - wallH;
  stone += box(cx - w / 2, wallTop, w, wallH);
  for (let i = 1; i <= 3; i++) lines += seg(cx - w / 2, base - wallH * 0.1 * i, cx + w / 2, base - wallH * 0.1 * i);
  for (const sx of [-1, 1]) light += box(cx + sx * w * 0.3 - w * 0.08, wallTop, w * 0.16, wallH);
  lighter += box(cx - w * 0.18, wallTop, w * 0.36, wallH);
  dark += box(cx - w * 0.07, base - wallH * 0.62, w * 0.14, wallH * 0.62);
  lines += seg(cx - w * 0.1, base - wallH * 0.62, cx + w * 0.1, base - wallH * 0.62);
  const shH = h * 0.56, n = Math.max(4, Math.round(h / 14)), th = shH / n;
  let y = wallTop;
  for (let k = 0; k < n; k++) {
    const f = k / n, f1 = (k + 1) / n;
    const wk = w * (1 - 0.5 * Math.pow(f, 1.6)), wk1 = w * (1 - 0.5 * Math.pow(f1, 1.6));
    const yTop = y - th;
    stone += poly([[cx - wk / 2, y], [cx + wk / 2, y], [cx + wk1 / 2, yTop], [cx - wk1 / 2, yTop]]);
    lighter += poly([[cx - wk * 0.18, y], [cx + wk * 0.18, y], [cx + wk1 * 0.18, yTop], [cx - wk1 * 0.18, yTop]]);
    if (k % 3 === 2 && k < n - 1) for (const sx of [-1, 1]) light += ell(cx + sx * wk1 / 2, yTop, Math.max(1.4, w * 0.045), Math.max(1, th * 0.22));
    y = yTop;
  }
  const topW = w * 0.5, griH = h * 0.035;
  dark += box(cx - topW * 0.36, y - griH, topW * 0.72, griH);
  const ar = w * 0.36, ary = ar * 0.4, ay = y - griH - ary * 0.85;
  stone += ell(cx, ay, ar, ary);
  for (let k = 1; k < 12; k++) { const t2 = (k / 12) * Math.PI, x = cx - ar * Math.cos(t2), dy = ary * Math.sin(t2); lines += seg(x, ay - dy, x, ay + dy); }
  const ky = ay - ary - ar * 0.12;
  stone += ell(cx, ky, ar * 0.14, ar * 0.12);
  lines += seg(cx, ky - ar * 0.12, cx, ky - ar * 0.3);
  path("Temple " + tag + " stone", stone, { fill: C.stone, ...stroke(C.stoneDark, lw) });
  path("Temple " + tag + " light stone", light, { fill: C.stoneLight, ...stroke(C.stoneDark, lw * 0.7) });
  path("Temple " + tag + " rathas", lighter, { fill: C.stoneLighter, ...stroke(C.stoneDark, lw * 0.6) });
  path("Temple " + tag + " dark", dark, { fill: C.stoneDark });
  path("Temple " + tag + " lines", lines, stroke(C.stoneDark, lw * 0.7));
}

// A group of towers on a shared stepped platform. count includes the main tower.
function templeCluster(cx, ground, mainH, count, tag) {
  const spread = mainH * 1.5 * Math.sqrt(count / 10);
  const lw = Math.max(0.6, mainH / 150);
  const G = groundFn(ground), x0 = cx - spread * 0.72, x1 = cx + spread * 0.72, sh = mainH * 0.03;
  const by = groundTop(G, x0, x1);
  path("Platform " + tag + " lower", footing(x0, x1, by - sh, G, 4), { fill: C.stoneLight, ...stroke(C.stoneDark, lw) });
  path("Platform " + tag + " courses", courses(x0, x1, by, G, 4, Math.max(4, sh * 1.2)), stroke(C.stoneDark, lw * 0.6));
  rect("Platform " + tag + " upper", cx - spread * 0.64, by - sh * 2, spread * 1.28, sh, { fill: C.stoneLight, ...stroke(C.stoneDark, lw) });
  const base = by - sh * 2;
  const towers = [{ x: cx + rand(-0.12, 0.12) * spread, h: mainH }];
  for (let i = 1; i < count; i++) towers.push({ x: cx + rand(-0.55, 0.55) * spread, h: mainH * (R() < 0.2 ? rand(0.5, 0.7) : rand(0.22, 0.42)) });
  towers.sort((a, b) => b.h - a.h);
  towers.forEach((t, i) => temple(t.x, base, t.h, t.h * rand(0.4, 0.48), tag + "." + i, false));
  const fx = cx + spread * 0.68, fh = mainH * 0.5;
  path("Dhwaja " + tag, seg(fx, base, fx, base - fh), stroke(C.wood, lw * 2));
  path("Dhwaja " + tag + " flag", poly([[fx, base - fh], [fx + fh * 0.26, base - fh * 0.9], [fx, base - fh * 0.8]]), { fill: C.saffron });
}

function house(x, by, s, tag) {
  const w = 46 * s, h = 28 * s, rh = 11 * s;
  rect("House " + tag + " wall base", x - 3 * s, by, w + 6 * s, 8 * s, { fill: C.stoneLight, ...stroke(C.stoneDark, 0.8) });
  path("House " + tag + " wall courses", seg(x - 3 * s, by + 4 * s, x + w + 3 * s, by + 4 * s), stroke(C.stoneDark, 0.5));
  rect("House " + tag + " body", x, by - h, w, h, { fill: C.wall, ...stroke(C.stoneDark, 0.9) });
  rect("House " + tag + " geru", x, by - h * 0.3, w, h * 0.3, { fill: C.geru });
  path("House " + tag + " roof", poly([[x - 4 * s, by - h], [x + w + 4 * s, by - h], [x + w - 5 * s, by - h - rh], [x + 5 * s, by - h - rh]]), { fill: C.slate, ...stroke(C.stoneDark, 0.9) });
  let rows = "";
  for (let i = 1; i < 4; i++) { const f = i / 4, yy = by - h - rh * f, inset = (4 * s + 5 * s) * f - 4 * s; rows += seg(x + inset, yy, x + w - inset, yy); }
  path("House " + tag + " slate rows", rows, stroke(C.stoneDark, 0.5));
  path("House " + tag + " balcony", seg(x, by - h * 0.55, x + w, by - h * 0.55), stroke(C.wood, 1.4));
  let lat = "";
  for (let i = 0; i < 5; i++) { const x0 = x + (w / 5) * i, x1 = x0 + w / 5, y0 = by - h * 0.55, y1 = y0 + h * 0.18; lat += seg(x0, y0, x1, y1) + seg(x1, y0, x0, y1); }
  path("House " + tag + " lattice", lat, stroke(C.wood, 0.7));
  rect("House " + tag + " window L", x + w * 0.15, by - h * 0.92, w * 0.16, h * 0.22, { fill: C.wood });
  rect("House " + tag + " window R", x + w * 0.65, by - h * 0.92, w * 0.16, h * 0.22, { fill: C.wood });
  rect("House " + tag + " door", x + w * 0.42, by - h * 0.3, w * 0.16, h * 0.3, { fill: "#2E5C7A" });
}

// ---------- terrain ----------
function ridgeFn(baseY, amp, cells, octaves, peakList) {
  const fbm = makeFbm(octaves, cells);
  return (x) => {
    let y = baseY - amp * (fbm(x / W * cells) - 0.5) * 2;
    if (peakList) for (const p of peakList) y -= p.h * Math.exp(-((x - p.x) * (x - p.x)) / (2 * p.s * p.s));
    return y;
  };
}
function ridgePoly(ridge, step) {
  const pts = [];
  for (let x = 0; x <= W; x += step) pts.push([x, ridge(x)]);
  pts.push([W, H], [0, H]);
  return pts;
}
// Interval bookkeeping so shrines, houses and clusters never overlap.
function makeOccupancy() {
  const spans = [];
  return {
    free: (x0, x1) => spans.every(([a, b]) => x1 < a || x0 > b),
    claim: (x0, x1) => spans.push([x0, x1]),
    place: (width, lo, hi, tries) => { for (let t = 0; t < (tries || 24); t++) { const x = rand(lo, hi); if (spans.every(([a, b]) => x + width / 2 < a || x - width / 2 > b)) { spans.push([x - width / 2, x + width / 2]); return x; } } return null; },
  };
}

function scene() {
  const storm = pencil.input.storm;
  nodes.push({ type: "rectangle", name: "Sky", x: 0, y: 0, width: W, height: H, fill: { type: "gradient", gradientType: "linear", rotation: 180, colors: [{ color: storm ? C.stormTop : C.skyTop, position: 0 }, { color: storm ? C.stormBot : C.skyBot, position: 1 }] } });
  if (!storm) rect("Gold band", 0, H * 0.3, W, H * 0.06, { fill: C.gold + "55" });

  const snowBase = makeFbm(3, 10);
  const snowRidge = (x) => H * 0.36 - Math.abs(snowBase(x / W * 10) - 0.5) * 2 * H * 0.16 - 10;
  path("Snow range", poly(ridgePoly(snowRidge, 6)), { fill: C.snow, ...stroke(C.snowShade, 1) });
  let shade = "";
  for (let x = 20; x < W; x += 90) { const y = snowRidge(x); shade += `M${x},${y.toFixed(1)}L${x + 28},${(y + 24).toFixed(1)}L${x + 40},${(y + 70).toFixed(1)}`; }
  path("Snow shading", shade, stroke(C.snowShade, 1.2));
  rect("Mist far", 0, H * 0.38, W, H * 0.14, { fill: { type: "gradient", gradientType: "linear", rotation: 180, colors: [{ color: C.mist + "00", position: 0 }, { color: C.mist + "FF", position: 0.6 }, { color: C.mist + "00", position: 1 }] }, opacity: pencil.input.mist });

  const far = ridgeFn(H * 0.52, 40, 7, 3);
  path("Far hills", poly(ridgePoly(far, 8)), { fill: C.far });

  const np = Math.max(1, Math.round(pencil.input.peaks));
  const peakList = Array.from({ length: np }, (_, i) => ({ x: ((i + 0.5) / np) * W + rand(-0.25, 0.25) * (W / np), h: rand(70, 140), s: rand(90, 160) }));
  const mid = ridgeFn(H * 0.66, 28, 9, 3, peakList);
  path("Mid hills", poly(ridgePoly(mid, 6)), { fill: C.mid, ...stroke(C.nearLine, 0.8) });

  const nShr = Math.max(0, Math.round(pencil.input.shrines));
  const siteX = W * rand(0.3, 0.6);
  const midOcc = makeOccupancy();
  // Distant shrines on the mid ridge: single towers or pairs, small, behind the grove.
  for (let i = 0; i < Math.round(nShr * 0.4); i++) {
    const k = R() < 0.6 ? 1 : 2, x = midOcc.place(60 * k, 20, W - 20);
    if (x === null) continue;
    for (let j = 0; j < k; j++) { const tx = x + (j - (k - 1) / 2) * 26, th = rand(22, 36); temple(tx, (x) => mid(x) + 2, th, th * rand(0.42, 0.5), "mid." + i + "." + j, true); }
  }
  const nt = Math.max(0, Math.round(pencil.input.trees));
  for (let i = 0; i < nt; i++) {
    const nearSite = R() < 0.55;
    const x = nearSite ? siteX + rand(-W * 0.14, W * 0.14) : rand(0, W);
    deodar(x, mid(x) + 3, rand(26, 46), "mid." + i);
  }
  rect("Mist near", 0, H * 0.62, W, H * 0.12, { fill: { type: "gradient", gradientType: "linear", rotation: 180, colors: [{ color: C.mist + "00", position: 0 }, { color: C.mist + "CC", position: 0.5 }, { color: C.mist + "00", position: 1 }] }, opacity: pencil.input.mist * 0.8 });

  const near = ridgeFn(H * 0.8, 36, 6, 2);
  path("Near slope", poly(ridgePoly(near, 6)), { fill: C.near, ...stroke(C.nearLine, 1) });
  if (pencil.input.terraces) {
    let d = "";
    for (let i = 1; i < 7; i++) { const pts = []; for (let x = 0; x <= W; x += 10) pts.push([x, near(x) + i * 13 + Math.sin(x / 37 + i) * 2]); d += line(pts); }
    path("Terraces", d, stroke(C.nearLine + "AA", 0.8));
  }

  // The main Jageshwar complex: one dense group of 18-26 towers, then a secondary group (Dandeshwar).
  const occ = makeOccupancy();
  const mainH = 170, mainCount = rint(18, 26);
  const mainSpread = mainH * 1.5 * Math.sqrt(mainCount / 10) * 1.5;
  occ.claim(siteX - mainSpread / 2, siteX + mainSpread / 2);
  templeCluster(siteX, (x) => near(x) - 2, mainH, mainCount, "jageshwar");
  const dx = occ.place(300, 0.08 * W, 0.92 * W);
  if (dx !== null) templeCluster(dx, (x) => near(x) - 2, rand(80, 105), rint(5, 8), "dandeshwar");

  const nh = Math.max(0, Math.round(pencil.input.houses));
  for (let i = 0; i < nh; i++) { const x = occ.place(70, 0.03 * W, 0.95 * W); if (x !== null) house(x - 23, near(x) - 4, rand(0.8, 1.15), "near." + i); }
  // Scattered shrines on the near slope: singles, pairs and triples with their own stepped plinths.
  for (let i = 0; i < Math.round(nShr * 0.6); i++) {
    const k = rint(1, 3), x = occ.place(60 * k + 20, 0.02 * W, 0.98 * W);
    if (x === null) continue;
    for (let j = 0; j < k; j++) { const tx = x + (j - (k - 1) / 2) * 42, th = rand(40, 64) * (j === Math.floor(k / 2) ? 1.15 : 1); temple(tx, (x) => near(x), th, th * rand(0.42, 0.5), "near." + i + "." + j, true); }
  }
  for (let i = 0; i < Math.round(nt * 0.35); i++) { const x = rand(0, W); deodar(x, near(x) + 2, rand(40, 70), "near." + i); }

  const flow = Math.min(1, Math.max(0, pencil.input.flow));
  const riverTop = H * (0.96 - 0.12 * flow);
  const bank = makeFbm(2, 8);
  const edge = (x) => riverTop + (bank(x / W * 8) - 0.5) * 24;
  path("River", poly(ridgePoly(edge, 8)), { fill: C.river });
  let ripples = "";
  for (let i = 0; i < 40 + flow * 60; i++) { const x = rand(0, W - 60), y = rand(riverTop + 10, H - 6), l = rand(20, 60); ripples += `M${x.toFixed(1)},${y.toFixed(1)}q${(l / 2).toFixed(1)},-3 ${l.toFixed(1)},0`; }
  path("Ripples", ripples, stroke(C.riverLight, 1));

  if (storm) {
    let rain = "";
    for (let i = 0; i < 260; i++) { const x = rand(0, W), y = rand(0, H * 0.6), l = rand(14, 30); rain += `M${x.toFixed(1)},${y.toFixed(1)}l${(-l * 0.25).toFixed(1)},${l.toFixed(1)}`; }
    path("Rain", rain, stroke("#DDE3EE88", 1));
  }
}

// ---------- single-element study boards ----------
function study(fn) { rect("Study background", 0, 0, W, H, { fill: C.skyBot }); fn(); }
const el = pencil.input.element;
if (el === "scene") scene();
else if (el === "temple") study(() => { const g = (x) => H * 0.86 + (x - W * 0.26) * 0.08; path("Study ground", poly([[0, g(0)], [W, g(W)], [W, H], [0, H]]), { fill: C.near, ...stroke(C.nearLine, 1) }); temple(W * 0.26, g, H * 0.78, H * 0.78 * 0.45, "study", true); templeCluster(W * 0.7, g, H * 0.36, 9, "study"); });
else if (el === "deodar") study(() => { for (let i = 0; i < 5; i++) deodar(W * (0.12 + i * 0.19), H * 0.9, H * rand(0.5, 0.8), "study." + i); });
else if (el === "house") study(() => { for (let i = 0; i < 3; i++) house(W * (0.1 + i * 0.3), H * 0.8, H / 110 * rand(0.9, 1.1), "study." + i); });
else if (el === "terrace") study(() => {
  const r = ridgeFn(H * 0.55, H * 0.12, 4, 2);
  path("Study slope", poly(ridgePoly(r, 6)), { fill: C.near, ...stroke(C.nearLine, 1) });
  let d = ""; for (let i = 1; i < 9; i++) { const pts = []; for (let x = 0; x <= W; x += 10) pts.push([x, r(x) + i * (H * 0.045)]); d += line(pts); }
  path("Study terraces", d, stroke(C.nearLine + "AA", 1));
  for (let i = 0; i < 6; i++) { const x = rand(0, W); deodar(x, r(x), H * 0.18, "study." + i); }
});

return nodes;
