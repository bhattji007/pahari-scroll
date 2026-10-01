/**
 * @schema 2.11
 * @input band: number = 40
 * @input geru: color = #A8432E
 * @input bisvar: color = #F5EFE3
 */
const W = pencil.width, H = pencil.height, b = pencil.input.band, g = pencil.input.geru, w = pencil.input.bisvar;
const nodes = [{ type: "rectangle", name: "Geru ground", x: 0, y: 0, width: W, height: H, fill: g }];
nodes.push({ type: "rectangle", name: "Inner line", x: b * 0.28, y: b * 0.28, width: W - b * 0.56, height: H - b * 0.56, stroke: w, strokeWidth: 1.2 });
nodes.push({ type: "rectangle", name: "Outer line", x: b * 0.14, y: b * 0.14, width: W - b * 0.28, height: H - b * 0.28, stroke: w, strokeWidth: 0.8 });
const step = b * 0.6, r = b * 0.06;
let dots = "";
for (let x = b; x < W - b; x += step) for (const y of [b * 0.5, H - b * 0.5]) dots += `M${x - r},${y}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
for (let y = b; y < H - b; y += step) for (const x of [b * 0.5, W - b * 0.5]) dots += `M${x - r},${y}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
nodes.push({ type: "path", name: "Dot rows", x: 0, y: 0, width: W, height: H, viewBox: [0, 0, W, H], geometry: dots, fill: w });
let lotus = "";
for (const [cx, cy] of [[b * 0.5, b * 0.5], [W - b * 0.5, b * 0.5], [b * 0.5, H - b * 0.5], [W - b * 0.5, H - b * 0.5]]) {
  const R = b * 0.34;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, a1 = a + Math.PI / 8, a2 = a - Math.PI / 8;
    lotus += `M${cx},${cy}Q${cx + R * 0.7 * Math.cos(a1)},${cy + R * 0.7 * Math.sin(a1)} ${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}Q${cx + R * 0.7 * Math.cos(a2)},${cy + R * 0.7 * Math.sin(a2)} ${cx},${cy}Z`;
  }
}
nodes.push({ type: "path", name: "Corner lotus", x: 0, y: 0, width: W, height: H, viewBox: [0, 0, W, H], geometry: lotus, stroke: w, strokeWidth: 1, fill: g });
const inner = b * 0.5 + b * 0.5;
let vine = "";
for (let x = b * 1.2; x < W - b * 1.2; x += b * 1.2) { vine += `M${x},${b * 0.75}q${b * 0.3},${-b * 0.3} ${b * 0.6},0M${x},${H - b * 0.75}q${b * 0.3},${b * 0.3} ${b * 0.6},0`; }
nodes.push({ type: "path", name: "Creeper", x: 0, y: 0, width: W, height: H, viewBox: [0, 0, W, H], geometry: vine, stroke: w, strokeWidth: 0.8 });
return nodes;
