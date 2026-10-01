# Pahari Scroll — the math behind the picture

Everything on the canvas comes out of `pahari.js`. There are no images and no textures; every shape is a
function of three things: a **seed**, a **position**, and a handful of **inputs** (peaks, shrines, houses,
trees, storm, mist, flow). This note walks through each layer in the order it is drawn, and ends with how
the single chunk becomes an infinite valley.

---

## 1. Determinism: the random number generator

Shan Shui's whole trick is that the scroll is *reproducible*: the same seed always paints the same
mountains, so the URL is the artwork. We need a random generator we control, not `Math.random()`.

```
mulberry32(seed):
  a = seed
  each call:
    a  = a + 0x6D2B79F5          (mod 2^32)
    t  = (a ^ (a >>> 15)) * (a | 1)
    t ^= t + (t ^ (t >>> 7)) * (t | 61)
    return (t ^ (t >>> 14)) / 2^32      → a float in [0, 1)
```

It is a 32-bit hash-based generator: one integer of state, a handful of multiplies and xor-shifts. Two
properties matter for us:

* **Same seed → same sequence.** Seed 7 always gives the same forest.
* **Order matters.** Every element consumes numbers from the *one* stream in drawing order, so inserting a
  new element early would reshuffle everything after it. The infinite-scroll section below deals with that.

Helpers built on top: `rand(a, b)` = `a + (b − a)·R()`, `rint(a, b)` = integer in `[a, b]`.

The seed is stretched before use: `seed · 7919 + 1`. Adjacent seeds (7, 8, 9) would otherwise produce
correlated first values; multiplying by a prime spreads them through the state space.

---

## 2. Terrain: value noise and fractional Brownian motion

A ridgeline is a function `y = ridge(x)`. We want it smooth but irregular, like a hill rather than a sine
wave. The standard tool is **1-D value noise**.

### 2.1 Value noise

1. Lay a lattice of `cells` random heights `h₀, h₁, …` (each from `R()`).
2. For a query `x`, find the two lattice points either side, `i = ⌊x⌋`, and the fraction `f = x − i`.
3. Blend them with a **smoothstep** curve instead of a straight line:

```
smooth(f) = f² · (3 − 2f)
noise(x)  = lerp(hᵢ, hᵢ₊₁, smooth(f))
```

Smoothstep has zero slope at `f = 0` and `f = 1`, so the curve glides through each lattice point instead of
forming a kink. Without it the hills look like a chain of straight segments.

The lattice index wraps (`i mod cells`), so the function is periodic. That is deliberate: a period equal to
the scroll width means the left and right edges of a chunk meet, which section 7 uses.

### 2.2 fBm: stacking octaves

One layer of noise is too blobby. Real ridgelines have big rolls with small bumps on top of them.
**Fractional Brownian motion** sums several noise layers, each at double the frequency and half the
amplitude of the last:

```
fbm(x) = Σₖ  0.5ᵏ · noiseₖ(x · 2ᵏ)      k = 0 … octaves−1
         ───────────────────────────
                 Σₖ 0.5ᵏ
```

The division renormalises the result back into `[0, 1]`. Octave 0 gives the overall shape, octave 1 the
secondary bumps, octave 2 the texture. The ratio of 0.5 (the "persistence") controls roughness: lower makes
calmer hills, higher makes craggy ones.

### 2.3 The three hill layers

Each layer `L` is a ridge `baseY_L − amp_L · (fbm_L(x/W · cells_L) − 0.5) · 2`, filled down to the bottom of
the frame. Depth is faked the way miniature painters do it, by stacking and by colour, not by perspective:

| layer      | baseY  | amplitude | cells | octaves | colour                        |
|------------|--------|-----------|-------|---------|-------------------------------|
| far hills  | 0.52 H | 40        | 7     | 3       | indigo-grey, close to the sky |
| mid hills  | 0.66 H | 28        | 9     | 3       | malachite                     |
| near slope | 0.80 H | 36        | 6     | 2       | dark green, heavy outline     |

Far layers are lighter and bluer (atmospheric perspective) and have no outline; the near slope has the
darkest outline. That is the entire depth cue, and it is exactly how Kangra painters build distance.

### 2.4 Named peaks: Gaussian bumps

