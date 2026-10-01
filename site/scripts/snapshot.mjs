// Render a run of chunks to a standalone SVG, e.g. for a poster or a README image.
//   node scripts/snapshot.mjs --seed 7 --from 0 --to 2 --out jageshwar.svg
import { writeFileSync } from "node:fs";
import { seedFromString } from "../src/prng.js";
import { W, makeTerrain, generateChunk } from "../src/chunk.js";
import { standaloneSvg } from "../src/render.js";
import { flatten } from "../src/elements.js";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const seedStr = arg("seed", "7"), from = Number(arg("from", 0)), to = Number(arg("to", 1)), out = arg("out", `jageshwar-${seedStr}.svg`);
const seed = /^\d+$/.test(seedStr) ? Number(seedStr) >>> 0 : seedFromString(seedStr);
const terrain = makeTerrain(seed);
const chunks = [];
for (let c = from; c <= to; c++) chunks.push(generateChunk(seed, c, terrain));
writeFileSync(out, standaloneSvg(chunks, from * W, (to + 1) * W, `Pahari Scroll · Jageshwar · seed ${seedStr}`));
console.log(`wrote ${out}: chunks ${from}..${to}, ${chunks.reduce((n, c) => n + flatten(c.nodes).length, 0)} nodes, complex in [${chunks.filter((c) => c.complex).map((c) => c.c)}]`);
