// Smoke test of the live page over the DevTools Protocol: load, start audio, scroll, ring, reseed,
// and report any console error or uncaught exception. Audio is allowed without a gesture here.
//   node scripts/check.mjs --url "http://localhost:8787/#seed=7"
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const url = arg("url", "http://localhost:8787/#seed=7");
const browser = ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
const port = 9334;
const proc = spawn(browser, ["--headless=new", `--remote-debugging-port=${port}`, "--window-size=1440,900", "--disable-gpu", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(150); } }
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const waiting = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (waiting.has(m.id)) { waiting.get(m.id)(m.result); waiting.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") problems.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) problems.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url }); await sleep(1500);
  const report = {};
  report.figures = await evalJs("document.querySelectorAll('.fig').length");
  report.built = await evalJs("document.querySelectorAll('.fig.in').length");
  await evalJs("document.getElementById('sound').click()"); await sleep(800);
  report.soundOn = await evalJs("document.getElementById('sound').classList.contains('on')");
  report.contexts = await evalJs("(typeof AudioContext !== 'undefined')");
  await evalJs("window.dispatchEvent(new WheelEvent('wheel', { deltaY: 2400, cancelable: true }))"); await sleep(600);
  report.posAfterScroll = await evalJs("document.getElementById('pos').textContent");
  for (let i = 0; i < 12; i++) { await evalJs("window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1500, cancelable: true }))"); await sleep(120); }
  report.posAfterDrift = await evalJs("document.getElementById('pos').textContent");
  report.chunksLoaded = await evalJs("new Set([...document.querySelectorAll('.chunk')].map(g => g.dataset.chunk)).size");
  await evalJs("location.hash = '#seed=kumaon&x=0'"); await sleep(1200);
  report.seedLabel = await evalJs("document.querySelector('#seed b').textContent");
  await evalJs("document.getElementById('sound').click()"); await sleep(300);
  report.soundOffAgain = await evalJs("!document.getElementById('sound').classList.contains('on')");
  await sleep(2000);
  ws.close();
  console.log(JSON.stringify(report, null, 1));
  if (problems.length) { console.log("PROBLEMS:\n" + problems.join("\n")); process.exitCode = 1; } else console.log("no console errors or exceptions");
} finally { proc.kill(); }
