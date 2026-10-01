# जागेश्वर · Pahari Scroll

An infinite, procedurally generated Kumaoni landscape: the Jageshwar temple valley painted in the idiom of
Kangra miniatures. Nagara stone temples step down terraced slopes under deodar, with the Nanda Devi snow
line behind and the Jataganga below. No images, no textures, no dependencies. One seed, one valley, one background track.

Modelled on Lingdong Huang's *{Shan, Shui}\**.

## Run

Any static server works; ES modules need http, not `file://`.

```
cd site
npm run dev        # python3 -m http.server 8787
open http://localhost:8787/#seed=7
```

## Controls

- scroll wheel, drag, or arrow keys to move along the valley
- space or **drift** to auto-scroll
- **seed** to type a number or a word; **new** for a random one
- **save svg** downloads the current view as a standalone SVG
- background music, *Last Light Over Peaks*, loops from the start; browsers that block unmuted autoplay start it on your first scroll, click or key. The speaker button mutes it
- the URL hash carries `seed` and `x`, so a link reproduces exactly what you see
- figures are built as they scroll into view: each temple, tree, house and platform rises from its ground point and its pigment layers appear in construction order (stone, light stone, rathas, openings, line work). After a jump the visible figures build in a left-to-right sweep. `prefers-reduced-motion` disables it.

## How it is built

- `src/prng.js` seeded generator and integer hash, so any chunk can be generated in any order
- `src/noise.js` value noise over an infinite lattice, and fBm
- `src/elements.js` the vocabulary: deodar, Nagara temple, temple cluster, Kumaoni house, footings
- `src/chunk.js` global terrain plus per-chunk planning: where the great complex, the groups, the shrines, houses and trees go
- `src/render.js` nodes to SVG strings; the scene is grouped by layer, not by chunk, so the mist and gold bands are single continuous rectangles and chunk boundaries never seam
- `src/aipan.js` the painted border around the viewport
- `audio/last-light-over-peaks.mp3` the background track, the one asset in the project
- `src/main.js` viewport, chunk lifecycle, input, URL state, and the viewport-triggered build animation

The math is written up in `../MATH.md`. The design boards and reference research live one directory up.

## Deploy

Live at https://jageshwar.shubham.club, served as Cloudflare Worker static assets. From `site/`:

```
npx wrangler deploy
```

`wrangler.jsonc` names the worker and the custom domain; `.assetsignore` keeps scripts and config out of the upload.

## Scripts

```
npm test                                    # continuity, determinism, cadence, containment
npm run snapshot -- --seed 7 --from 0 --to 2 --out poster.svg
node scripts/shot.mjs --url "http://localhost:8787/#seed=7" --at 300,900,2500 --out shots   # real-time frames via DevTools Protocol
node scripts/check.mjs                                                                     # load, start music, scroll, reseed, mute; fails on any console error
```
