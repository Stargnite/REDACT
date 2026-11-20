// Availability-only probe: does NOT call LanguageModel.create(), so it returns fast
// even while Chrome re-initialises the on-device model.
// Usage: node scripts/probe-availability.mjs [cdpPort]
const PORT = process.argv[2] || '9222';

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

async function findOrMakePage() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (page) return page;
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return await r.json();
}

const page = await findOrMakePage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const call = (method, params) => rpc(ws, ++id, method, params);

await call('Page.enable', {});
await call('Page.navigate', { url: 'https://example.com' });
await new Promise((r) => setTimeout(r, 2000));

const expr = `(async () => {
  const out = {
    hasLanguageModel: typeof window.LanguageModel !== 'undefined',
    secureContext: window.isSecureContext,
  };
  if (!out.hasLanguageModel) return out;
  try { out.availability = await window.LanguageModel.availability(); }
  catch (e) { out.availabilityError = String(e); }
  return out;
})()`;

const evaluated = await call('Runtime.evaluate', {
  expression: expr,
  awaitPromise: true,
  returnByValue: true,
});

console.log(JSON.stringify(evaluated.result.value ?? evaluated));
ws.close();
process.exit(0);
