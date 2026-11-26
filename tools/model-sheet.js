// close-up look at the two models (debug camera, AI paused) for art review
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto('http://127.0.0.1:8797/index.html' + (process.argv[2] || '?q=high')); await p.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__dbg.snapshot().mode === 'fight', null, { timeout: 60000 });
  await p.evaluate(() => { window.__dbg.aiOff = true; });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__dbg.cam = [[2.5, 3.2, 1.5], [0, 2.9, -5]]; });
  await p.waitForTimeout(2500); await p.screenshot({ path: '/tmp/ms-boss.png' });
  await p.evaluate(() => { window.__dbg.cam = [[1.0, 1.5, 3.6], [0, 1.15, 6.5]]; });
  await p.waitForTimeout(2500); await p.screenshot({ path: '/tmp/ms-knight.png' });
  await p.evaluate(() => { window.__dbg.cam = null; });
  await p.keyboard.down('KeyW'); await p.waitForFunction(() => window.__dbg.snapshot().dist < 3.2, null, { timeout: 60000 }); await p.keyboard.up('KeyW');
  await p.keyboard.press('KeyJ'); await p.waitForFunction(() => window.__dbg.snapshot().p.actT > 0.2, null, { timeout: 20000 });
  await p.screenshot({ path: '/tmp/ms-slash.png' });
  await b.close();
})();
