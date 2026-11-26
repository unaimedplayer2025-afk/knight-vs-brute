const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 320, height: 200 } });
  await p.goto('http://127.0.0.1:8797/index.html?q=low'); await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__dbg.snapshot().mode === 'fight', null, { timeout: 60000 });
  await p.evaluate(() => { window.__dbg.aiOff = true; });
  await p.waitForTimeout(800);
  const meas = () => p.evaluate(() => {
    const K = window.__K, s = K.sword, THREE_ = s.matrixWorld.constructor;
    const out = {}; const rots = { 'z+': [0, 0, 0], 'z-': [Math.PI, 0, 0], 'y+': [-Math.PI / 2, 0, 0], 'y-': [Math.PI / 2, 0, 0], 'x+': [0, Math.PI / 2, 0], 'x-': [0, -Math.PI / 2, 0] };
    const base = s.quaternion.clone();
    const rootInv = K.root.matrixWorld.clone().invert();
    for (const k in rots) {
      const e = new s.rotation.constructor(...rots[k]); const q = new s.quaternion.constructor().setFromEuler(e);
      // rotation applied in char-space at attach time == local rotation post-multiplied on the attached quaternion's char part; approximate by s.quaternion * q'
      s.quaternion.copy(base).multiply(q); s.updateMatrixWorld(true);
      const a = K.tipA.getWorldPosition(new s.position.constructor()).applyMatrix4(rootInv), c = K.tipB.getWorldPosition(new s.position.constructor()).applyMatrix4(rootInv);
      const d = c.sub(a).normalize(); out[k] = [d.x, d.y, d.z].map(v => v.toFixed(2)).join(',');
    }
    s.quaternion.copy(base); return out;
  });
  console.log('idle (x=left,y=up,z=fwd)', await meas());
  await p.keyboard.press('KeyJ'); await p.waitForFunction(() => window.__dbg.snapshot().p.actT > 0.1, null, { timeout: 20000 });
  console.log('slash', await meas());
  await b.close();
})();