fBm cannot promise a number of peaks, and a composition needs a countable rhythm. So the mid ridge adds one
**Gaussian bump** per peak:

```
ridge(x) = baseY − amp·(fbm(…) − 0.5)·2 − Σₚ  hₚ · exp( −(x − xₚ)² / (2 σₚ²) )
```

Each peak `p` has a centre `xₚ` (evenly spaced across the width, then jittered by ±25 % of the spacing),
a height `hₚ ∈ [70, 140]` and a width `σₚ ∈ [90, 160]`. A Gaussian is used because it is smooth everywhere
and falls to nothing, so bumps blend into the fBm rather than sitting on it like bolts.

### 2.5 The snow range: ridged noise

Nanda Devi should be *sharp*, not rolling. Folding the noise around its midpoint does that:

```
snowRidge(x) = 0.36 H − |fbm(x) − 0.5| · 2 · 0.16 H − 10
```

Taking the absolute value turns every zero-crossing of `fbm − 0.5` into a V-shaped crease; subtracting it
from the baseline flips the creases upward into peaks. This is the classic "ridged multifractal" trick from
terrain generation. Diagonal shading strokes every 90 px suggest ice faces without any shading maths.

### 2.6 Mist

Two rectangles with a vertical linear gradient `transparent → cream → transparent`, one across the far
hills and one across the mid/near boundary. Their `opacity` is the `mist` input. Pure compositing; it hides
the seam between layers, which is also what mist does in real Kumaon valleys at dawn.

### 2.7 Terraces

Terraced fields (seedhi khet) are contour lines of the slope. A contour is the ridge shifted down:

```
terraceᵢ(x) = near(x) + i·13 + 2·sin(x/37 + i)
```

The small sine wobble keeps the lines from being perfectly parallel; real terrace walls follow the ground.

---

## 3. The Jageshwar temple: stepped Nagara

The temples are classical North Indian Nagara stone architecture, so the drawing is built the way the
masons built it: as a stack of horizontal courses that step inward. One function draws every temple in the
valley, from the 170 px Mahamrityunjaya to a 22 px shrine on a far ridge. Inputs: centre `cx`, ground
`by`, height `h`, base width `w`. Every proportion below is a fraction of those two.

Vertical stack, bottom to top:

```
jagati     two plinth steps, 1.7w and 1.4w wide, 0.035h tall each   (only for free-standing shrines)
jangha     the sanctum wall, w × 0.30h
shikhara   the tower, 0.56h, made of n receding tiers
griva      a dark neck, 0.035h
amalaka    the ribbed disc
kalasha    the pot and finial
```

### 3.1 The stepped plinth, and why nothing floats

Free-standing shrines sit on their own two-step jagati. Towers inside a complex share a two-step platform
instead (section 3.6). Either way the eye enters the temple through horizontal steps, which is the
"step-oriented" quality of the real site.

A flat slab laid on a sloping ridge leaves a gap wherever the ground falls away, and the temple appears
to hover. Real hillside builders level a terrace and hold it up with a retaining wall, so the drawing
does the same. The lowest step is a **footing** polygon rather than a rectangle:

```
top edge      flat, at  y = min(ground(x)) over the footing's span, minus the step height
bottom edge   follows   y = ground(x) + sink,   sampled every 6 px
```

Taking the *minimum* of the ground (the highest point, since y grows downward) means the platform top
never dips below the slope anywhere along its length; on the downhill side the polygon simply extends
further down and becomes the retaining wall. Horizontal course lines are drawn across that wall at a
fixed step, each line clipped to the x-ranges where the wall is actually exposed, so the masonry only
appears where there is masonry. `sink` (3–4 px) pushes the bottom edge slightly below the ridge line to
avoid a hairline of sky between stone and grass.

### 3.2 Jangha: wall with rathas

A Nagara plan is not a plain square. The walls project outward in vertical bands called rathas; seen from
the side they read as lighter strips. The wall is drawn as three overlapping rectangles in three stone
tones:

```
body        w wide            mid stone
pratiratha  0.16w at ±0.30w   lighter (the two intermediate projections)
bhadra      0.36w, centred    lightest (the central projection)
```

That is a pancharatha elevation: five vertical divisions. Three vedibandha moulding lines sit across the
bottom 30 % of the wall. The door is a dark `0.14w × 0.62·wallH` rectangle under a thicker lintel line.

