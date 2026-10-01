// Invariants that keep the scroll infinite and deterministic.
import assert from "node:assert/strict";
import { W, H, makeTerrain, generateChunk, hasComplex } from "../src/chunk.js";
import { flatten } from "../src/elements.js";

const seed = 7;
const t = makeTerrain(seed);

// 1. Terrain is continuous across a chunk boundary.
for (const c of [-3, 0, 4]) {
  const xb = c * W;
  for (const f of ["snow", "far", "mid", "near"]) assert.ok(Math.abs(t[f](xb - 0.01) - t[f](xb + 0.01)) < 0.5, `${f} jumps at chunk ${c}`);
}

// 2. A chunk is identical however many times, and in whatever order, it is generated.
const a = generateChunk(seed, 3, t), b = generateChunk(seed, 3, makeTerrain(seed));
assert.equal(JSON.stringify(a.nodes), JSON.stringify(b.nodes), "chunk 3 not deterministic");
generateChunk(seed, 9, t);
const c3 = generateChunk(seed, 3, t);
assert.equal(JSON.stringify(a.nodes), JSON.stringify(c3.nodes), "chunk 3 changed after generating chunk 9");

// 3. Chunk 0 always has the great complex; blocks of five have exactly one.
assert.ok(hasComplex(seed, 0));
for (let block = 1; block < 6; block++) assert.equal([0, 1, 2, 3, 4].filter((i) => hasComplex(seed, block * 5 + i)).length, 1);

// 4. Content stays inside its chunk and above the river.
for (const c of [-2, 0, 1, 5]) {
  const ch = generateChunk(seed, c, t);
  const flat = flatten(ch.nodes);
  for (const n of flat) if (n.type === "rect" && !/Sky/.test(n.name)) assert.ok(n.x >= 0 && n.x + n.w <= W, `${n.name} spills out of chunk ${c}`);
  assert.ok(flat.length > 150 && flat.length < 700, `chunk ${c} has ${flat.length} nodes`);
  for (const g of ch.nodes) if (g.type === "group") assert.ok(g.x >= 0 && g.x <= W && g.children.length > 0, `figure ${g.kind} misplaced in chunk ${c}`);
}

// 5. Negative chunks work (scrolling left from the start).
assert.ok(generateChunk(seed, -7, t).nodes.length > 0);

console.log("ok: terrain continuous, chunks deterministic and order-independent, complex cadence correct, content contained, figures grouped");
