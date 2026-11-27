// The Backrooms : banc d'essai de la voix volée, de bout en bout, dans un vrai Chrome (Playwright).
// Deux joueurs dans tools/backrooms-duo.html, un faux micro qui lit un .wav de voix (des phrases séparées de silences),
// le clonage autorisé chez les deux. Toutes les 15 s : phrases gardées de l'autre (bank), échantillon du clonage
// (refSecs), modèle (cl.st : loading puis ready), phrases inventées (fakes). Puis l'entité appelle chez le joueur 1 :
// de loin et au talkie, une phrase inventée (fake) ; de près, une vraie (n).
// Prérequis : un serveur sur le dépôt (python -m http.server 8643 --bind 127.0.0.1), le réseau (le modèle se télécharge).
// Usage : node tools/bench-backrooms-clone.mjs <voix.wav> [minutes max] ; CHROME_PATH pour un autre Chrome.
import { chromium } from 'playwright';
const WAV = process.argv[2];
if (!WAV) { console.log('usage : node tools/bench-backrooms-clone.mjs <voix.wav> [minutes]'); process.exit(1); }
const MIN = +(process.argv[3] || 6);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}`, '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
await ctx.addInitScript(() => {
  try { localStorage.setItem('backrooms_opts', JSON.stringify({ clone: 'on', cloneAsked: true, mic: 'on', quality: 'low' })); } catch (e) {}
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.goto('http://127.0.0.1:8643/tools/backrooms-duo.html?n=2&q=debug%26nointro', { waitUntil: 'commit', timeout: 120000 });
await page.waitForTimeout(15000);
await page.waitForTimeout(12000);
const frames = () => page.frames().filter((f) => f.url().includes('/backrooms/index.html'));
// sortir de l'écran titre : le mode sans souris (comme un clic sur « NO MOUSE »)
for (const f of frames()) {
  await f.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /NO MOUSE/i.test(x.textContent)); if (b) b.click(); const cp = document.getElementById('clickPrompt'); if (cp) cp.click(); }).catch((e) => errs.push('click ' + e.message));
}
const t0 = Date.now();
const probe = (f) => f.evaluate(() => {
  const B = window.__br;
  if (!B || !B.voice || !B.sim) return { none: true };
  const v = B.voice;
  const me = B.sim.player;
  const mates = B.sim.players.filter((q) => q.id !== me.id);
  return {
    cl: B.cloner ? { st: B.cloner.state, pr: B.cloner.progress() } : null, started: !!document.querySelector("canvas"), id: me.id, lv: B.sim.level, t: Math.round(B.sim.time), mic: v.micState,
    cloneIds: v.cloneIds ? v.cloneIds() : null, dbg: v.debug ? v.debug() : null,
    mates: mates.map((q) => ({ id: q.id, clip: v.clipSeconds ? +(v.clipSeconds(q.id) || 0).toFixed(1) : null, fakes: v.fakeCount(q.id), bank: (v.bank() || {})[q.id] })),
  };
}).catch((e) => ({ err: e.message.slice(0, 120) }));
while (Date.now() - t0 < MIN * 60000) {
  await page.waitForTimeout(15000);
  const out = [];
  for (const f of frames()) out.push(await probe(f));
  console.log(`${Math.round((Date.now() - t0) / 1000)}s`, JSON.stringify(out));
  if (errs.length) { console.log('errors:', errs.splice(0).slice(0, 5)); }
  if (out.every((o) => o.mates && o.mates.every((m) => m.fakes >= 8))) break;
}
// l'entité appelle avec la voix du joueur 2, chez le joueur 1 : au talkie, de loin, en bavardant, en répondant
const f1 = frames()[0];
const calls = await f1.evaluate(async () => {
  const B = window.__br;
  const v = B.voice;
  const me = B.sim.player;
  const other = B.sim.players.find((q) => q.id !== me.id);
  const out = [];
  const tries = [['radio', true, 0], ['call', false, 40], ['chat', false, 3], ['door', false, 6], ['reply', false, 4], ['call', false, 40], ['radio', true, 0], ['call', false, 40]];
  for (let i = 0; i < tries.length; i++) {
    const [kind, radio, d] = tries[i];
    v.mimicStop();
    v.mimic(other.id, { x: me.x + d, z: me.z }, radio, other.name, kind, 1000 + i * 7919, me.id, i % 3 === 0 ? 'dark' : '');
    const L = v.lastMimic();
    out.push({ kind, radio, d, said: L ? { fake: L.fake, n: L.n } : null });
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}).catch((e) => ({ err: e.message }));
console.log('CALLS', JSON.stringify(calls));
await browser.close();
