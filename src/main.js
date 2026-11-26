// KNIGHT vs BRUTE — 1v1 third-person boss fight modeled on John's cavern duel clip.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import Snd from './audio.js';
import { buildWorld, ARENA_R } from './world.js';
import { buildKnight, buildBoss, updateCape, sample, addPose, KA, KIDLE, runPose, BA, BIDLE, bossWalk, lerp } from './chars.js';
import { buildFX } from './fx.js';

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('c');
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');
// quality: ?q=high|med|low (auto-drops a level if the fight runs slow)
const QS = ['low', 'med', 'high'];
let qi = QS.indexOf(new URLSearchParams(location.search).get('q'));
const qForced = qi >= 0;
if (qi < 0) qi = isTouch ? 1 : 2;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
function applyQuality() {
  const q = QS[qi];
  renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio, isTouch ? 1.25 : 1.5) : q === 'med' ? Math.min(devicePixelRatio, 1) : 0.7);
  renderer.shadowMap.enabled = q === 'high';
  if (typeof bloom !== 'undefined') { bloom.enabled = q !== 'low'; resize(); }
  try { world.lights.forEach(l => { l.visible = q !== 'low'; }); } catch (e) { /* world not built yet */ }
  scene && scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0d1424, 0.012);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.28;

const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 900);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.85, 0.55, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 68 : 52; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); applyQuality(); resize();

const world = buildWorld(scene, renderer);
const fx = buildFX(scene);
applyQuality();
const K = buildKnight(); scene.add(K.root);
const B = buildBoss(); scene.add(B.root);
K.root.traverse(o => { if (o.isMesh && o !== K.blade) o.castShadow = true; });
const kTrail = fx.makeTrail(0x3aa8ff, 20);
const bTrail = fx.makeTrail(0x9fc8ff, 16);

// ---------------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const hud = $('hud'), banner = $('banner');
const setBar = (id, f) => { const el = $(id); el.querySelector('i').style.width = (Math.max(0, Math.min(1, f)) * 100) + '%'; const b = el.querySelector('b'); if (b) b.style.width = (Math.max(0, Math.min(1, f)) * 100) + '%'; };
let bannerT = 0;
function showBanner(txt, color = '#cfe6ff', dur = 2.2) { banner.textContent = txt; banner.style.color = color; banner.classList.add('on'); bannerT = dur; }
function flashDiv(id, a) { const el = $(id); el.style.transition = 'none'; el.style.opacity = a; requestAnimationFrame(() => { el.style.transition = 'opacity .5s'; el.style.opacity = 0; }); }

