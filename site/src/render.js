// Nodes -> SVG markup strings. Used both in the browser (innerHTML) and by scripts/snapshot.mjs.
// The scene is grouped by LAYER, not by chunk: each layer holds one <g> per chunk, and the translucent
// BANDS (gold sky band, mist) are single rectangles spanning every loaded chunk, so nothing seams.
import { C } from "./elements.js";
import { W, H, LAYERS, BANDS } from "./chunk.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function styleAttrs(n) {
  let a = ` fill="${n.fill ?? "none"}"`;
  if (n.stroke) a += ` stroke="${n.stroke}" stroke-width="${n.strokeWidth ?? 1}" stroke-linecap="round" stroke-linejoin="round"`;
  if (n.opacity !== undefined) a += ` opacity="${n.opacity}"`;
  return a;
}

export function nodeToString(n) {
  if (n.type === "group") return `<g class="fig fig-${n.kind}" data-x="${n.x.toFixed(1)}"${n.count ? ` data-count="${n.count}"` : ""}${n.shrine ? ` data-shrine="1"` : ""} style="--j:${(n.i % 5) * 70}ms">${n.children.map(nodeToString).join("")}</g>`;
  if (n.type === "path") return `<path d="${n.d}"${styleAttrs(n)}/>`;
  if (n.type === "rect") return `<rect x="${n.x.toFixed(1)}" y="${n.y.toFixed(1)}" width="${n.w.toFixed(1)}" height="${n.h.toFixed(1)}"${styleAttrs(n)}/>`;
  return "";
}

// One <g> for the part of a chunk that belongs to a layer.
export function chunkLayerString(chunk, layer) {
  return `<g class="chunk" data-chunk="${chunk.c}" transform="translate(${chunk.c * W},0)">${chunk.nodes.filter((n) => n.layer === layer).map(nodeToString).join("")}</g>`;
}

export function bandString(band, x0, x1, mist = 0.6) {
  const op = band.id === "gold" ? band.opacity : band.opacity * mist;
  return `<rect id="${band.id}" x="${x0.toFixed(1)}" y="${band.y.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${band.h.toFixed(1)}" fill="${band.fill}" opacity="${op}"/>`;
}

export function defsString() {
  const grad = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</linearGradient>`;
  return `<defs>${grad("sky", [[0, C.skyTop, 1], [0.55, "#EDE0C8", 1], [1, C.skyBot, 1]])}${grad("mistFar", [[0, C.mist, 0], [0.6, C.mist, 1], [1, C.mist, 0]])}${grad("mistNear", [[0, C.mist, 0], [0.5, C.mist, 0.8], [1, C.mist, 0]])}</defs>`;
}

// The empty layer skeleton the browser fills incrementally: <g id="L-sky"/>, band, <g id="L-snow"/>, ...
export function skeletonString() {
  return LAYERS.map((l) => `<g id="L-${l}"></g>` + BANDS.filter((b) => b.after === l).map((b) => bandString(b, 0, 0)).join("") + (l === "sky" ? `<g id="celestial"></g>` : "")).join("");
}

// A standalone SVG document of the given chunks, viewBox from x0 to x1.
export function standaloneSvg(chunks, x0, x1, title, mist = 0.6) {
  const cs = [...chunks].sort((a, b) => a.c - b.c);
  const bx0 = Math.min(x0, cs[0].c * W), bx1 = Math.max(x1, (cs[cs.length - 1].c + 1) * W);
  const body = LAYERS.map((l) => `<g id="L-${l}">${cs.map((c) => chunkLayerString(c, l)).join("")}</g>` + BANDS.filter((b) => b.after === l).map((b) => bandString(b, bx0, bx1, mist)).join("")).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0.toFixed(1)} 0 ${(x1 - x0).toFixed(1)} ${H}" width="${(x1 - x0).toFixed(0)}" height="${H}"><title>${esc(title)}</title>${defsString()}${body}</svg>`;
}
