// Deterministic randomness. Everything in the scroll derives from integers hashed together,
// so any chunk can be generated on demand without generating its neighbours first.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 32-bit mix of up to four integers (seed, layer, index, extra). Order matters.
export function hash32(...ints) {
  let h = 0x811c9dc5;
  for (const v of ints) {
    let x = (v | 0) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x ^= x >>> 16;
    h = Math.imul(h ^ x, 0x01000193);
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export const hash01 = (...ints) => hash32(...ints) / 4294967296;

// A string seed (from the URL) becomes an integer the same way every time.
export function seedFromString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function makeRng(seed) {
  const R = mulberry32(seed);
  const rand = (a, b) => a + (b - a) * R();
  const rint = (a, b) => Math.floor(rand(a, b + 1));
  return { R, rand, rint };
}
