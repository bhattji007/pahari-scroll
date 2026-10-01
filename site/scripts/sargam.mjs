// Print the composed melody as sargam so the phrasing can be checked without listening.
//   node scripts/sargam.mjs --seed jageshwar --rounds 3
// Notation: S R G P D S' R' G'; each · is one extra eighth; ~ = meend slide in; (R) = kan grace; ≈ = gamak.
import { composeRound, sargam } from "../src/pahari-audio.js";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const seed = arg("seed", "jageshwar"), rounds = Number(arg("rounds", 3)), screen = Number(arg("screen", 0));
for (let r = 0; r < rounds; r++) {
  const { phrases, restBars } = composeRound(seed, screen, r);
  console.log(`round ${r}  (rest ${restBars} bars after)`);
  ["A ", "A'", "B ", "A "].forEach((label, i) => console.log(`  ${label}  ${sargam(phrases[i])}`));
}
