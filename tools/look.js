// quick look: title + fight close-ups of the real models
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('http://127.0.0.1:8797/index.html' + (process.argv[2] || '?q=low')); await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.screenshot({ path: '/tmp/lk-title.png' });
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__dbg.snapshot().mode === 'fight', null, { timeout: 60000 });
  await p.evaluate(() => { window.__dbg.aiOff = true; });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { window.__dbg.cam = [[3.5, 3.0, 2.5], [0, 2.4, -5]]; });
  await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/lk-boss.png' });
  await p.evaluate(() => { window.__dbg.cam = [[1.6, 1.6, 4.0], [0, 1.1, 6.5]]; });
  await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/lk-knight.png' });
  await p.evaluate(() => { window.__dbg.cam = [[-1.2, 1.6, 9.5], [0, 1.1, 6.5]]; });
  await p.waitForTimeout(1200); await p.screenshot({ path: '/tmp/lk-knight-back.png' });
  await p.evaluate(() => { window.__dbg.cam = null; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.screenshot({ path: '/tmp/lk-run.png' });
  await p.waitForFunction(() => window.__dbg.snapshot().dist < 3.2, null, { timeout: 60000 }); await p.keyboard.up('KeyW');
  await p.keyboard.press('KeyJ'); await p.waitForFunction(() => window.__dbg.snapshot().p.actT > 0.17, null, { timeout: 20000 });
  await p.screenshot({ path: '/tmp/lk-slash.png' });
  await b.close();
})();