### 3.3 Shikhara: receding bhumi tiers

The tower is `n = max(4, round(h/14))` tiers of equal height `th = 0.56h / n`. Tier `k` runs from width
`wₖ` at its bottom to `wₖ₊₁` at its top, so each tier is a shallow trapezoid and the stack of them is a
staircase:

```
wₖ = w · (1 − 0.5 · (k/n)^1.6)
```

Two things are encoded in that one line:

* **The tower narrows to half its base width** at the top (`1 − 0.5`), the ratio measured off the Jageshwar
  photographs.
* **The exponent 1.6 makes the taper curvilinear.** With exponent 1 the tiers shrink by a constant amount
  and the silhouette is a straight-sided pyramid. With 1.6 the early tiers barely shrink and the late ones
  shrink fast, so the outline bows outward low down and sweeps in near the top: the latina curve, achieved
  entirely with straight-edged steps. That is exactly how a stone shikhara gets its curve, course by course.

Each tier also carries a lighter central strip at 36 % of its width, the bhadra continuing up the tower as
the lata. The strip narrows with the tier, so it converges toward the griva.

### 3.4 Bhumi-amalakas

On a latina tower the storeys (bhumis) are marked at the corners by small ribbed discs. Every third tier
(`k mod 3 = 2`) gets one on each corner, drawn as a tiny ellipse `0.045w × 0.22·th` centred *on* the
corner so half of it overhangs. These small discs are what make a tower read as Nagara rather than as a
generic spire; they also pick out the staircase rhythm of the tiers.

### 3.5 Griva, amalaka, kalasha

The griva is a dark neck at 72 % of the top width, which visually separates the tower from its crown. The
amalaka is an ellipse with

```
rx = 0.36 w        ≈ 0.72 w across; the tower top is 0.5 w, so it overhangs
ry = 0.40 rx       flattened, as the real stone discs are
```

Its eleven ribs are vertical chords at angles `θ = kπ/12`, `x = cx − rx·cos θ`, half-length `ry·sin θ`.
Spacing ribs by angle packs them tighter at the rim, which is what a real cylinder of ribs does in
elevation. The kalasha is a small ellipse (`0.14 rx × 0.12 rx`) on top, then a finial stem.

### 3.6 Clusters and the valley

Jageshwar is not one temple. The main complex has 124 to 125 structures, and the wider valley over 200
shrines. The scene is laid out to feel like that:

```
main complex     18–26 towers on a shared two-step platform, the tallest 170 px, the rest 22–42 % of it
                 with one in five at 50–70 % (the larger secondary temples of the site)
second group     5–8 towers at 80–105 px (the Dandeshwar group, about 1 km from the main one)
near shrines     0.6 · shrines groups of 1–3 towers at 40–64 px, each on its own stepped plinth
far shrines      0.4 · shrines singles or pairs at 22–36 px on the mid ridge, behind the deodars
```

The platform is a footing (section 3.1): its top sits at the highest ground point under the complex and
its retaining wall grows on the downhill side, which is exactly how the real precinct is terraced into the
Jataganga valley side.

Platform width grows with the square root of the tower count, `spread = 1.5·mainH·√(count/10)`, so a
cluster of 24 is about 1.5× as wide as a cluster of 10 rather than 2.4×. Towers are sorted tallest-first
so the big one is drawn behind and the small ones overlap in front; that overlap is what makes a group
read as dense stone rather than a row of spires.

Nothing collides: an **occupancy list** records every claimed x-interval, and each new shrine, house or
cluster draws up to 24 candidate positions and takes the first one that is free. If none is free the
element is skipped, so a crowded seed simply has fewer houses rather than overlapping ones.

### 3.7 Node budget

A temple is five path nodes, one per pigment: stone (wall, tiers, amalaka, kalasha), light stone (plinth,
pratirathas, bhumi-amalakas), lighter stone (bhadra and lata), dark (door, griva) and lines (mouldings,
lintel, ribs, finial). Fifty temples cost 250 nodes, and the whole scene stays near 350.

---

## 4. Deodar

A conifer silhouette is a stack of chevrons. For a tree of height `h`:

