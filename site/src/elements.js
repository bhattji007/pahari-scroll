// The procedural vocabulary: deodar, Nagara temple, temple cluster, Kumaoni house.
// Every element is a function of (painter, position, size) and draws into painter.nodes.
// Geometry and proportions are explained in ../../MATH.md.

export const C = {
  skyTop: "#E6D5B4", skyBot: "#F4ECDC", gold: "#D9B45A",
  snow: "#F6F3EC", snowShade: "#AEB8C6",
  far: "#9AAAB8", mid: "#7A9474", near: "#56704E", nearLine: "#3A4D35",
  stone: "#6B6248", stoneDark: "#3C3626", stoneLight: "#857A5C", stoneLighter: "#9A8F6E",
  deodar: "#2F4A3A", deodarDark: "#1F3328",
  wall: "#F2EBDD", geru: "#B5553B", slate: "#5B5F62", wood: "#4A3524", door: "#2E5C7A",
  river: "#7FA3B8", riverLight: "#C3D8E2", mist: "#F2EADA", saffron: "#D9772B",
  paper: "#F7F1E4", geruBorder: "#A8432E", bisvar: "#F5EFE3",
};

const f1 = (n) => (Math.round(n * 10) / 10).toString();
export const lerp = (a, b, t) => a + (b - a) * t;
export const poly = (pts) => "M" + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join("L") + "Z";
export const line = (pts) => "M" + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join("L");
export const seg = (x0, y0, x1, y1) => `M${f1(x0)},${f1(y0)}L${f1(x1)},${f1(y1)}`;
export const ell = (cx, cy, rx, ry) => `M${f1(cx - rx)},${f1(cy)}a${f1(rx)},${f1(ry)} 0 1,0 ${f1(rx * 2)},0a${f1(rx)},${f1(ry)} 0 1,0 ${f1(-rx * 2)},0`;
export const box = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
export const stroke = (color, w) => ({ stroke: color, strokeWidth: w });

// A painter collects nodes for one chunk. rng = { R, rand, rint } from prng.makeRng.
// Figures (a temple, a tree, a house, a platform) are grouped so the page can animate each one
// being built when it scrolls into view. begin(kind, x) ... end() wraps the nodes drawn in between.
export function makePainter(rng, W, H) {
  const nodes = [];
  let group = null, figIndex = 0;
  const sink = () => (group ? group.children : nodes);
  return {
    W, H, nodes, ...rng, layer: "near",
    path(name, d, style) { if (d) sink().push({ type: "path", name, layer: this.layer, d, ...style }); },
    rect(name, x, y, w, h, style) { sink().push({ type: "rect", name, layer: this.layer, x, y, w, h, ...style }); },
    begin(kind, x, meta) { if (group) this.end(); group = { type: "group", kind, x, layer: this.layer, i: figIndex++, children: [], ...meta }; },
    end() { if (group) { nodes.push(group); group = null; } },
  };
}
// Flatten groups for scripts that inspect every drawable.
export const flatten = (nodes) => nodes.flatMap((n) => (n.type === "group" ? n.children : [n]));

// ---------- deodar ----------
export function deodar(p, cx, by, h, tag) {
  const { rand, rint } = p;
  const hw = h * rand(0.22, 0.3), tiers = rint(5, 8), top = by - h, trunkTop = by - h * 0.18;
  const right = [], left = [], spacing = (trunkTop - top) / tiers;
  for (let t = 1; t <= tiers; t++) {
    const f = t / tiers, y = lerp(top, trunkTop, f), w = hw * lerp(0.15, 1, f) * rand(0.85, 1.1);
    const tipY = y + h * 0.04 * f, notchY = tipY + spacing * 0.22, nw = w * 0.55;
    right.push([cx + w, tipY]); if (t < tiers) right.push([cx + nw, notchY]);
    left.unshift([cx - w, tipY]); if (t < tiers) left.unshift([cx - nw, notchY]);
  }
  const pts = [[cx, top], ...right, [cx + 1.5, trunkTop], [cx + 1.5, by], [cx - 1.5, by], [cx - 1.5, trunkTop], ...left];
  p.begin("tree", cx);
  p.path("Deodar " + tag, poly(pts), { fill: C.deodar, ...stroke(C.deodarDark, 1) });
  p.end();
}

