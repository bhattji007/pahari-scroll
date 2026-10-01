# जागेश्वर · Pahari Scroll

An infinite, procedurally generated painting of the Jageshwar temple valley in Kumaon, Uttarakhand,
drawn in the idiom of Kangra miniatures. Stepped Nagara stone temples on terraced slopes under deodar,
the Nanda Devi snow line behind, the Jataganga below. One seed, no images, no textures, no dependencies, one looped background track.

A personal homage to Lingdong Huang's *{Shan, Shui}\** , remade for the hills I come from.

## Layout

| path | what |
|------|------|
| `site/` | the website: plain ES modules + SVG, zero dependencies. See `site/README.md` to run it. |
| `MATH.md` | the math behind every element: seeded noise, fBm, Gaussian peaks, ridged snow, the stepped shikhara, footings, infinite chunking |
| `pahari.js`, `aipan.js` | the original generator in pen.dev script form, used for the design boards |
| `pahari-scroll.pen` | the pen.dev design file: scroll board and element studies |
| `reference.md` | sourced facts about Jageshwar, Kumaoni houses, Kangra pigments and Aipan, plus observations from reference photographs |

Live at **https://jageshwar.shubham.club**.

## Run the site

```
cd site
npm run dev          # python3 -m http.server 8787
open http://localhost:8787/#seed=7
```

Scroll, drag or use the arrow keys. Space drifts. Any word works as a seed. *Last Light Over Peaks*
plays in the background; the speaker mutes it. The URL reproduces exactly what you see.