// ---------------------------------------------------------------- input
const keys = new Set(), pressed = new Set();
const BIND = { slash: ['KeyJ', 'Space'], heavy: ['KeyK'], dodge: ['KeyL', 'ShiftLeft', 'ShiftRight'], special: ['KeyI'] };
const vpress = new Set(), vhold = { x: 0, y: 0 };
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  Snd.start();
  if (e.repeat) return;
  keys.add(e.code); pressed.add(e.code);
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const act = (name) => BIND[name].some(c => pressed.has(c)) || vpress.has(name);
function toggleMute() { const m = Snd.toggleMute(); $('mute').textContent = m ? 'M: sound off' : 'M: sound on'; }
$('mute').addEventListener('click', (e) => { e.stopPropagation(); Snd.start(); toggleMute(); });
// gamepad
let padPrev = [];
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && [...pads].find(p => p);
  if (!gp) return null;
  const b = gp.buttons.map(x => x.pressed);
  const edge = (i) => b[i] && !padPrev[i];
  if (edge(0)) vpress.add('slash');
  if (edge(2)) vpress.add('heavy');
  if (edge(1) || edge(5)) vpress.add('dodge');
  if (edge(3)) vpress.add('special');
  if (edge(9) || edge(0)) vpress.add('start');
  if (b.some(Boolean)) Snd.start();
  padPrev = b;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  return Math.hypot(ax, ay) > 0.2 ? { x: ax, y: ay } : { x: 0, y: 0 };
}
// touch controls
(() => {
  const stick = $('stick'), nub = $('nub'); let id = null;
  const upd = (e) => {
    const r = stick.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    vhold.x = x; vhold.y = y; nub.style.transform = `translate(${x * 40}px,${y * 40}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); upd(e); Snd.start(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) upd(e); });
  const end = () => { id = null; vhold.x = vhold.y = 0; nub.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  for (const [bid, name] of [['tSlash', 'slash'], ['tHeavy', 'heavy'], ['tDodge', 'dodge'], ['tSpec', 'special']]) {
    const el = $(bid);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); vpress.add(name); el.classList.add('dn'); Snd.start(); });
    const up = () => el.classList.remove('dn');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  addEventListener('pointerdown', () => { Snd.start(); vpress.add('start'); });
})();

// ---------------------------------------------------------------- game state
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const MAXB = 640;
let mode = 'title', modeT = 0;
let timeScale = 1, hitStop = 0, shake = 0, gameTime = 0;
const P = { pos: V(), yaw: Math.PI, vel: V(), hp: 100, st: 100, sp: 0, act: null, actT: 0, combo: 0, queued: null, qT: 0, iframe: 0, hitDone: false, moveAmt: 0, runPh: 0, y: 0, rollDir: V(), leap: null, dead: false };
const Bo = { pos: V(), yaw: 0, hp: MAXB, phase: 1, state: 'idle', t: 0, cd: 1.5, poise: 0, anim: null, chain: [], hitDone: false, dir: V(), target: V(), y: 0, flinch: 0, armorUntil: 0, shockHit: false, moveSpd: 0, walkPh: 0 };
const stats = { hits: 0, taken: 0, dodges: 0, start: 0, time: 0 };
const waveP = { on: false, pos: V(), dir: V(), life: 0 };
const fin = { t: 0, stage: '' };
let lastShock = null;

function yawTo(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function turnTo(cur, target, rate) { const d = angDiff(cur, target); return cur + Math.sign(d) * Math.min(Math.abs(d), rate); }
function fwd(yaw) { return V(Math.sin(yaw), 0, Math.cos(yaw)); }
function distPB() { return Math.hypot(P.pos.x - Bo.pos.x, P.pos.z - Bo.pos.z); }

function resetFight() {
  P.pos.set(0, 0, 6.5); P.yaw = Math.PI; P.vel.set(0, 0, 0); P.hp = 100; P.st = 100; P.sp = 0; P.act = null; P.queued = null; P.iframe = 0; P.y = 0; P.dead = false;
  Bo.pos.set(0, 0, -5); Bo.yaw = 0; Bo.hp = MAXB; Bo.phase = 1; Bo.state = 'idle'; Bo.t = 0; Bo.cd = 1.2; Bo.poise = 0; Bo.y = 0; Bo.flinch = 0; Bo.armorUntil = 0;
  B.setPhase(1); B.blade.visible = false; B.body.rotation.set(0, 0, 0); B.body.position.set(0, 0, 0);
  K.body.rotation.set(0, 0, 0); K.body.position.set(0, 0, 0);
  fx.setAura(null, 0); fx.telegraph(null); fx.lane(null); fx.wave.visible = false; waveP.on = false;
  kTrail.clear(); bTrail.clear();
  stats.hits = 0; stats.taken = 0; stats.dodges = 0; timeScale = 1;
  setBar('hpBar', 1); setBar('bossBar', 1);
}

// ---------------------------------------------------------------- damage
function hitBoss(dmg, poise, at, big = false) {
  if (Bo.hp <= 0) return;
  Bo.hp = Math.max(0, Bo.hp - dmg); stats.hits++;
  P.sp = Math.min(100, P.sp + (big ? 12 : 7));
  Bo.poise += poise; Bo.flinch = 0.22;
  hitStop = big ? 0.13 : 0.065; shake = Math.max(shake, big ? 0.5 : 0.2);
  fx.burst(at, big ? 70 : 38, 0xff9a30, big ? 11 : 8, 10, 0.55);
  fx.burst(at, big ? 24 : 12, 0xffe0a0, 5, 6, 0.3);
  fx.flash(at, 0xffb060, big ? 4.5 : 2.8);
  Snd.hit(big);
  if (Bo.hp <= 0) { startPlayerFinisher(); return; }
  if (Bo.phase === 1 && Bo.hp <= MAXB * 0.5) { startPhase2(); return; }
  const unstop = (['charge', 'leap', 'phase'].includes(Bo.state) && Bo.t > 0.4) || (Bo.state === 'atk' && Bo.t > 0.2) || gameTime < Bo.armorUntil;
  if (Bo.poise >= (Bo.phase === 1 ? 100 : 130) && !unstop) {
    Bo.poise = 0; setBoss('stagger'); Snd.growl();
    Bo.armorUntil = gameTime + 5; // no stun-locking: he shrugs off hits for a while after a stagger
  }
  if (Bo.state === 'idle') Bo.cd = Math.min(Bo.cd, 0.2); // getting hit makes him answer fast
}
function hitPlayer(dmg, from, kb = 7) {
  if (P.hp <= 0 || mode !== 'fight') return false;
  if (P.iframe > 0) { // perfect dodge
    if (P.act === 'roll') { stats.dodges++; P.sp = Math.min(100, P.sp + 10); fx.burst(V(P.pos.x, 1.2, P.pos.z), 14, 0x60c8ff, 4, 2, 0.4); }
    return false;
  }
  P.hp = Math.max(0, P.hp - dmg); stats.taken += dmg;
  P.sp = Math.min(100, P.sp + 4);
  const d = V(P.pos.x - from.x, 0, P.pos.z - from.z).normalize();
  P.vel.copy(d.multiplyScalar(kb));
  P.act = 'hurt'; P.actT = 0; P.queued = null; P.iframe = 0.55;
  hitStop = 0.09; shake = Math.max(shake, 0.55);
  const at = V(P.pos.x, 1.3, P.pos.z);
  fx.burst(at, 30, 0xff6a30, 7, 9, 0.45); fx.flash(at, 0xff7040, 2.6);
  flashDiv('dmg', 1); Snd.hurt();
  if (P.hp <= 0) startBossFinisher();
  return true;
}

// ---------------------------------------------------------------- player
const ACTS = {
  slash1: { anim: KA.slash1, hit: 0.17, dmg: 15, poise: 10, range: 3.3, next: 0.26, trail: [0.06, 0.3], lunge: 5 },
  slash2: { anim: KA.slash2, hit: 0.16, dmg: 15, poise: 10, range: 3.3, next: 0.26, trail: [0.06, 0.3], lunge: 5 },
  slash3: { anim: KA.slash3, hit: 0.29, dmg: 26, poise: 20, range: 3.5, next: 9, trail: [0.14, 0.42], lunge: 6, big: true },
  heavy: { anim: KA.heavy, hit: 0.66, dmg: 42, poise: 38, range: 3.4, trail: [0.5, 0.82], big: true },
  special: { anim: KA.special, hit: 0.36, trail: [0.24, 0.52] },
  roll: { anim: KA.roll },
  hurt: { anim: KA.hurt },
};
function startAct(name) {
  P.act = name; P.actT = 0; P.hitDone = false; P.queued = null;
  const a = ACTS[name];
  if (name.startsWith('slash') || name === 'heavy' || name === 'special') {
    if (distPB() < 10) P.yaw = yawTo(P.pos, Bo.pos);
    Snd.whoosh(name === 'slash3' || name === 'heavy' ? 0.7 : 1);
  }
  if (name === 'heavy') { P.st -= 15; const d = Math.max(0, Math.min(6.5, distPB() - 2.3)); P.leap = { from: P.pos.clone(), to: P.pos.clone().addScaledVector(fwd(P.yaw), d) }; }
  if (name === 'roll') { P.st -= 24; P.iframe = 0; Snd.roll(); }
  if (name === 'special') { P.sp = 0; Snd.wave(); }
  void a;
}
function moveInput() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  x += vhold.x; y += vhold.y;
  if (padAxes) { x += padAxes.x; y += padAxes.y; }
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  // camera-relative
  const cf = V(); camera.getWorldDirection(cf); cf.y = 0; cf.normalize();
  const cr = V(-cf.z, 0, cf.x);
  return cf.multiplyScalar(-y).add(cr.multiplyScalar(x));
}
let padAxes = null;

function updatePlayer(dt) {
  const inp = moveInput();
  const im = inp.length();
  P.iframe = Math.max(0, P.iframe - dt);
  P.st = Math.min(100, P.st + dt * (P.act ? 14 : 30));
  // buffered input
  const want = act('dodge') ? 'roll' : act('special') ? 'special' : act('heavy') ? 'heavy' : act('slash') ? 'slash' : null;
  if (want) { P.queued = want; P.qT = 0.3; }
  if (P.queued) { P.qT -= dt; if (P.qT <= 0) P.queued = null; }
  const can = (q) => {
    if (q === 'roll') return P.st >= 18;
    if (q === 'special') return P.sp >= 100;
    if (q === 'heavy') return P.st >= 10;
    return true;
  };
  if (P.act) {
    const A = ACTS[P.act];
    P.actT += dt;
    const t = P.actT;
    if (P.act.startsWith('slash')) {
      if (t < 0.2 && distPB() > 2.4) P.pos.addScaledVector(fwd(P.yaw), A.lunge * dt * (1 - t / 0.2));
      if (!P.hitDone && t >= A.hit) { P.hitDone = true; tryHit(A); }
      // combo chain / cancel into dodge
      if (P.queued && t >= A.next) {
        const q = P.queued;
        if (q === 'slash' && P.act !== 'slash3') { startAct(P.act === 'slash1' ? 'slash2' : 'slash3'); return; }
        if (q !== 'slash' && can(q)) { startAct(q); return; }
      }
      if (P.queued === 'roll' && t >= A.hit + 0.04 && can('roll')) { beginRoll(inp); return; }
      if (t >= A.anim.dur) { P.act = null; }
    } else if (P.act === 'heavy') {
      const k = Math.min(1, Math.max(0, (t - 0.18) / 0.48));
      if (t >= 0.18 && t <= 0.66) {
        P.pos.lerpVectors(P.leap.from, P.leap.to, k);
        P.y = Math.sin(k * Math.PI) * 1.7;
      } else P.y = 0;
      if (!P.hitDone && t >= A.hit) {
        P.hitDone = true; P.y = 0;
        const at = P.pos.clone().addScaledVector(fwd(P.yaw), 1.4); at.y = 0.1;
        fx.shockwave(at, 3.2, 0x4ab8ff, 0.4); fx.burst(at, 30, 0x60c0ff, 7, 9, 0.5); fx.smoke(at, 5, 2.4, 1.5, 0x8090a8, 1, 0.5);
        shake = Math.max(shake, 0.35); Snd.smash();
        tryHit(A);
      }
      if (t >= A.anim.dur) P.act = null;
    } else if (P.act === 'special') {
      if (!P.hitDone && t >= A.hit) {
        P.hitDone = true;
        waveP.on = true; waveP.life = 1.4; waveP.hit = false;
        waveP.dir.copy(fwd(P.yaw));
        waveP.pos.copy(P.pos).addScaledVector(waveP.dir, 1.0); waveP.pos.y = 1.25;
        fx.flash(waveP.pos, 0x60c0ff, 3);
      }
      if (t >= A.anim.dur) P.act = null;
    } else if (P.act === 'roll') {
      P.iframe = (t > 0.03 && t < 0.4) ? 0.05 : P.iframe;
      const sp = 12 * (1 - t / 0.5) + 2;
      P.pos.addScaledVector(P.rollDir, sp * dt);
      if (t >= A.anim.dur) { P.act = null; }
    } else if (P.act === 'hurt') {
      P.pos.addScaledVector(P.vel, dt); P.vel.multiplyScalar(Math.exp(-dt * 6));
      if (t >= 0.45) P.act = null;
    }
  } else {
    // free movement
    if (im > 0.05) {
      P.pos.addScaledVector(inp, 6.4 * dt);
      P.yaw = turnTo(P.yaw, Math.atan2(inp.x, inp.z), dt * 14);
      P.runPh += dt * 11 * Math.min(1, im + 0.3);
    } else {
      P.yaw = turnTo(P.yaw, yawTo(P.pos, Bo.pos), dt * 4);
    }
    P.moveAmt = lerp(P.moveAmt, Math.min(1, im), 1 - Math.exp(-dt * 10));
    if (P.queued && can(P.queued)) {
      const q = P.queued;
      if (q === 'roll') beginRoll(inp);
      else startAct(q === 'slash' ? 'slash1' : q);
    }
  }
  // arena + boss collision
  const r = Math.hypot(P.pos.x, P.pos.z);
  if (r > ARENA_R) P.pos.multiplyScalar(ARENA_R / r);
  const d = distPB(), minD = 1.7;
  if (d < minD && Bo.state !== 'dead') {
    const n = V(P.pos.x - Bo.pos.x, 0, P.pos.z - Bo.pos.z); if (n.lengthSq() < 1e-4) n.set(0, 0, 1); n.normalize();
    P.pos.copy(Bo.pos).addScaledVector(n, minD); P.pos.y = 0;
  }
}
function beginRoll(inp) {
  const dir = inp.lengthSq() > 0.01 ? inp.clone().normalize() : V(P.pos.x - Bo.pos.x, 0, P.pos.z - Bo.pos.z).normalize();
  P.rollDir.copy(dir); P.yaw = Math.atan2(dir.x, dir.z);
  startAct('roll');
}
function tryHit(A) {
  const d = distPB();
  const toB = yawTo(P.pos, Bo.pos);
  if (d - 1.3 <= A.range && Math.abs(angDiff(P.yaw, toB)) < 1.25) {
    const n = V(Bo.pos.x - P.pos.x, 0, Bo.pos.z - P.pos.z).normalize();
    const at = P.pos.clone().addScaledVector(n, Math.max(1.0, d - 1.1)); at.y = 1.6 + Math.random() * 0.6;
    hitBoss(A.dmg, A.poise, at, !!A.big);
  }
}

// ---------------------------------------------------------------- boss
const BATK = {
  // name: anim, hit time, damage, range, arc, poise-armor
  punchR: { anim: BA.punchR, hit: 0.55, dmg: 11, range: 3.7, arc: 0.9, track: 0.4 },
  punchL: { anim: BA.punchL, hit: 0.45, dmg: 11, range: 3.7, arc: 0.9, track: 0.3 },
  upper: { anim: BA.upper, hit: 0.6, dmg: 15, range: 3.6, arc: 0.8, track: 0.42 },
  smash: { anim: BA.smash, hit: 0.86, dmg: 20, radius: 3.6, track: 0.55 },
  sword1: { anim: BA.sword1, hit: 0.72, dmg: 17, range: 4.6, arc: 0.8, track: 0.5, trail: [0.55, 0.85] },
  sword2: { anim: BA.sword2, hit: 0.6, dmg: 14, range: 4.8, arc: 1.6, track: 0.4, trail: [0.42, 0.7] },
};
function setBoss(state, extra) {
  Bo.state = state; Bo.t = 0; Bo.hitDone = false; Bo.shockHit = false;
  Object.assign(Bo, extra || {});
  fx.telegraph(null); fx.lane(null);
}
function bossChoose() {
  const d = distPB(), p2 = Bo.phase === 2, r = Math.random();
  if (d > 8) {
    if (p2 && r < 0.45) return setBoss('leap');
    if (r < (p2 ? 0.8 : 0.6)) return setBoss('chargeWind');
    return setBoss('walk', { walkFor: 1.6 });
  }
  if (d > 4.6) {
    if (r < 0.4) return setBoss('atk', { chain: ['smash'] });
    if (r < 0.6) return setBoss('chargeWind');
    if (p2 && r < 0.78) return setBoss('leap');
    return setBoss('walk', { walkFor: 1.4 });
  }
  if (p2) {
    if (r < 0.5) return setBoss('atk', { chain: Math.random() < 0.6 ? ['sword1', 'sword2'] : ['sword2', 'sword1', 'smash'] });
    if (r < 0.75) return setBoss('atk', { chain: ['punchR', 'punchL', 'upper'] });
    return setBoss('atk', { chain: ['smash'] });
  }
  if (r < 0.6) return setBoss('atk', { chain: Math.random() < 0.55 ? ['punchR', 'punchL', 'upper'] : ['punchR', 'punchL'] });
  if (r < 0.9) return setBoss('atk', { chain: ['smash'] });
  return setBoss('walk', { walkFor: 0.8 });
}
function bossPose(dt) {
  const s = Bo.state, t = Bo.t;
  let pose;
  if (s === 'idle' || s === 'recover') pose = sample(BA.idle, gameTime);
  else if (s === 'walk') pose = bossWalk(Bo.walkPh, 1);
  else if (s === 'chargeWind') pose = sample(BA.chargeWind, t);
  else if (s === 'charge') pose = sample(BA.charge, t);
  else if (s === 'chargeEnd') pose = sample(BA.stagger, 0.35 + t * 0.6);
  else if (s === 'atk') pose = sample(BATK[Bo.chain[0]].anim, t);
  else if (s === 'leap') pose = sample(BA.leap, t);
  else if (s === 'stagger') pose = sample(BA.stagger, t);
  else if (s === 'roar' || s === 'phase') pose = sample(BA.roar, t);
  else pose = Bo.customPose || BIDLE;
  if (Bo.flinch > 0) pose = addPose(pose, { spine: [-0.12, 0.1, 0], head: [-0.3, 0.2, 0] }, Bo.flinch / 0.22);
  if (Bo.phase === 2 && (s === 'idle' || s === 'walk' || s === 'recover')) pose = addPose(pose, { fiR: [1.3, 0, 0] });
  return pose;
}
function updateBoss(dt) {
  Bo.t += dt; Bo.flinch = Math.max(0, Bo.flinch - dt);
  const p2 = Bo.phase === 2, spd = p2 ? 1.25 : 1;
  const toP = yawTo(Bo.pos, P.pos), d = distPB();
  switch (Bo.state) {
    case 'idle':
      Bo.yaw = turnTo(Bo.yaw, toP, dt * 3);
      Bo.cd -= dt;
      if (Bo.cd <= 0) bossChoose();
      break;
    case 'recover':
      Bo.yaw = turnTo(Bo.yaw, toP, dt * 1.5);
      if (Bo.t > (p2 ? 0.4 : 0.6)) setBoss('idle', { cd: p2 ? 0.15 : 0.35 });
      break;
    case 'walk': {
      Bo.yaw = turnTo(Bo.yaw, toP, dt * 3);
      const v = (p2 ? 4.6 : 3.6);
      Bo.pos.addScaledVector(fwd(Bo.yaw), v * dt);
      const prev = Math.sin(Bo.walkPh); Bo.walkPh += dt * 6.5; if (Math.sign(prev) !== Math.sign(Math.sin(Bo.walkPh))) { Snd.step(); shake = Math.max(shake, 0.08); }
      if (d < 4.2 || Bo.t > Bo.walkFor) { if (d < 4.6) bossChoose(); else setBoss('idle', { cd: 0.1 }); }
      break;
    }
    case 'chargeWind': {
      const wind = p2 ? 0.6 : 0.8;
      if (Bo.t < wind * 0.7) { Bo.yaw = turnTo(Bo.yaw, toP, dt * 6); }
      if (Bo.t < 0.05) Snd.charge();
      fx.lane(Bo.pos, Bo.yaw, Math.min(26, d + 5), 2.6, 0.18 + 0.25 * Math.min(1, Bo.t / wind));
      if (Bo.t >= wind) { setBoss('charge', { dir: fwd(Bo.yaw), runLen: Math.min(24, d + 5) }); Snd.roar(false); }
      break;
    }
    case 'charge': {
      const v = 17 * spd;
      Bo.pos.addScaledVector(Bo.dir, v * dt);
      Bo.runLen -= v * dt;
      if (Math.random() < 0.6) fx.smoke(V(Bo.pos.x, 0.1, Bo.pos.z), 1, 2.2, 1, 0x7c7f8a, 0.8, 0.45, 0.3);
      if (!Bo.hitDone && d < 2.4) { Bo.hitDone = true; hitPlayer(17, Bo.pos, 13); }
      const r = Math.hypot(Bo.pos.x, Bo.pos.z);
      if (Bo.runLen <= 0 || r > ARENA_R - 0.5) {
        if (r > ARENA_R - 0.5) { shake = 0.4; Snd.smash(); fx.smoke(V(Bo.pos.x, 0.5, Bo.pos.z), 6, 3, 2); }
        setBoss('chargeEnd');
      }
      break;
    }
    case 'chargeEnd':
      if (Bo.t > (p2 ? 0.7 : 1.0)) setBoss('recover');
      break;
    case 'atk': {
      const name = Bo.chain[0], A = BATK[name];
      if (Bo.t < A.hit * A.track / 0.5 * 0.9) Bo.yaw = turnTo(Bo.yaw, toP, dt * (p2 ? 4 : 3));
      if (name === 'smash') {
        const at = Bo.pos.clone().addScaledVector(fwd(Bo.yaw), 2.4);
        if (Bo.t < A.hit) fx.telegraph(at, A.radius, Bo.t / A.hit);
        if (Bo.t < 0.05) Snd.growl();
        if (!Bo.hitDone && Bo.t >= A.hit) {
          Bo.hitDone = true; fx.telegraph(null);
          Snd.smash(); shake = 0.8;
          fx.smoke(at, 10, 3.4, 3, 0x7a7d88, 1.6, 0.7);
          fx.burst(V(at.x, 0.2, at.z), 40, 0xffa040, 8, 12, 0.6);
          lastShock = fx.shockwave(at, p2 ? 10 : 8.5, 0xffa040, 0.75); lastShock.center = at.clone(); lastShock.hitP = false;
          if (Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < A.radius) hitPlayer(A.dmg, at, 9);
        }
      } else {
        const lungeT = A.hit - 0.12;
        if (Bo.t > lungeT && Bo.t < A.hit + 0.08 && d > 2.2) Bo.pos.addScaledVector(fwd(Bo.yaw), (name.startsWith('sword') ? 7 : 6) * dt);
        if (Bo.t < 0.03) Snd.growl();
        if (Math.abs(Bo.t - (A.hit - 0.14)) < dt) Snd.whoosh(0.5);
        if (!Bo.hitDone && Bo.t >= A.hit) {
          Bo.hitDone = true;
          if (d < A.range && Math.abs(angDiff(Bo.yaw, toP)) < A.arc) hitPlayer(A.dmg, Bo.pos, 8);
        }
      }
      if (Bo.t >= A.anim.dur * 0.92) {
        Bo.chain.shift();
        if (Bo.chain.length) { Bo.t = 0; Bo.hitDone = false; }
        else setBoss('recover');
      }
      break;
    }
    case 'leap': {
      const A = BA.leap;
      if (Bo.t < 0.45) { Bo.yaw = turnTo(Bo.yaw, toP, dt * 6); Bo.leapFrom = Bo.pos.clone(); Bo.leapTo = P.pos.clone(); }
      const tgt = Bo.leapTo || P.pos;
      if (Bo.t < 1.0) fx.telegraph(tgt, 3.8, Math.min(1, Bo.t / 1.0));
      if (Bo.t >= 0.45 && Bo.t <= 1.0) {
        const k = (Bo.t - 0.45) / 0.55;
        const to = tgt.clone().addScaledVector(fwd(Bo.yaw), -1.5);
        Bo.pos.lerpVectors(Bo.leapFrom, to, k); Bo.y = Math.sin(k * Math.PI) * 4.5;
      } else Bo.y = 0;
      if (!Bo.hitDone && Bo.t >= 1.0) {
        Bo.hitDone = true; fx.telegraph(null); Bo.y = 0;
        Snd.smash(); shake = 0.9;
        fx.smoke(tgt, 12, 3.6, 3, 0x7a7d88, 1.6, 0.7);
        fx.burst(V(tgt.x, 0.2, tgt.z), 50, 0xffa040, 9, 12, 0.6);
        lastShock = fx.shockwave(tgt, 9, 0x60ffd8, 0.7); lastShock.center = tgt.clone(); lastShock.hitP = false;
        if (Math.hypot(P.pos.x - tgt.x, P.pos.z - tgt.z) < 3.8) hitPlayer(21, tgt, 10);
      }
      if (Bo.t >= A.dur) setBoss('recover');
      break;
    }
    case 'stagger':
      Bo.pos.addScaledVector(fwd(Bo.yaw), -1.2 * dt);
      if (Bo.t >= BA.stagger.dur + 0.2) setBoss('recover');
      break;
  }
  // shockwave ring damage (jump it or roll through it)
  if (lastShock && lastShock.m.visible && !lastShock.hitP && lastShock.r) {
    const pd = Math.hypot(P.pos.x - lastShock.center.x, P.pos.z - lastShock.center.z);
    if (Math.abs(pd - lastShock.r) < 0.55 && P.y < 0.4) { lastShock.hitP = true; hitPlayer(9, lastShock.center, 6); }
  }
  // arena clamp + keep apart
  const r = Math.hypot(Bo.pos.x, Bo.pos.z);
  if (r > ARENA_R - 0.4) Bo.pos.multiplyScalar((ARENA_R - 0.4) / r);
}

// ---------------------------------------------------------------- phase 2 / cinematics
function startPhase2() {
  Bo.phase = 2; Bo.poise = 0;
  setBoss('phase'); mode = 'phase'; modeT = 0; P.act = null; P.queued = null;
  showBanner('THE BRUTE ARMORS UP', '#ff9a6a', 2.6);
  Snd.roar(true);
}
function startBossFinisher() {
  mode = 'bossFin'; modeT = 0; fin.stage = 'parry'; timeScale = 1;
  document.body.classList.add('cine'); hud.classList.remove('on');
  fx.telegraph(null); fx.lane(null); waveP.on = false; fx.wave.visible = false;
  Bo.state = 'fin'; Bo.t = 0; Bo.y = 0;
  const n = V(Bo.pos.x - P.pos.x, 0, Bo.pos.z - P.pos.z); if (n.lengthSq() < 0.01) n.set(0, 0, -1); n.normalize();
  // keep the finisher on the platform
  if (Math.hypot(P.pos.x, P.pos.z) > ARENA_R - 4) P.pos.multiplyScalar((ARENA_R - 4) / Math.hypot(P.pos.x, P.pos.z));
  fin.kpos = P.pos.clone(); fin.dir = n; fin.bfrom = Bo.pos.clone(); fin.bto = P.pos.clone().addScaledVector(n, 2.5);
  P.yaw = Math.atan2(n.x, n.z); P.act = 'fin'; P.actT = 0; P.y = 0;
}
function startPlayerFinisher() {
  mode = 'playerFin'; modeT = 0; fin.stage = 'slash';
  document.body.classList.add('cine'); hud.classList.remove('on');
  fx.telegraph(null); fx.lane(null); waveP.on = false; fx.wave.visible = false;
  Bo.state = 'fin'; Bo.t = 0; Bo.y = 0; Bo.customPose = sample(BA.stagger, 0.05);
  const n = V(P.pos.x - Bo.pos.x, 0, P.pos.z - Bo.pos.z); if (n.lengthSq() < 0.01) n.set(0, 0, 1); n.normalize();
  if (Math.hypot(Bo.pos.x, Bo.pos.z) > ARENA_R - 4) Bo.pos.multiplyScalar((ARENA_R - 4) / Math.hypot(Bo.pos.x, Bo.pos.z));
  fin.dir = n; fin.kfrom = P.pos.clone(); fin.kto = Bo.pos.clone().addScaledVector(n, 2.6);
  P.act = 'fin'; P.actT = 0; P.y = 0; P.yaw = Math.atan2(-n.x, -n.z);
  timeScale = 0.22; hitStop = 0.12;
  showBanner('', '#fff', 0.1);
}

let camPos = V(0, 3, 12), camLook = V(0, 1.5, 0), finCam = null;
function updateFinishers(dt, realDt) {
  modeT += realDt;
  const t = modeT;
  if (mode === 'bossFin') {
    // Clip choreography: knight's last swing is parried, he drops to a knee, the brute draws
    // a blade and stabs him, he falls on his back, the brute roars as green magic swirls up.
    const kp = fin.kpos;
    Bo.pos.lerpVectors(fin.bfrom, fin.bto, Math.min(1, t / 0.45));
    Bo.yaw = Math.atan2(-fin.dir.x, -fin.dir.z);
    let kpose, bpose;
    if (t < 0.55) { kpose = sample(KA.slash2, Math.min(0.2, t * 0.6)); bpose = sample(BA.draw, Math.min(0.7, t * 1.6)); if (t > 0.25 && fin.stage === 'parry') { fin.stage = 'kneel'; B.blade.visible = true; Snd.clang(); const at = kp.clone().addScaledVector(fin.dir, 1.4); at.y = 1.6; fx.burst(at, 50, 0xbfe6ff, 8, 8, 0.5); fx.flash(at, 0x9fd8ff, 3); hitStop = 0.1; shake = 0.4; } }
    else if (t < 1.4) { kpose = sample(KA.kneel, t - 0.55); bpose = sample(BA.draw, 0.7); }
    else if (t < 2.1) { kpose = sample(KA.kneel, 0.6); bpose = sample(BA.raise, t - 1.4); if (fin.stage === 'kneel') { fin.stage = 'raise'; Snd.growl(); } }
    else if (t < 2.6) {
      kpose = sample(KA.kneel, 0.6); bpose = sample(BA.stab, t - 2.1);
      if (t > 2.24 && fin.stage === 'raise') { fin.stage = 'stab'; Snd.stab(); Snd.hurt(); const at = kp.clone(); at.y = 1.1; fx.burst(at, 60, 0xff7a40, 7, 9, 0.6); fx.flash(at, 0xffd0a0, 2.0); flashDiv('dmg', 1); hitStop = 0.18; shake = 0.7; }
    } else if (t < 3.6) {
      kpose = sample(KA.dead, 0); bpose = sample(BA.stab, 0.45 - Math.min(0.3, (t - 2.6) * 0.5));
      const k = Math.min(1, (t - 2.6) / 0.8);
      const e = k * k;
      K.body.rotation.x = -Math.PI / 2 * e; K.body.position.set(0, 0.16 * e, 0);
      if (fin.stage === 'stab' && k >= 1) { fin.stage = 'down'; Snd.step(); fx.smoke(V(kp.x, 0.1, kp.z), 5, 2, 1.5, 0x80838e, 1.2, 0.5); shake = 0.25; }
    } else {
      kpose = sample(KA.dead, 0);
      K.body.rotation.x = -Math.PI / 2; K.body.position.set(0, 0.16, 0);
      bpose = sample(BA.roar, Math.min(0.8, (t - 3.6) * 1.5));
      // step back to stand over him
      if (t < 4.2) Bo.pos.copy(fin.bto).addScaledVector(fin.dir, Math.min(0.8, (t - 3.6) * 1.6));
      fin.bto2 = fin.bto2 || fin.bto.clone().addScaledVector(fin.dir, 0.8);
      if (fin.stage === 'down') { fin.stage = 'roar'; Snd.roar(true); Snd.magic(); }
      fx.setAura(Bo.pos, Math.min(1, (t - 3.7) / 1.6));
      shake = Math.max(shake, 0.12);
      if (t > 8.2 && fin.stage === 'roar') { fin.stage = 'done'; endScreen(false); }
    }
    K.rig.apply(kpose, 1 - Math.exp(-dt * 16));
    B.rig.apply(bpose, 1 - Math.exp(-dt * 12));
    // cameras: side two-shot, then the low front shot of the roar
    const mid = kp.clone().lerp(Bo.pos, 0.5);
    const side = V(-fin.dir.z, 0, fin.dir.x);
    if (t < 3.6) { camPos.copy(mid).addScaledVector(side, 8.8).addScaledVector(fin.dir, -2.2); camPos.y = 2.0; camLook.copy(mid); camLook.y = 2.2; }
    else { const f = Math.min(1, (t - 3.6) / 4.6); camPos.copy(Bo.pos).addScaledVector(fin.dir, -(12.5 - f * 2.5)).addScaledVector(side, 0.6); camPos.y = 2.3 + f * 0.3; camLook.copy(Bo.pos); camLook.y = 2.6; }
    finCam = true;
  } else if (mode === 'playerFin') {
    // slow-mo final slash, then the brute staggers, kneels and collapses
    let kpose, bpose = Bo.customPose;
    if (fin.stage === 'slash') {
      const k = Math.min(1, t / 0.35);
      P.pos.lerpVectors(fin.kfrom, fin.kto, k);
      const st = Math.min(t * 0.9, KA.special.dur);
      kpose = sample(KA.special, st);
      const em = st > 0.2 && st < 0.55;
      kTrail.update(dt, em, K.tipA.getWorldPosition(V()), K.tipB.getWorldPosition(V()));
      if (st >= 0.37 && !fin.hit) {
        fin.hit = true; const at = Bo.pos.clone().addScaledVector(fin.dir, 1.0); at.y = 2.0;
        fx.burst(at, 160, 0xff9a30, 14, 8, 1.0); fx.burst(at, 60, 0x8fd8ff, 10, 4, 1.0); fx.flash(at, 0xffd8a0, 9, 0.6);
        flashDiv('white', 0.55); Snd.hit(true); Snd.clang(); shake = 1.0;
      }
      if (st >= KA.special.dur) { fin.stage = 'fall'; fin.t2 = t; timeScale = 1; Snd.roar(false); }
    } else {
      const t2 = t - fin.t2;
      kpose = t2 > 2.2 ? sample(KA.victory, Math.min(0.6, t2 - 2.2)) : sample(KA.special, KA.special.dur);
      if (t2 < 1.0) bpose = sample(BA.stagger, t2 * 0.5);
      else if (t2 < 2.0) bpose = sample(BA.kneel, t2 - 1.0);
      else {
        bpose = sample(BA.kneel, 0.9);
        const k = Math.min(1, (t2 - 2.0) / 0.9), e = k * k;
        B.body.rotation.x = Math.PI / 2 * e * 0.9; B.body.position.set(0, 0.72 * e, 0.3 * e);
        if (k >= 1 && fin.stage === 'fall') { fin.stage = 'down'; Snd.smash(); shake = 0.7; fx.smoke(V(Bo.pos.x, 0.2, Bo.pos.z), 14, 4, 3, 0x80838e, 1.8, 0.7); B.eyeMat.color.setRGB(0.05, 0.1, 0.12); B.eyeL.intensity = 0; }
      }
      if (t2 > 2.2 && fin.stage === 'down') { fin.stage = 'victory'; Snd.win(); showBanner('VICTORY', '#bfe9ff', 3); }
      if (t2 > 5.6 && fin.stage === 'victory') { fin.stage = 'done'; endScreen(true); }
      kTrail.update(dt, false);
    }
    Bo.customPose = bpose;
    K.rig.apply(kpose, 1 - Math.exp(-dt * 22));
    B.rig.apply(bpose, 1 - Math.exp(-dt * 10));
    const mid = P.pos.clone().lerp(Bo.pos, 0.5);
    const side = V(-fin.dir.z, 0, fin.dir.x);
    const orbit = Math.min(t, 6) * 0.07;
    const off = side.clone().multiplyScalar(Math.cos(orbit) * 9.5).addScaledVector(fin.dir, Math.sin(orbit) * 9.5);
    camPos.copy(mid).add(off); camPos.y = 2.2 + Math.min(1.2, t * 0.2); camLook.copy(mid); camLook.y = 1.5;
    finCam = true;
  }
}
function endScreen(win) {
  mode = 'end'; Snd.setScene('end');
  stats.time = gameTime - stats.start;
  $('endTitle').textContent = win ? 'VICTORY' : 'DEFEATED';
  $('endTitle').className = win ? 'win' : 'lose';
  $('endStats').innerHTML = `time ${stats.time.toFixed(0)}s &nbsp;·&nbsp; hits landed ${stats.hits} &nbsp;·&nbsp; damage taken ${Math.round(stats.taken)} &nbsp;·&nbsp; perfect dodges ${stats.dodges}` + (win ? '' : `<br>brute health left: ${Math.round(Bo.hp / MAXB * 100)}%`);
  $('end').classList.remove('off');
  banner.classList.remove('on');
}

// ---------------------------------------------------------------- intro (boss drops into the light shaft)
function startIntro() {
  resetFight();
  mode = 'intro'; modeT = 0; fin.stage = 'drop';
  $('title').classList.add('off'); $('end').classList.add('off');
  document.body.classList.add('cine'); hud.classList.remove('on');
  Bo.y = 26; Snd.setScene('game');
  B.eyeMat.color.setRGB(0.6, 2.4, 3.2); B.eyeL.intensity = 3;
}
function startFight() {
  mode = 'fight'; modeT = 0; Bo.y = 0;
  document.body.classList.remove('cine'); hud.classList.add('on');
  setBoss('idle', { cd: 0.8 });
  stats.start = gameTime;
  showBanner('FIGHT!', '#cfe6ff', 1.0);
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
const perf = { n: 0, sum: 0 };
let lastPose = null;
function frame() {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, clock.getDelta());
  padAxes = pollPad();
  Snd.update(realDt);
  if (bannerT > 0) { bannerT -= realDt; if (bannerT <= 0) banner.classList.remove('on'); }
  if (hitStop > 0) hitStop -= realDt;
  const dt = hitStop > 0 ? 0 : realDt * timeScale;
  gameTime += dt;
  finCam = null;
  if (!qForced && mode === 'fight' && qi > 0) {
    perf.n++; perf.sum += realDt;
    if (perf.n >= 90) { if (perf.sum / perf.n > 0.034) { qi--; applyQuality(); } perf.n = 0; perf.sum = 0; }
  }

  if (mode === 'title') {
    // knight at the balcony edge overlooking the vista (opening shot of the clip)
    P.pos.set(-1.2, 0, -10.6); P.yaw = Math.PI - 0.25; Bo.y = 60;
    K.rig.apply(KIDLE, 0.2);
    camPos.set(0.4 + Math.sin(gameTime * 0.15) * 0.4, 2.15, -6.9); camLook.set(-6, 3.5, -40);
    if (pressed.size || vpress.has('start')) { Snd.start(); Snd.ui(); startIntro(); }
  } else if (mode === 'intro') {
    modeT += realDt; const t = modeT;
    K.rig.apply(KIDLE, 1 - Math.exp(-dt * 10));
    P.yaw = Math.PI;
    if (fin.stage === 'drop') {
      Bo.y = Math.max(0, 26 - (t * t) * 40);
      B.rig.apply(sample(BA.smash, 0.7), 0.3);
      if (Bo.y <= 0) { fin.stage = 'land'; modeT = 0; Snd.smash(); shake = 1.0; fx.shockwave(Bo.pos, 9, 0x60ffd8, 0.8); fx.smoke(Bo.pos, 14, 4, 3, 0x7a7d88, 1.8, 0.7); fx.burst(V(Bo.pos.x, 0.3, Bo.pos.z), 50, 0xffa040, 9, 12, 0.7); }
    } else if (fin.stage === 'land') {
      B.rig.apply(sample(BA.smash, 0.86 + Math.min(0.6, t)), 1 - Math.exp(-dt * 14));
      if (t > 0.8) { fin.stage = 'roar'; modeT = 0; Snd.roar(true); showBanner('SKULLHIDE THE BRUTE', '#ffb27a', 2.0); }
    } else if (fin.stage === 'roar') {
      B.rig.apply(sample(BA.roar, Math.min(0.8, t * 1.4)), 1 - Math.exp(-dt * 8));
      shake = Math.max(shake, 0.15);
      if (t > 2.0) startFight();
    }
    const f = Math.min(1, (fin.stage === 'drop' ? 0 : 0.3) + modeT * 0.2);
    camPos.set(1.6, 1.7 + f * 0.4, 11.5 - f * 0.8); camLook.set(0, 2.6 + Math.max(0, Bo.y * 0.6), -5);
    if (modeT > 0.2 && fin.stage !== 'drop' && (pressed.size || vpress.has('start') || vpress.has('slash'))) { Bo.y = 0; startFight(); }
  } else if (mode === 'fight' || mode === 'phase') {
    if (mode === 'fight') { updatePlayer(dt); if (!window.__dbg.aiOff) updateBoss(dt); }
    else {
      // phase-2 transformation: roar, smoke burst, armor swap, blade drawn
      Bo.t += dt; modeT += dt;
      if (modeT > 0.9 && !fin.swapped) { fin.swapped = true; B.setPhase(2); B.blade.visible = true; Snd.transform(); fx.smoke(V(Bo.pos.x, 1, Bo.pos.z), 24, 5, 3.5, 0xb8bcc8, 2.0, 0.85, 1.2); fx.burst(V(Bo.pos.x, 2.4, Bo.pos.z), 60, 0x60ffe0, 8, 2, 1.2); shake = 0.6; }
      shake = Math.max(shake, 0.12);
      if (modeT > 2.8) { mode = 'fight'; fin.swapped = false; setBoss('recover'); }
      P.act = P.act === 'hurt' ? 'hurt' : null;
    }
    if (mode === 'fight' || mode === 'phase') {
      // player pose
      let kp;
      if (!P.act) {
        kp = runPose(P.runPh, P.moveAmt); kp.__idle = sample(KA.idle, gameTime);
      } else kp = sample(ACTS[P.act].anim, P.actT);
      K.rig.apply(kp, 1 - Math.exp(-dt * (P.act ? 26 : 14)));
      lastPose = kp;
      // roll body spin around the hip pivot
      if (P.act === 'roll') {
        const a = Math.min(1, P.actT / 0.5) * Math.PI * 2;
        K.body.rotation.x = a; K.body.position.set(0, 0.5 - 0.5 * Math.cos(a), -0.5 * Math.sin(a));
      } else { K.body.rotation.x = 0; K.body.position.set(0, 0, 0); }
      B.rig.apply(bossPose(dt), 1 - Math.exp(-dt * 12));
      // sword trails
      const A = ACTS[P.act];
      const emitK = !!(A && A.trail && P.actT >= A.trail[0] && P.actT <= A.trail[1]);
      kTrail.update(dt, emitK, K.tipA.getWorldPosition(V()), K.tipB.getWorldPosition(V()));
      const BAk = Bo.state === 'atk' && BATK[Bo.chain[0]];
      const emitB = !!(BAk && BAk.trail && Bo.t >= BAk.trail[0] && Bo.t <= BAk.trail[1] && B.blade.visible);
      bTrail.update(dt, emitB, B.bTipA.getWorldPosition(V()), B.bTipB.getWorldPosition(V()));
      // sword wave projectile
      if (waveP.on) {
        waveP.life -= dt;
        waveP.pos.addScaledVector(waveP.dir, 22 * dt);
        fx.wave.visible = true; fx.wave.position.copy(waveP.pos);
        fx.wave.rotation.set(0, Math.atan2(waveP.dir.x, waveP.dir.z) + Math.PI / 2, 0);
        if (Math.random() < 0.9) fx.burst(waveP.pos, 3, 0x6fd0ff, 2, 0, 0.35);
        const bd = Math.hypot(waveP.pos.x - Bo.pos.x, waveP.pos.z - Bo.pos.z);
        if (!waveP.hit && bd < 2.0 && mode === 'fight') { waveP.hit = true; waveP.on = false; fx.wave.visible = false; const at = waveP.pos.clone(); at.y = 2; hitBoss(60, 60, at, true); fx.burst(at, 50, 0x6fd0ff, 10, 6, 0.7); }
        if (waveP.life <= 0 || Math.hypot(waveP.pos.x, waveP.pos.z) > 30) { waveP.on = false; fx.wave.visible = false; }
      }
      // HUD
      setBar('hpBar', P.hp / 100); setBar('stBar', P.st / 100); setBar('spBar', P.sp / 100); setBar('bossBar', Bo.hp / MAXB);
      $('spBar').classList.toggle('full', P.sp >= 100);
      $('spTxt').textContent = P.sp >= 100 ? (isTouch ? 'SWORD WAVE READY — WAVE' : 'SWORD WAVE READY — PRESS I') : '';
      // camera: lock-on over the knight's shoulder toward the brute
      const away = V(P.pos.x - Bo.pos.x, 0, P.pos.z - Bo.pos.z);
      if (away.lengthSq() < 0.01) away.set(0, 0, 1);
      away.normalize();
      const side = V(away.z, 0, -away.x);
      const want = P.pos.clone().addScaledVector(away, 5.0).addScaledVector(side, 1.25); want.y = 2.45 + P.y * 0.4;
      const wr = Math.hypot(want.x, want.z); if (wr > 13.4) { want.x *= 13.4 / wr; want.z *= 13.4 / wr; want.y += Math.min(1.6, (wr - 13.4) * 0.5); }
      camPos.lerp(want, 1 - Math.exp(-realDt * 5));
      const look = P.pos.clone().lerp(Bo.pos, 0.42); look.y = 1.75 + Math.max(0, Math.min(0.7, (7 - distPB()) * 0.15)) + Bo.y * 0.3;
      camLook.lerp(look, 1 - Math.exp(-realDt * 7));
      if (mode === 'phase') { camLook.lerp(V(Bo.pos.x, 2.6, Bo.pos.z), 0.6); }
    }
  } else if (mode === 'bossFin' || mode === 'playerFin') {
    updateFinishers(dt, realDt);
    bTrail.update(dt, mode === 'bossFin' && fin.stage === 'raise' && modeT > 2.1, B.bTipA.getWorldPosition(V()), B.bTipB.getWorldPosition(V()));
  } else if (mode === 'end') {
    if (pressed.has('Enter') || pressed.has('Space') || pressed.has('KeyJ') || vpress.has('start')) { if (modeT > 0) { Snd.ui(); startIntro(); } }
    modeT = 1;
    // keep the final tableau alive
    if (fx.aura.k > 0) fx.setAura(Bo.pos, fx.aura.k);
  }
  if (mode !== 'end') { /* reset */ }

  // apply transforms
  K.root.position.set(P.pos.x, P.y, P.pos.z); K.root.rotation.y = P.yaw;
  B.root.position.set(Bo.pos.x, Bo.y, Bo.pos.z); B.root.rotation.y = Bo.yaw;
  const kspeed = (!P.act && mode === 'fight') ? P.moveAmt * 6.4 : (P.act === 'roll' ? 9 : P.act ? 3 : 0);
  updateCape(K, kspeed, gameTime, dt);
  B.gem.rotation.y += dt * 2;
  B.eyeL.intensity = mode === 'playerFin' && fin.stage !== 'slash' && fin.stage !== 'fall' ? 0 : (Bo.state === 'chargeWind' || (Bo.state === 'atk' && Bo.t < 0.5) ? 3 : 1);
  K.glowL.intensity = 5 + Math.sin(gameTime * 7) * 0.8;

  // camera + shake
  shake = Math.max(0, shake - realDt * 2.2);
  if (window.__dbg.cam) { camPos.fromArray(window.__dbg.cam[0]); camLook.fromArray(window.__dbg.cam[1]); }
  camera.position.copy(camPos);
  if (shake > 0) camera.position.add(V((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.3));
  camera.lookAt(camLook);
  world.update(gameTime, dt);
  fx.update(dt, realDt, camera);
  if (QS[qi] === 'low') renderer.render(scene, camera); else composer.render();
  pressed.clear(); vpress.clear();
}

// debug hook for tests (read-only state)
window.__dbg = {
  snapshot() {
    return {
      mode, stage: fin.stage, modeT,
      p: { x: P.pos.x, z: P.pos.z, y: P.y, hp: P.hp, st: P.st, sp: P.sp, act: P.act, actT: P.actT, iframe: P.iframe, yaw: P.yaw },
      b: { x: Bo.pos.x, z: Bo.pos.z, y: Bo.y, hp: Bo.hp, maxHp: MAXB, state: Bo.state, t: Bo.t, phase: Bo.phase, atk: Bo.state === 'atk' ? Bo.chain[0] : null, yaw: Bo.yaw },
      q: QS[qi], dist: distPB(), aura: fx.aura.k, timeScale, stats: { ...stats },
      shock: lastShock && lastShock.m.visible ? { x: lastShock.center.x, z: lastShock.center.z, r: lastShock.r || 0 } : null,
    };
  },
};
resetFight();
frame();
window.__scene = scene; window.__renderer = renderer; window.__K = K; window.__B = B;
window.__ready = true;