```
hw      = h · rand(0.22, 0.30)        half-width at the lowest tier
tiers   = rint(5, 8)
top     = by − h
trunkTop = by − 0.18 h
spacing = (trunkTop − top) / tiers
```

For tier `t = 1 … tiers`, with `f = t / tiers`:

```
width_t = hw · lerp(0.15, 1, f) · rand(0.85, 1.1)     grows linearly toward the base, with jitter
tipY_t  = lerp(top, trunkTop, f) + 0.04 h · f         tips droop more the lower they are
notchY_t = tipY_t + 0.22 spacing                      the notch is BELOW the tip
notchX_t = 0.55 width_t
```

The outline goes apex → tip₁ → notch₁ → tip₂ → … → trunk → mirror back up. The notch sitting lower than
the tip it follows makes each tier a downward sweep, the deodar's layered, drooping look.

---

## 5. Kumaoni house

A house is rectangles and one polygon, scaled by `s`:

```
body        46 s × 28 s, whitewash, dark outline
geru band   bottom 30 % of the body, red ochre
roof        polygon: eaves overhang 4 s each side, ridge inset 5 s, height 11 s   → low-pitch gable
slate rows  3 lines, inset (4s + 5s)·f − 4s so they stay parallel to the gable edges
balcony     line at 55 % height + five X's (lattice) 18 % tall
windows     two dark 16 % × 22 % rectangles near the top
door        16 % × 30 % blue rectangle in the geru band
base        retaining wall 8 s tall with one course line
```

Houses are few by default (4); this is a temple valley.

---

## 6. River, sky and weather

**River.** The bank is a low-octave fBm (2 octaves, 8 cells) around `riverTop`, ±12 px. The `flow` input
moves `riverTop` between `0.96 H` (a trickle) and `0.84 H` (in spate), and sets the number of ripple
strokes (`40 + 60·flow`). Each ripple is a tiny quadratic arc `q (l/2, −3) (l, 0)`.

**Sky.** A vertical gradient ochre → cream, plus a 33 %-alpha gold band across `0.30–0.36 H`, the horizon
band Kangra skies have. In storm mode the gradient becomes indigo → slate grey with rain strokes.

---

## 7. Making it infinite

The canvas version is a single 2360 × 860 chunk. The web version scrolls forever:

1. **Chunk the x-axis.** Chunk `c` covers `[c·W, (c+1)·W)`.
2. **Seed per chunk.** `seed_c = hash(globalSeed, c)`. Every chunk gets its own `mulberry32` stream, so the
   drawing order inside one chunk never affects another, and any chunk can be generated on demand. This is
   the fix for the "order matters" caveat in section 1.
3. **Continuity across the seam.** The periodic lattice from 2.1 gives it for free if the lattice is indexed
   by *global* `x` with a lattice seeded from `globalSeed` only, while the *content* (shrines, trees,
   houses) uses `seed_c`. Terrain is global; decoration is local.
4. **Rhythm of the valley.** The dense complex should be rare, once every `rand(4, 7)` chunks, with the
   Dandeshwar-sized group every 2–3 chunks and scattered shrines in every chunk. That matches the real
   valley: one great cluster, a few groups, and shrines wherever a spur meets the stream.
5. **Lazy generation.** Keep three chunks alive (previous, current, next); each is ~350 SVG nodes.

This is the same structure as `{Shan, Shui}*`: a seed in the URL, chunked generation, a planner that
decides *what* goes in each chunk, and element functions that decide *how* it looks.

---

## 8. Numbers that are judgment calls

* `(k/n)^1.6` tier taper: the curve of the shikhara. 1.0 is a pyramid, 2.0 is a bulb.
* `0.5` top-to-base width ratio and `rx = 0.36w` amalaka: measured from photographs; below 0.3 the disc
  stops reading as Jageshwar.
* Every third tier for bhumi-amalakas: every tier is too busy at scene scale, every fourth loses the rhythm.
* `22–42 %` shrine-to-main height in the complex, with one in five at `50–70 %`: the photographs show a few
  mid-sized temples among many small ones, not a smooth spread.
* fBm persistence 0.5, octaves 2–3: hill roughness. Four octaves looks like noise, not hills.
* `0.22 spacing` notch drop on the deodar: 0 gives a Christmas tree, 0.4 a weeping willow.
