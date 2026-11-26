// quick look: title, intro, fight screenshots + errors
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8797/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +(process.env.W||1280), height: +(process.env.H||720) } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + (process.argv[3] || '')); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/kvb-title.png' });
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps', fps);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/kvb-intro.png' });
  await p.waitForFunction(() => window.__dbg.snapshot().mode === 'fight', null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/kvb-fight.png' });
  console.log(JSON.stringify(await p.evaluate(() => window.__dbg.snapshot())));
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
