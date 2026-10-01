// Live weather for the valley. Open-Meteo (no key) gives current conditions and today's sunrise and
// sunset for Jageshwar; this module turns them into a mood and paints it over the seeded scene:
// sky palette, sun or moon with phase, stars, Kangra clouds, rain, snow, fog, lightning, snow cover,
// frost, mist and wind. The generator itself never changes, so the seed still owns the valley.

export const JAGESHWAR = { name: "Jageshwar", lat: 29.6385, lon: 79.8524, tz: "Asia/Kolkata" };
const API = `https://api.open-meteo.com/v1/forecast?latitude=${JAGESHWAR.lat}&longitude=${JAGESHWAR.lon}` +
  `&current=temperature_2m,relative_humidity_2m,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m` +
  `&daily=sunrise,sunset&timezone=${encodeURIComponent(JAGESHWAR.tz)}&forecast_days=1`;

// ---------- reading the valley ----------
const hm = (iso) => { const [h, m] = iso.slice(11, 16).split(":").map(Number); return h * 60 + m; };
export function istNow() { const d = new Date(new Date().toLocaleString("en-US", { timeZone: JAGESHWAR.tz })); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

export async function fetchWeather() {
  const r = await fetch(API, { cache: "no-store" });
  if (!r.ok) throw new Error("open-meteo " + r.status);
  const j = await r.json(), c = j.current, d = j.daily;
  return { temp: c.temperature_2m, humidity: c.relative_humidity_2m, code: c.weather_code, rain: c.rain, snowfall: c.snowfall, precip: c.precipitation,
    cloud: c.cloud_cover, wind: c.wind_speed_10m, windDir: c.wind_direction_10m, sunrise: hm(d.sunrise[0]), sunset: hm(d.sunset[0]), live: true };
}

// WMO weather codes → a kind the painting understands, and words for the status line.
const KINDS = [
  [[0], "clear", "clear over the peaks"], [[1], "cloudy", "a few clouds"], [[2], "cloudy", "clouds on the ridges"], [[3], "overcast", "overcast"],
  [[45, 48], "fog", "fog in the valley"], [[51, 53, 55, 56, 57], "drizzle", "drizzle on the deodars"],
  [[61, 80, 66], "rain", "light rain on the deodars"], [[63, 81, 67], "rain", "rain on the deodars"], [[65, 82], "heavyrain", "heavy rain"],
  [[71, 85, 77], "snow", "light snow"], [[73], "snow", "snow falling"], [[75, 86], "heavysnow", "heavy snow"],
  [[95], "storm", "thunder in the valley"], [[96, 99], "storm", "hail and thunder"],
];
export function kindOf(code) { return KINDS.find(([codes]) => codes.includes(code)) ?? [[], "clear", "clear"]; }

// Where we are in the day: dawn and dusk are ±40 minutes around sunrise and sunset.
export function dayPhase(wx, now) {
  const { sunrise, sunset } = wx;
  if (Math.abs(now - sunrise) <= 40) return { phase: "dawn", t: (now - sunrise + 40) / 80 };
  if (Math.abs(now - sunset) <= 40) return { phase: "dusk", t: (now - sunset + 40) / 80 };
  if (now > sunrise && now < sunset) return { phase: "day", t: (now - sunrise) / (sunset - sunrise) };
  const nightLen = 1440 - sunset + sunrise, since = now > sunset ? now - sunset : now + 1440 - sunset;
  return { phase: "night", t: since / nightLen };
}

export function describe(wx, now) {
  const { phase } = dayPhase(wx, now), [, kind, words] = kindOf(wx.code);
  const sun = phase === "night" ? `sun rises ${fmt(wx.sunrise)}` : phase === "dawn" ? `sun rising ${fmt(wx.sunrise)}` : phase === "dusk" ? `sun setting ${fmt(wx.sunset)}` : `sun sets ${fmt(wx.sunset)}`;
  const cond = phase === "night" && kind === "clear" ? "clear night over the peaks" : words;
  return `${JAGESHWAR.name} · ${Math.round(wx.temp)}°C · ${cond} · ${sun}`;
}

// Simulation from the URL, e.g. #wx=night,snow,temp:-4,wind:30 or #wx=hour:17.5,rain
const SIM_CODES = { clear: 0, cloudy: 2, overcast: 3, fog: 45, drizzle: 53, rain: 63, heavyrain: 65, snow: 73, heavysnow: 75, storm: 95 };
export function simulate(spec) {
  const wx = { temp: 12, humidity: 60, code: 0, rain: 0, snowfall: 0, precip: 0, cloud: 10, wind: 8, windDir: 250, sunrise: 6 * 60 + 10, sunset: 17 * 60 + 52, live: false, now: 11 * 60 };
  for (const tok of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = tok.split(":");
    if (k in SIM_CODES) { wx.code = SIM_CODES[k]; wx.cloud = k === "clear" ? 10 : k === "cloudy" ? 45 : 90; if (/rain|drizzle|storm/.test(k)) wx.rain = 2; if (/snow/.test(k)) { wx.snowfall = 1; wx.temp = -2; } }
    else if (k === "night") wx.now = 22 * 60; else if (k === "dawn") wx.now = wx.sunrise + 5; else if (k === "dusk") wx.now = wx.sunset - 5; else if (k === "day") wx.now = 12 * 60;
    else if (k === "hour") wx.now = Number(v) * 60; else if (k === "temp") wx.temp = Number(v); else if (k === "wind") wx.wind = Number(v); else if (k === "humidity") wx.humidity = Number(v); else if (k === "cloud") wx.cloud = Number(v);
  }
  return wx;
}

// ---------- painting the weather ----------
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const SKY = { day: ["#E6D5B4", "#EDE0C8", "#F4ECDC"], dawn: ["#C9A3A8", "#E8C39A", "#F4E3C8"], dusk: ["#7C6B8C", "#D49A6A", "#F0D9B0"], night: ["#1B2236", "#28324C", "#3C4A66"] };
const GREY = { day: ["#B8B5AD", "#CFCBC2", "#E2DED5"], dawn: ["#A9A1A4", "#C4B9AE", "#DDD3C6"], dusk: ["#6E6978", "#9E8E88", "#C8BCAE"], night: ["#1A1D26", "#232833", "#303745"] };
const GREYING = { clear: 0, cloudy: 0.3, overcast: 0.7, fog: 0.6, drizzle: 0.55, rain: 0.65, heavyrain: 0.8, snow: 0.6, heavysnow: 0.75, storm: 0.85 };

// Moon illumination from the synodic month (good enough for a crescent in a painting).
function moonPhase() { const age = (((Date.now() / 864e5 - 10957.76) % 29.530588) + 29.530588) % 29.530588; return { f: (1 - Math.cos((2 * Math.PI * age) / 29.530588)) / 2, waxing: age < 14.77 }; }

export function createWeather({ scene, celestial, fx, status, H, onBands }) {
  let wx = null, view = { x: 0, vw: 1440 }, mods = { gold: 1, mist: 1 }, lightningTimer = null, kind = "clear", phase = "day";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (() => { let a = 20251001; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  const stars = Array.from({ length: 140 }, () => [rnd(), rnd() * 0.55, 0.5 + rnd() * 1.1]);
  const cloudSeeds = Array.from({ length: 7 }, () => [rnd(), 0.05 + rnd() * 0.22, 0.6 + rnd() * 0.9, rnd()]);

  function now() { return wx?.now ?? istNow(); }

  function setSky(colors, t) { const stops = scene.querySelectorAll("#sky stop"); colors.forEach((c, i) => stops[i] && (stops[i].style.stopColor = c)); }

  // Behind the mountains: sun, moon, stars, clouds. Laid out in scene units across the current view.
  function paintCelestial() {
    const { vw } = view, { t } = dayPhase(wx, now());
    let out = "";
    const starOp = phase === "night" ? 0.85 : phase === "dusk" ? Math.max(0, (t - 0.6) * 2) : phase === "dawn" ? Math.max(0, (0.4 - t) * 2) : 0;
    if (starOp > 0 && GREYING[kind] < 0.6) out += `<g opacity="${starOp.toFixed(2)}" fill="#F5EFE3">${stars.map(([sx, sy, r]) => `<circle cx="${(sx * vw).toFixed(0)}" cy="${(sy * H).toFixed(0)}" r="${r.toFixed(1)}"/>`).join("")}</g>`;
    const arc = (f) => [vw * (0.1 + 0.8 * f), H * 0.34 - Math.sin(Math.PI * f) * H * 0.24];
    if (phase !== "night") {
      const f = phase === "day" ? t : phase === "dawn" ? 0.02 + t * 0.05 : 0.93 + t * 0.05, [sx, sy] = arc(f), hidden = GREYING[kind] >= 0.7;
      if (!hidden) out += `<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="46" fill="#E9A24A" opacity="0.18"/><circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="22" fill="${phase === "day" ? "#EBC06A" : "#E58B4C"}" opacity="0.95"/>`;
    } else {
      const [mx, my] = arc(t), { f, waxing } = moonPhase(), r = 20, sky = SKY.night[1];
      out += `<circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="${r * 2.4}" fill="#F5EFE3" opacity="0.07"/><circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="${r}" fill="#F3EBD7"/>`;
      if (f < 0.97) out += `<circle cx="${(mx + (waxing ? -1 : 1) * 2 * r * f).toFixed(0)}" cy="${my.toFixed(0)}" r="${r}" fill="${sky}"/>`;
    }
    const n = Math.round((wx.cloud / 100) * 7);
    if (n > 0) {
      const col = phase === "night" ? "#4A5470" : GREYING[kind] > 0.5 ? "#C9C4B8" : "#F6F0E2", drift = reduced ? "" : `style="animation: cloud-drift ${Math.max(60, 260 - wx.wind * 4)}s linear infinite"`;
      out += `<g ${drift} fill="${col}" opacity="${phase === "night" ? 0.5 : 0.85}">` + cloudSeeds.slice(0, n).map(([cx0, cy, s, ph]) => {
        const cx = cx0 * vw, y = cy * H, w = 170 * s, h = 26 * s;
        return `<path d="M${cx - w / 2},${y + h / 2}h${w}c10,0 12,-${h * 0.6} 0,-${h * 0.6}c4,-${h * 0.9} -${w * 0.25},-${h * 1.1} -${w * 0.3},-${h * 0.35}c-${w * 0.1},-${h * 0.9} -${w * 0.42},-${h * 0.7} -${w * 0.42},0c-${w * 0.12},-${h * 0.25} -${w * 0.3},0 -${w * 0.28},${h * 0.35}c-10,0 -12,${h * 0.6} 0,${h * 0.6}z" style="animation-delay:-${(ph * 200).toFixed(0)}s"/>`;
      }).join("") + "</g>";
    }
    celestial.innerHTML = out;
    celestial.setAttribute("transform", `translate(${view.x.toFixed(1)},0)`);
  }

  // In front of everything: tint, fog, rain, snow, lightning. Screen space, so drops fall straight.
  function paintFx() {
    const W = innerWidth, Hh = innerHeight;
    fx.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    const tint = { night: ["#4A5A8A", 0.28, "multiply"], dusk: ["#D08A5E", 0.2, "multiply"], dawn: ["#E8B1A0", 0.22, "soft-light"], day: ["#000", 0, "normal"] }[phase];
    let out = `<rect width="${W}" height="${Hh}" fill="${tint[0]}" opacity="${tint[1]}" style="mix-blend-mode:${tint[2]}"/>`;
    const fog = kind === "fog" ? 0.45 : kind === "heavysnow" ? 0.12 : 0;
    if (fog > 0) out += `<rect width="${W}" height="${Hh}" fill="#F2EADA" opacity="${fog.toFixed(2)}"/>`;
    const rainN = reduced ? 0 : { drizzle: 70, rain: 150, heavyrain: 280, storm: 240 }[kind] ?? 0;
    const snowN = reduced ? 0 : { snow: 140, heavysnow: 260 }[kind] ?? 0;
    const slant = Math.sin(((wx.windDir ?? 250) * Math.PI) / 180) * Math.min(1, wx.wind / 40) * 0.35;
    if (rainN) out += `<g stroke="${phase === "night" ? "#AEB8CC" : "#DDE3EE"}" stroke-width="1" opacity="0.6">` + Array.from({ length: rainN }, (_, i) => { const x = rnd() * W, y = -rnd() * Hh, l = 14 + rnd() * 16, d = 0.7 + rnd() * 0.5; return `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - l * slant).toFixed(0)}" y2="${(y + l).toFixed(0)}" style="animation:rain-fall ${d.toFixed(2)}s linear ${(-rnd() * d).toFixed(2)}s infinite;--h:${Hh + 60}px"/>`; }).join("") + "</g>";
    if (snowN) out += `<g fill="#F7F5F0" opacity="0.9">` + Array.from({ length: snowN }, () => { const x = rnd() * W, y = -rnd() * Hh, r = 1.2 + rnd() * 2, d = 6 + rnd() * 6; return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" style="animation:snow-fall ${d.toFixed(1)}s linear ${(-rnd() * d).toFixed(1)}s infinite;--h:${Hh + 40}px;--sx:${(20 + rnd() * 40 + wx.wind).toFixed(0)}px"/>`; }).join("") + "</g>";
    out += `<rect id="lightning" width="${W}" height="${Hh}" fill="#FFF8E6" opacity="0"/>`;
    fx.innerHTML = out;
    clearInterval(lightningTimer);
    if (kind === "storm" && !reduced) lightningTimer = setInterval(() => { const el = fx.querySelector("#lightning"); if (!el) return; el.style.transition = "none"; el.setAttribute("opacity", "0.7"); setTimeout(() => { el.style.transition = "opacity .35s"; el.setAttribute("opacity", "0"); }, 90); }, 7000 + rnd() * 7000);
  }

  function apply() {
    if (!wx) return;
    const t = now(); ({ phase } = dayPhase(wx, t)); [, kind] = kindOf(wx.code);
    const g = GREYING[kind];
    setSky(SKY[phase].map((c, i) => mixHex(c, GREY[phase][i], g)));
    mods.gold = phase === "day" && g < 0.5 ? 1 - g : 0;
    mods.mist = (kind === "fog" ? 1.5 : 1) * (phase === "night" ? 0.45 : 1) * (/rain|drizzle/.test(kind) ? 1.1 : 1);
    const snowy = /snow/.test(kind) || (wx.snowfall > 0 && wx.temp <= 1), frost = !snowy && wx.temp <= 0;
    scene.classList.remove("day", "dawn", "dusk", "night", "snowy", "frost", "windy");
    scene.classList.add(phase); if (snowy) scene.classList.add("snowy"); if (frost) scene.classList.add("frost");
    if (wx.wind >= 12 && !reduced) { scene.classList.add("windy"); scene.style.setProperty("--sway", `${Math.min(4, wx.wind / 12).toFixed(1)}deg`); scene.style.setProperty("--sway-dur", `${Math.max(1.6, 4.5 - wx.wind / 15).toFixed(1)}s`); }
    paintCelestial(); paintFx();
    const text = describe(wx, t);
    status.textContent = text;
    status.title = `${wx.live ? "Open-Meteo, updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "simulated"} · humidity ${wx.humidity}% · wind ${Math.round(wx.wind)} km/h · cloud ${wx.cloud}%`;
    onBands?.(mods);
  }

  async function refresh() {
    try { wx = await fetchWeather(); apply(); }
    catch (e) { if (!wx) { status.textContent = `${JAGESHWAR.name} · weather unavailable`; status.title = String(e); } }
  }

  return {
    mods,
    onView(x, vw) { view = { x, vw }; if (wx) { celestial.setAttribute("transform", `translate(${x.toFixed(1)},0)`); if (Math.abs(vw - (celestial.dataset.vw || 0)) > 1) { celestial.dataset.vw = vw; paintCelestial(); paintFx(); } } },
    start(sim) {
      if (sim) { wx = simulate(sim); apply(); return; }
      refresh(); setInterval(refresh, 10 * 60 * 1000); setInterval(() => wx && apply(), 60 * 1000);
    },
    get current() { return wx; },
  };
}
