// Probe the real Chrome profile for the built-in AI Prompt API (Gemini Nano).
// Usage: node scripts/probe-prompt-api.mjs [cdpPort]
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

const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
const targets = await res.json();
const page = targets.find((t) => t.type === 'page');
if (!page) {
  console.error('no page target found');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const call = (method, params) => rpc(ws, ++id, method, params);

await call('Page.enable', {});
await call('Page.navigate', { url: 'https://example.com' });
await new Promise((r) => setTimeout(r, 2500));

const expr = `(async () => {
  const out = {
    hasLanguageModel: typeof window.LanguageModel !== 'undefined',
    secureContext: window.isSecureContext,
  };
  if (!out.hasLanguageModel) return out;
  try { out.availability = await window.LanguageModel.availability(); }
  catch (e) { out.availabilityError = String(e); }
  try {
    const s = await window.LanguageModel.create();
    out.session = { maxTokens: s.maxTokens, topK: s.topK, temperature: s.temperature };
    const t0 = performance.now();
    out.reply = await s.prompt('Reply with exactly the word READY and nothing else.');
    out.latencyMs = Math.round(performance.now() - t0);
    await s.destroy?.();
  } catch (e) { out.promptError = String(e); }
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
