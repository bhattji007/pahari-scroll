import { hash01 } from "./prng.js";

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// 1-D value noise over an infinite lattice. Lattice heights are hashed from (seed, layer, index),
// so the same x always gives the same height no matter which chunk asks for it.
export function makeNoise(seed, layer, cellSize) {
  return (x) => {
    const u = x / cellSize, i = Math.floor(u), f = u - i;
    const a = hash01(seed, layer, i), b = hash01(seed, layer, i + 1);
    return lerp(a, b, smooth(f));
  };
}

// Fractional Brownian motion: octaves at half the cell size and half the amplitude each.
export function makeFbm(seed, layer, cellSize, octaves) {
  const layers = Array.from({ length: octaves }, (_, o) => makeNoise(seed, layer * 16 + o, cellSize / 2 ** o));
  return (x) => {
    let v = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < octaves; o++) { v += amp * layers[o](x); norm += amp; amp *= 0.5; }
    return v / norm;
  };
}
