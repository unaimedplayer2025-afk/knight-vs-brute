// Real-time Playwright play test: REAL keyboard events on the live game loop (no autopilot in the game).
// Fight 1: the knight lets the brute win -> boss finisher (parry, blade, stab, green-magic roar).
// Fight 2: a key-pressing bot (reads state, presses real keys) beats the brute -> slow-mo final slash.
// Usage: node tools/play-tests.js [url] [query]   e.g.  node tools/play-tests.js http://127.0.0.1:8797/index.html ?q=low
const { chromium } = require('playwright-core');
const FS = require('fs'), PATH = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8797/index.html') + (process.argv[3] || '');
const W = +(process.env.W || 640), H = +(process.env.H || 360);
const SHOT = PATH.resolve(__dirname, '../shots'); FS.mkdirSync(SHOT, { recursive: true });
let failed = 0;
const pass = (n, x) => console.log('PASS  ' + n + (x ? '  ' + x : ''));
const fail = (n, x) => { failed++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const st = () => page.evaluate(() => window.__dbg.snapshot());
  const snap = (n) => page.screenshot({ path: PATH.join(SHOT, n.replace(/^(\d+)/, (d) => String(+d + 19)) + '.png') }); // v2 shots are 20+
  const waitFor = (fnSrc, ms) => page.waitForFunction(new Function('return (' + fnSrc + ')(window.__dbg.snapshot())'), null, { timeout: ms, polling: 50 });
  const kb = page.keyboard;

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await sleep(1500);
  await snap('01-title');
  if ((await st()).mode === 'title') pass('title screen'); else fail('title screen');

  // ---------------- start + intro
  await kb.press('Enter');
  await waitFor('s => s.mode === "intro" && s.stage === "roar"', 30000);
  await sleep(400);
  await snap('02-intro-roar');
  pass('intro: brute drops into the light shaft and roars');
  await waitFor('s => s.mode === "fight"', 30000);
  pass('fight starts');

  // ---------------- controls check
  let s0 = await st();
  await kb.down('KeyW'); await sleep(900); await kb.up('KeyW');
  let s1 = await st();
  if (s1.dist < s0.dist - 1) pass('W walks toward the brute', s0.dist.toFixed(1) + ' -> ' + s1.dist.toFixed(1)); else fail('W walks', s0.dist + ' -> ' + s1.dist);
  await kb.down('KeyW'); await waitFor('s => s.dist < 3.3', 15000).catch(() => {}); await kb.up('KeyW');
  const hp0 = (await st()).b.hp;
  await kb.press('KeyJ'); await sleep(120); await kb.press('KeyJ'); await sleep(120); await kb.press('KeyJ');
  await waitFor('s => s.p.act === "slash3" || s.p.act === "hurt"', 4000).catch(() => {});
  await sleep(150); await snap('03-combo');
  await sleep(700);
  let s2 = await st();
  if (s2.b.hp < hp0) pass('J slash combo damages the brute', hp0 + ' -> ' + s2.b.hp + ' hits=' + s2.stats.hits); else fail('slash combo', JSON.stringify(s2.b));
  await waitFor('s => !s.p.act', 5000).catch(() => {});
  await kb.press('KeyL');
  const rolled = await waitFor('s => s.p.act === "roll" && s.p.iframe > 0', 1500).then(() => true).catch(() => false);
  let s3 = await st();
  if (rolled) pass('L dodge roll with i-frames', 'act=' + s3.p.act); else fail('dodge roll', JSON.stringify(s3.p));
  await sleep(700);
  await kb.down('KeyW'); await waitFor('s => s.dist < 6', 8000).catch(() => {}); await kb.up('KeyW');
  const hp1 = (await st()).b.hp;
  await waitFor('s => !s.p.act', 5000).catch(() => {});
  await kb.press('KeyK');
  const heavyOk = await waitFor('s => s.p.act === "heavy"', 1500).then(() => true).catch(() => false);
  if (heavyOk) pass('K heavy leaping strike starts'); else fail('heavy', JSON.stringify((await st()).p));
  await sleep(150); await snap('04-heavy-leap');
  await sleep(900);
  const hp2 = (await st()).b.hp;
  console.log('      heavy result: boss hp ' + hp1 + ' -> ' + hp2);

  // ---------------- FIGHT 1: stand still, let the brute win
  console.log('... fight 1: knight stops fighting back, waiting for the brute');
  let shotBossAtk = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 900000) {
    const s = await st();
    if (!shotBossAtk && s.b.state === 'atk' && s.b.atk === 'smash' && s.b.t > 0.5) { await snap('05-boss-smash-telegraph'); shotBossAtk = true; }
    if (s.mode === 'bossFin') break;
    await sleep(100);
  }
  let f = await st();
  if (f.mode === 'bossFin') pass('player death -> boss finisher', 'p.hp=' + f.p.hp); else fail('boss finisher never started', JSON.stringify(f));
  await waitFor('s => s.stage === "raise" || s.stage === "stab"', 15000).catch(() => {});
  await snap('06-finisher-blade-raised');
  await waitFor('s => s.stage === "stab" || s.stage === "down"', 15000).catch(() => {});
  await sleep(200); await snap('07-finisher-stab');
  await waitFor('s => s.stage === "roar" && s.aura > 0.85', 25000).catch(() => {});
  f = await st();
  await snap('08-boss-finisher-roar');
  if (f.stage === 'roar' && f.aura > 0.5) pass('green-magic roar plays', 'aura=' + f.aura.toFixed(2)); else fail('roar', JSON.stringify({ stage: f.stage, aura: f.aura }));
  await waitFor('s => s.mode === "end"', 25000).catch(() => {});
  await sleep(700);
  const endTxt1 = await page.textContent('#endTitle');
  await snap('09-defeated-screen');
  if ((await st()).mode === 'end' && /DEFEATED/.test(endTxt1)) pass('DEFEATED retry screen'); else fail('defeated screen', endTxt1);

  // ---------------- FIGHT 2: bot plays with real keys and wins
  await kb.press('Enter');
  await waitFor('s => s.mode === "intro"', 10000);
  await sleep(500); await kb.press('Enter'); // skip intro
  await waitFor('s => s.mode === "fight"', 30000);
  pass('retry -> new fight');
  console.log('... fight 2: key-pressing bot fights the brute');
  const held = new Set();
  const hold = async (k) => { if (!held.has(k)) { held.add(k); await kb.down(k); } };
  const release = async (k) => { if (held.has(k)) { held.delete(k); await kb.up(k); } };
  const releaseAll = async () => { for (const k of [...held]) await release(k); };
  const HIT = { punchR: 0.55, punchL: 0.45, upper: 0.6, smash: 0.86, sword1: 0.72, sword2: 0.6 };
  let lastRoll = 0, lastSwing = 0, shots = { gameplay: false, p2: false, wave: false, trail: false };
  const t2 = Date.now();
  let s;
  while (Date.now() - t2 < 1500000) {
    s = await st();
    if (s.mode === 'playerFin' || s.mode === 'bossFin' || s.mode === 'end') break;
    if (s.mode !== 'fight') { await releaseAll(); await sleep(100); continue; }
    const now = Date.now();
    const b = s.b, d = s.dist;
    // danger: time until the brute's blow lands (game seconds)
    let danger = false, rollKey = 'KeyS';
    if (b.state === 'atk' && b.atk) {
      const tt = HIT[b.atk] - b.t;
      const reach = b.atk === 'smash' ? 6.2 : 5.2;
      if (tt > -0.02 && tt < 0.34 && d < reach) { danger = true; rollKey = b.atk === 'smash' ? 'KeyS' : 'KeyA'; }
    }
    if (b.state === 'chargeWind' && b.t > 0.45) { danger = true; rollKey = 'KeyA'; }
    if (b.state === 'charge' && d < 7) { danger = true; rollKey = 'KeyD'; }
    if (b.state === 'leap' && b.t > 0.7 && b.t < 1.02) { danger = true; rollKey = 'KeyS'; }
    if (s.shock && s.p.act !== 'roll') { const pd = Math.hypot(s.p.x - s.shock.x, s.p.z - s.shock.z); if (pd - s.shock.r < 1.4 && pd - s.shock.r > 0) danger = true; }
    if (danger && now - lastRoll > 380 && s.p.st >= 18 && s.p.act !== 'roll' && s.p.act !== 'hurt') {
      await releaseAll(); await hold(rollKey); await kb.press('KeyL'); lastRoll = now; await sleep(60); await release(rollKey);
      continue;
    }
    if (s.p.sp >= 100 && !s.p.act && d < 12) {
      await releaseAll(); await kb.press('KeyI'); await sleep(200);
      if (!shots.wave) { shots.wave = true; await snap('10-sword-wave'); }
      continue;
    }
    const safe = ['recover', 'stagger', 'chargeEnd', 'idle', 'walk'].includes(b.state) || (b.state === 'atk' && b.t > (HIT[b.atk] || 0) + 0.1);
    if (d > 3.2) { await hold('KeyW'); await sleep(60); continue; }
    await release('KeyW');
    if (safe && now - lastSwing > 140) {
      if (b.state === 'stagger' && s.p.st > 30 && Math.random() < 0.3) await kb.press('KeyK');
      else await kb.press('KeyJ');
      lastSwing = now;
      if (!shots.gameplay && s.p.act && s.p.act.startsWith('slash')) { await sleep(90); await snap('11-gameplay-slash'); shots.gameplay = true; }
      else if (!shots.trail && b.phase === 2 && s.p.act === 'slash2') { await sleep(80); await snap('13-phase2-slash'); shots.trail = true; }
    }
    if (!shots.p2 && b.phase === 2 && s.mode === 'fight' && b.state === 'atk' && b.atk && b.atk.startsWith('sword')) { await snap('12-phase2-blade'); shots.p2 = true; }
    await sleep(40);
  }
  await releaseAll();
  s = await st();
  console.log('      fight 2 ended: mode=' + s.mode + ' p.hp=' + s.p.hp + ' b.hp=' + s.b.hp + ' hits=' + s.stats.hits + ' dodges=' + s.stats.dodges + ' phase=' + s.b.phase);
  if (s.mode === 'playerFin') pass('brute defeated -> player finisher', 'knight hp left ' + s.p.hp); else fail('player did not win', JSON.stringify(s));
  if (s.mode === 'playerFin') {
    await waitFor('s => s.timeScale < 0.5', 3000).catch(() => {});
    const sm = await st();
    if (sm.timeScale < 0.5) pass('slow-motion final slash', 'timeScale=' + sm.timeScale); else fail('slow-mo', sm.timeScale);
    await sleep(500); await snap('14-final-slash-slowmo');
    await waitFor('s => s.stage === "down" || s.stage === "victory"', 20000).catch(() => {});
    await sleep(300); await snap('15-brute-collapsed');
    await waitFor('s => s.stage === "victory"', 20000).catch(() => {});
    await sleep(900); await snap('16-victory');
    await waitFor('s => s.mode === "end"', 20000).catch(() => {});
    await sleep(700);
    const endTxt2 = await page.textContent('#endTitle');
    await snap('17-victory-screen');
    if (/VICTORY/.test(endTxt2)) pass('VICTORY retry screen'); else fail('victory screen', endTxt2);
  }
  const real = errs.filter(e => !/play\(\) request|AbortError|favicon/.test(e));
  if (real.length) fail('page errors', real.slice(0, 4).join(' | ')); else pass('no page errors');
  await browser.close();
  console.log(failed ? 'FAILED ' + failed : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
