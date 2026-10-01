// Aipan-style border: geru ground, white rice-paste (bisvar) dots, creeper and corner lotus.
// Drawn once around the viewport as a fixed frame, like the painted mount of a scroll.
import { C } from "./elements.js";

export function aipanFrame(width, height, band) {
  const W = width, H = height, b = band, g = C.geruBorder, w = C.bisvar;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  out += `<path fill="${g}" fill-rule="evenodd" d="M0,0H${W}V${H}H0ZM${b},${b}V${H - b}H${W - b}V${b}Z"/>`;
  out += `<rect x="${b * 0.28}" y="${b * 0.28}" width="${W - b * 0.56}" height="${H - b * 0.56}" fill="none" stroke="${w}" stroke-width="1.2"/>`;
  out += `<rect x="${b * 0.14}" y="${b * 0.14}" width="${W - b * 0.28}" height="${H - b * 0.28}" fill="none" stroke="${w}" stroke-width="0.8"/>`;
  const step = b * 0.6, r = b * 0.06;
  let dots = "";
  const dot = (x, y) => `M${x - r},${y}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
  for (let x = b; x < W - b; x += step) { dots += dot(x, b * 0.5) + dot(x, H - b * 0.5); }
  for (let y = b; y < H - b; y += step) { dots += dot(b * 0.5, y) + dot(W - b * 0.5, y); }
  out += `<path d="${dots}" fill="${w}"/>`;
  let vine = "";
  for (let x = b * 1.2; x < W - b * 1.2; x += b * 1.2) vine += `M${x},${b * 0.75}q${b * 0.3},${-b * 0.3} ${b * 0.6},0M${x},${H - b * 0.75}q${b * 0.3},${b * 0.3} ${b * 0.6},0`;
  out += `<path d="${vine}" fill="none" stroke="${w}" stroke-width="0.8"/>`;
  let lotus = "";
  for (const [cx, cy] of [[b * 0.5, b * 0.5], [W - b * 0.5, b * 0.5], [b * 0.5, H - b * 0.5], [W - b * 0.5, H - b * 0.5]]) {
    const R = b * 0.34;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, a1 = a + Math.PI / 8, a2 = a - Math.PI / 8;
      lotus += `M${cx},${cy}Q${cx + R * 0.7 * Math.cos(a1)},${cy + R * 0.7 * Math.sin(a1)} ${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}Q${cx + R * 0.7 * Math.cos(a2)},${cy + R * 0.7 * Math.sin(a2)} ${cx},${cy}Z`;
    }
  }
  out += `<path d="${lotus}" fill="${g}" stroke="${w}" stroke-width="1"/>`;
  return out + "</svg>";
}
