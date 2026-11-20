// Measures warm on-device latency: one create(), then N prompts in the same session.
// Usage: node scripts/probe-warm-latency.mjs [cdpPort] [n]
const PORT = process.argv[2] || '9222';
const N = Number(process.argv[3] || 3);

const rpc = (ws, id, method, params) =>
  new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
let page = targets.find((t) => t.type === 'page');
if (!page) {
  page = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const call = (method, params) => rpc(ws, ++id, method, params);

await call('Page.enable', {});
await call('Page.navigate', { url: 'https://example.com' });
await new Promise((r) => setTimeout(r, 2000));

const expr = `(async () => {
  const out = { runs: [] };
  try {
    const tCreate = performance.now();
    const s = await window.LanguageModel.create();
    out.createMs = Math.round(performance.now() - tCreate);
    for (let i = 0; i < ${N}; i++) {
      const t0 = performance.now();
      const reply = await s.prompt('Reply with exactly the word READY and nothing else.');
      out.runs.push({ ms: Math.round(performance.now() - t0), reply: String(reply).slice(0, 40) });
    }
    await s.destroy?.();
  } catch (e) {
    out.error = String(e);
  }
  return out;
})()`;

const evaluated = await call('Runtime.evaluate', {
  expression: expr,
  awaitPromise: true,
  returnByValue: true,
});

console.log(JSON.stringify(evaluated.result.value ?? evaluated, null, 2));
ws.close();
process.exit(0);