// ---------- footings: nothing floats on a slope ----------
export function footing(x0, x1, top, ground, sink) {
  const pts = [[x0, top], [x1, top]];
  for (let x = x1; x >= x0; x -= 6) pts.push([x, Math.max(top + 1, ground(x) + sink)]);
  pts.push([x0, Math.max(top + 1, ground(x0) + sink)]);
  return poly(pts);
}
export function courses(x0, x1, top, ground, sink, step) {
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
export const groundFn = (g) => (typeof g === "function" ? g : () => g);
export const groundTop = (g, x0, x1) => { const G = groundFn(g); let m = Infinity; for (let x = x0; x <= x1; x += 4) m = Math.min(m, G(x)); return m; };

// ---------- Nagara temple ----------
// jagati plinth -> vedibandha mouldings -> jangha wall with rathas -> shikhara of receding
// bhumi tiers with corner bhumi-amalakas -> griva -> amalaka -> kalasha. Five path nodes, one per pigment.
export function temple(p, cx, ground, h, w, tag, ownPlinth) {
  const lw = Math.max(0.6, h / 150);
  let stone = "", light = "", lighter = "", dark = "", lines = "";
  const G = groundFn(ground);
  let base = ownPlinth ? groundTop(G, cx - w * 0.85, cx + w * 0.85) : G(cx);
  if (ownPlinth) {
    const sh = h * 0.035;
    light += footing(cx - w * 0.85, cx + w * 0.85, base - sh, G, 3);
    lines += courses(cx - w * 0.85, cx + w * 0.85, base, G, 3, Math.max(3, sh));
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
  p.begin("temple", cx, { shrine: ownPlinth ? 1 : 0 });
  p.path("Temple " + tag + " stone", stone, { fill: C.stone, ...stroke(C.stoneDark, lw) });
  p.path("Temple " + tag + " light", light, { fill: C.stoneLight, ...stroke(C.stoneDark, lw * 0.7) });
  p.path("Temple " + tag + " rathas", lighter, { fill: C.stoneLighter, ...stroke(C.stoneDark, lw * 0.6) });
  p.path("Temple " + tag + " dark", dark, { fill: C.stoneDark });
  p.path("Temple " + tag + " lines", lines, stroke(C.stoneDark, lw * 0.7));
  p.end();
}

// A group of towers on a shared levelled terrace. count includes the main tower.
export function templeCluster(p, cx, ground, mainH, count, tag) {
  const { rand, R } = p;
  const spread = mainH * 1.5 * Math.sqrt(count / 10);
  const lw = Math.max(0.6, mainH / 150);
  const G = groundFn(ground), x0 = cx - spread * 0.72, x1 = cx + spread * 0.72, sh = mainH * 0.03;
  const by = groundTop(G, x0, x1);
  p.begin("platform", cx, { count });
  p.path("Platform " + tag, footing(x0, x1, by - sh, G, 4), { fill: C.stoneLight, ...stroke(C.stoneDark, lw) });
  p.path("Platform " + tag + " courses", courses(x0, x1, by, G, 4, Math.max(4, sh * 1.2)), stroke(C.stoneDark, lw * 0.6));
  p.rect("Platform " + tag + " upper", cx - spread * 0.64, by - sh * 2, spread * 1.28, sh, { fill: C.stoneLight, ...stroke(C.stoneDark, lw) });
  p.end();
  const base = by - sh * 2;
  const towers = [{ x: cx + rand(-0.12, 0.12) * spread, h: mainH }];
  for (let i = 1; i < count; i++) towers.push({ x: cx + rand(-0.55, 0.55) * spread, h: mainH * (R() < 0.2 ? rand(0.5, 0.7) : rand(0.22, 0.42)) });
  towers.sort((a, b) => b.h - a.h);
  towers.forEach((t, i) => temple(p, t.x, base, t.h, t.h * rand(0.4, 0.48), tag + "." + i, false));
  const fx = cx + spread * 0.68, fh = mainH * 0.5;
  p.begin("flag", fx);
  p.path("Dhwaja " + tag, seg(fx, base, fx, base - fh), stroke(C.wood, lw * 2));
  p.path("Dhwaja " + tag + " flag", poly([[fx, base - fh], [fx + fh * 0.26, base - fh * 0.9], [fx, base - fh * 0.8]]), { fill: C.saffron });
  p.end();
  return { x0, x1 };
}

// ---------- Kumaoni house ----------
export function house(p, x, by, s, tag) {
  const w = 46 * s, h = 28 * s, rh = 11 * s;
  p.begin("house", x + w / 2);
  p.rect("House " + tag + " base", x - 3 * s, by, w + 6 * s, 8 * s, { fill: C.stoneLight, ...stroke(C.stoneDark, 0.8) });
  p.path("House " + tag + " courses", seg(x - 3 * s, by + 4 * s, x + w + 3 * s, by + 4 * s), stroke(C.stoneDark, 0.5));
  p.rect("House " + tag + " body", x, by - h, w, h, { fill: C.wall, ...stroke(C.stoneDark, 0.9) });
  p.rect("House " + tag + " geru", x, by - h * 0.3, w, h * 0.3, { fill: C.geru });
  p.path("House " + tag + " roof", poly([[x - 4 * s, by - h], [x + w + 4 * s, by - h], [x + w - 5 * s, by - h - rh], [x + 5 * s, by - h - rh]]), { fill: C.slate, ...stroke(C.stoneDark, 0.9) });
  let rows = "";
  for (let i = 1; i < 4; i++) { const f = i / 4, yy = by - h - rh * f, inset = (4 * s + 5 * s) * f - 4 * s; rows += seg(x + inset, yy, x + w - inset, yy); }
  p.path("House " + tag + " slate", rows, stroke(C.stoneDark, 0.5));
  p.path("House " + tag + " balcony", seg(x, by - h * 0.55, x + w, by - h * 0.55), stroke(C.wood, 1.4));
  let lat = "";
  for (let i = 0; i < 5; i++) { const x0 = x + (w / 5) * i, x1 = x0 + w / 5, y0 = by - h * 0.55, y1 = y0 + h * 0.18; lat += seg(x0, y0, x1, y1) + seg(x1, y0, x0, y1); }
  p.path("House " + tag + " lattice", lat, stroke(C.wood, 0.7));
  p.rect("House " + tag + " window L", x + w * 0.15, by - h * 0.92, w * 0.16, h * 0.22, { fill: C.wood });
  p.rect("House " + tag + " window R", x + w * 0.65, by - h * 0.92, w * 0.16, h * 0.22, { fill: C.wood });
  p.rect("House " + tag + " door", x + w * 0.42, by - h * 0.3, w * 0.16, h * 0.3, { fill: C.door });
  p.end();
}
