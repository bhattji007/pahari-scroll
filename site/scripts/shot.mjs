// Real-time screenshots of the running site through the Chrome DevTools Protocol, so CSS animations
// actually advance (headless --screenshot freezes them). No dependencies: Node 22+ has WebSocket.
//   node scripts/shot.mjs --url "http://localhost:8787/#seed=7" --at 250,700,1500 --out shots/ --w 1440 --h 900
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const url = arg("url", "http://localhost:8787/#seed=7"), out = arg("out", "shots"), w = Number(arg("w", 1440)), h = Number(arg("h", 900));
const ats = arg("at", "300,900,2500").split(",").map(Number);
const browser = ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
const port = 9333;
const proc = spawn(browser, [`--headless=new`, `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, `--hide-scrollbars`, `--disable-gpu`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(150); } }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const waiting = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m.result); waiting.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.enable");
  const t0 = Date.now();
  await send("Page.navigate", { url });
  mkdirSync(out, { recursive: true });
  for (const at of ats) {
    const wait = t0 + at - Date.now(); if (wait > 0) await sleep(wait);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${out}/t${at}.png`, Buffer.from(data, "base64"));
    console.log(`wrote ${out}/t${at}.png`);
  }
  ws.close();
} finally { proc.kill(); }
