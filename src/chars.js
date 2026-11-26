// Real rigged characters (Quaternius CC0 "Universal Base Characters" + "Universal Animation Library" 1 & 2),
// restyled in code: the knight gets dark plate, a cape and a glowing energy sword; the brute is a scaled-up,
// grey-skinned body with a bone-skull head, orange armor (dark-red plate + cyan gem in phase 2) and a blade.
// main.js drives both through the same tiny interface it always used: sample(anim, t) -> pose, rig.apply(pose, k).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export function lerp(a, b, t) { return a + (b - a) * t; }

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const base = new URL('../assets/models/', import.meta.url).href;
const [bodyG, hairG, beardG, animG] = await Promise.all(
  ['hero_body.glb', 'hair_simpleparted.glb', 'hair_beard.glb', 'anims.glb'].map((f) => loader.loadAsync(base + f)));
const CLIPS = {};
for (const c of animG.animations) {
  // keep rotations everywhere, translation only on the pelvis (stops proportions from being stretched)
  c.tracks = c.tracks.filter((t) => !t.name.startsWith('root.') && (t.name.endsWith('.quaternion') || t.name === 'pelvis.position'));
  CLIPS[c.name] = c;
}

// ------------------------------------------------------------------ animation tables
// m: piecewise map [[gameTime, clipTime], ...] so hit frames line up with the game's hit timing.
const A = (clip, dur, m, extra = {}) => ({ clip, dur, m, ...extra });
const L = (clip, rate = 1) => ({ clip, loop: true, rate, dur: 1 });
const S = (clip, rate = 1) => ({ clip, self: true, rate, dur: 0.1 });
export const KA = {
  idle: L('Sword_Idle'), run: L('Jog_Fwd_Loop'),
  slash1: A('Sword_Regular_A', 0.42, [[0, 0], [0.17, 0.2], [0.42, 0.43]]),
  slash2: A('Sword_Regular_B', 0.42, [[0, 0], [0.16, 0.24], [0.42, 0.53]]),
  slash3: A('Sword_Regular_C', 0.6, [[0, 0], [0.29, 0.5], [0.6, 0.95]]),
  heavy: A('Sword_Attack', 1.0, [[0, 0], [0.66, 0.78], [1.0, 1.5]]),
  special: A('Sword_Dash', 0.7, [[0, 0], [0.36, 0.62], [0.7, 1.2]]),
  roll: A('Roll', 0.5, [[0, 0], [0.5, 1.25]]),
  hurt: A('Hit_Chest', 0.45, [[0, 0], [0.45, 0.33]]),
  kneel: A('Fixing_Kneeling', 0.6, [[0, 0], [0.6, 1.0]]),
  dead: S('Death01', 1.15),
  victory: S('Sword_Idle'),
};
export const KIDLE = { __a: S('Sword_Idle'), __t: 0 };
export const BA = {
  idle: L('Zombie_Idle_Loop', 0.8), walk: L('Zombie_Walk_Fwd_Loop'),
  chargeWind: A('Crouch_Idle_Loop', 0.6, [[0, 0], [0.6, 0.4]]),
  charge: L('Sprint_Loop', 0.9),
  stagger: A('Hit_Knockback', 1.1, [[0, 0], [1.1, 0.83]]),
  roar: A('Spell_Simple_Enter', 0.8, [[0, 0], [0.8, 0.5]]),
  leap: A('NinjaJump_Start', 1.6, [[0, 0], [1.6, 0.96]]),
  punchR: A('Punch_Cross', 0.95, [[0, 0], [0.55, 0.42], [0.95, 1.0]]),
  punchL: A('Punch_Jab', 0.85, [[0, 0], [0.45, 0.3], [0.85, 0.86]]),
  upper: A('Melee_Hook', 1.0, [[0, 0], [0.45, 0.06], [0.6, 0.24], [1.0, 0.47]]),
  smash: A('OverhandThrow', 1.55, [[0, 0], [0.86, 0.62], [1.55, 1.32]]),
  sword1: A('Sword_Attack', 1.15, [[0, 0], [0.72, 0.78], [1.15, 1.5]]),
  sword2: A('Sword_Regular_B', 1.0, [[0, 0], [0.45, 0.08], [0.6, 0.26], [1.0, 0.53]]),
  draw: A('Sword_Block', 0.7, [[0, 0], [0.7, 0.55]]),
  raise: A('OverhandThrow', 0.6, [[0, 0], [0.6, 0.5]]),
  stab: A('OverhandThrow', 0.45, [[0, 0.5], [0.16, 0.68], [0.45, 0.85]]),
  kneel: S('Death01', 1.25),
};
export const BIDLE = { __a: S('Zombie_Idle_Loop', 0.8), __t: 0 };

export function sample(anim, t) { return { __a: anim, __t: t }; }
export function addPose(a) { return a; } // procedural offsets aren't needed with real clips
export function runPose(ph, amt) { return { __a: KA.run, __t: ph, __ph: true, __amt: amt }; }
export function bossWalk(ph, amt) { return { __a: BA.walk, __t: ph, __ph: true, __amt: amt }; }

function mapTime(e, t, rig, clipDur) {
  if (e.self) { return Math.min(clipDur - 1e-3, rig.selfT[e.clip] * e.rate); }
  if (e.loop) { return ((t * e.rate) % clipDur + clipDur) % clipDur; }
  const m = e.m; if (t <= m[0][0]) return m[0][1];
  for (let i = 0; i < m.length - 1; i++) if (t <= m[i + 1][0]) { const f = (t - m[i][0]) / (m[i + 1][0] - m[i][0]); return Math.min(clipDur - 1e-3, lerp(m[i][1], m[i + 1][1], f)); }
  return Math.min(clipDur - 1e-3, m[m.length - 1][1]);
}

class ClipRig {
  constructor(model) { this.mixer = new THREE.AnimationMixer(model); this.acts = {}; this.w = {}; this.selfT = {}; this.last = performance.now(); }
  action(name) {
    let a = this.acts[name];
    if (!a) { a = this.acts[name] = this.mixer.clipAction(CLIPS[name]); a.play(); a.setEffectiveWeight(0); this.w[name] = 0; }
    return a;
  }
  apply(pose, k) {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const tgt = {};
    const add = (e, t, w) => {
      if (!e || w <= 0.001) return;
      const a = this.action(e.clip), d = a.getClip().duration;
      if (e.self) { if (!(e.clip in tgt) && !(this.w[e.clip] > 0.05)) this.selfT[e.clip] = 0; this.selfT[e.clip] = (this.selfT[e.clip] || 0) + dt; }
      let tt = t;
      if (pose.__ph && e === pose.__a) tt = (t / (Math.PI * 2)) * d; // stride phase -> clip time
      a.time = mapTime(e, tt, this, d);
      tgt[e.clip] = (tgt[e.clip] || 0) + w;
    };
    if (pose.__ph) {
      const amt = Math.max(0, Math.min(1, pose.__amt));
      add(pose.__a, pose.__t, amt);
      if (pose.__idle) add(pose.__idle.__a, pose.__idle.__t, 1 - amt);
    } else add(pose.__a, pose.__t, 1);
    let sum = 0;
    const kk = Math.min(1, k * 1.4);
    for (const n in this.w) { this.w[n] += ((tgt[n] || 0) - this.w[n]) * kk; if (this.w[n] < 0.002) this.w[n] = 0; sum += this.w[n]; }
    for (const n in this.w) this.acts[n].setEffectiveWeight(sum > 0 ? this.w[n] / sum : 0);
    this.mixer.update(0);
  }
}

// ------------------------------------------------------------------ helpers
function texCanvas(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function mk(geo, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
  m.castShadow = true; if (parent) parent.add(m); return m;
}
// per-vertex height (0 = feet, 1 = top of head) from the bind pose, used by the recolor shader
function addHeightAttr(geo) {
  const p = geo.attributes.position; let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); mn = Math.min(mn, y); mx = Math.max(mx, y); }
  const h = new Float32Array(p.count); for (let i = 0; i < p.count; i++) h[i] = (p.getY(i) - mn) / (mx - mn);
  geo.setAttribute('aH', new THREE.BufferAttribute(h, 1));
}
// below `cut` the suit becomes `col` (metal/rough); above it keeps the original skin. Above `disc` is cut away.
function regionMaterial(src, { cut, col, metal, rough, skinTint = [1, 1, 1], disc = 2.0, marks = false }) {
  const m = src.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCol = { value: new THREE.Color(col) }; sh.uniforms.uCut = { value: cut }; sh.uniforms.uDisc = { value: disc };
    sh.uniforms.uSkin = { value: new THREE.Vector3(...skinTint) };
    sh.vertexShader = 'attribute float aH;\nvarying float vH;\nvarying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH; vOP = position;');
    sh.fragmentShader = 'varying float vH;\nvarying vec3 vOP;\nuniform vec3 uCol; uniform float uCut; uniform float uDisc; uniform vec3 uSkin;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vH > uDisc) discard;
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        float arm = 1.0 - smoothstep(uCut - 0.006, uCut + 0.006, vH);
        vec3 armC = uCol * (0.45 + 1.1 * lum);
        ${marks ? 'float mk = smoothstep(0.86, 0.97, sin(vOP.x * 41.0 + vOP.y * 23.0 + sin(vOP.z * 30.0) * 2.0)) * step(0.25, vH); armC = mix(armC, vec3(0.42, 0.03, 0.04), mk * 0.8);' : ''}
        diffuseColor.rgb = mix(diffuseColor.rgb * uSkin, armC, arm);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, ${rough.toFixed(3)}, arm);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, ${metal.toFixed(3)}, arm);`);
  };
  m.customProgramCacheKey = () => 'region' + cut + col + disc + marks;
  return m;
}
function instance(withHair) {
  const model = SkeletonUtils.clone(bodyG.scene);
  const bones = {}; let skeleton = null;
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; if (o.name.startsWith('SuperHero')) skeleton = o.skeleton; } });
  if (withHair) for (const g of withHair) {
    const src = SkeletonUtils.clone(g.scene); const meshes = [];
    src.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    for (const hm of meshes) {
      const sk = new THREE.Skeleton(hm.skeleton.bones.map((b) => bones[b.name] || bones.Head), hm.skeleton.boneInverses);
      hm.bind(sk, hm.bindMatrix); hm.frustumCulled = false; model.add(hm);
      hm.material = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.8, map: hm.material.map, alphaTest: hm.material.alphaTest || 0.5, side: THREE.DoubleSide });
    }
  }
  model.updateMatrixWorld(true);
  // attach a piece authored in character space (T-pose, metres, facing +Z) to a bone
  const attach = (bone, obj) => {
    const b = bones[bone]; const inv = b.matrixWorld.clone().invert();
    obj.updateMatrix(); obj.matrix.premultiply(inv); obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
    b.add(obj); return obj;
  };
  return { model, bones, skeleton, attach };
}

// ------------------------------------------------------------------ KNIGHT
export function buildKnight() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // legacy handle (real clips handle rolls/falls now)
  const { model, bones, attach } = instance([hairG, beardG]);
  root.add(model);
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.name.startsWith('SuperHero')) { addHeightAttr(o.geometry); o.material = regionMaterial(o.material, { cut: 0.835, col: 0x3b4150, metal: 0.85, rough: 0.33, skinTint: [0.85, 0.75, 0.7] }); }
  });
  const armor = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.88, roughness: 0.3 });
  const armorDark = new THREE.MeshStandardMaterial({ color: 0x1f2228, metalness: 0.8, roughness: 0.42 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, metalness: 0.95, roughness: 0.25 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2a221d, roughness: 0.85 });
  // pauldrons (layered), gorget, belt, bracers, knee cops
  for (const s of [-1, 1]) {
    const bn = s < 0 ? 'upperarm_r' : 'upperarm_l';
    const g = new THREE.Group(); g.position.set(0.25 * s, 1.47, -0.05);
    mk(new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), armor, g, [0, 0, 0], [0, 0, -0.45 * s], [1.15, 0.9, 1.15]);
    mk(new THREE.TorusGeometry(0.125, 0.012, 6, 20), trim, g, [0.035 * s, -0.035, 0], [Math.PI / 2, 0.45 * s, 0], [1.15, 1.15, 1]);
    mk(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), armorDark, g, [0.06 * s, -0.06, 0], [0, 0, -0.8 * s], [1.1, 0.8, 1.1]);
    attach(bn, g);
    const br = new THREE.Group(); br.position.set(0.6 * s, 1.455, -0.07);
    mk(new THREE.CylinderGeometry(0.052, 0.045, 0.2, 10), armor, br, [0, 0, 0], [0, 0, Math.PI / 2]);
    mk(new THREE.TorusGeometry(0.052, 0.008, 5, 14), trim, br, [-0.09 * s, 0, 0], [0, Math.PI / 2, 0]);
    attach(s < 0 ? 'lowerarm_r' : 'lowerarm_l', br);
    const kn = new THREE.Group(); kn.position.set(0.114 * s, 0.54, 0.03);
    mk(new THREE.SphereGeometry(0.07, 10, 8), trim, kn, [0, 0, 0], [0, 0, 0], [1, 1.1, 0.7]);
    attach(s < 0 ? 'calf_r' : 'calf_l', kn);
  }
  const neck = new THREE.Group(); neck.position.set(0, 1.47, -0.03);
  mk(new THREE.CylinderGeometry(0.1, 0.16, 0.1, 14), armorDark, neck); attach('spine_03', neck);
  const belt = new THREE.Group(); belt.position.set(0, 0.99, -0.03);
  mk(new THREE.CylinderGeometry(0.175, 0.18, 0.07, 18), leather, belt, [0, 0, 0], [0, 0, 0], [1.05, 1, 0.85]);
  mk(new THREE.BoxGeometry(0.07, 0.06, 0.03), trim, belt, [0, 0, 0.155]);
  for (const s of [-1, 1]) mk(new THREE.BoxGeometry(0.16, 0.22, 0.03), armor, belt, [0.1 * s, -0.12, 0.12], [0.15, 0.25 * s, 0]);
  attach('pelvis', belt);
  // cape (vertices animated by updateCape in the holder's own space)
  const capeTex = texCanvas(256, 512, (g, w, h) => {
    g.fillStyle = '#2b2c30'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '90,90,96'},0.08)`; g.fillRect(Math.random() * w, 0, 3 + Math.random() * 8, h); }
    g.save(); g.translate(w / 2, h * 0.2); g.fillStyle = '#5c5f66'; g.strokeStyle = '#86898f'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-42, -40); g.lineTo(42, -40); g.lineTo(42, 10); g.quadraticCurveTo(40, 50, 0, 72); g.quadraticCurveTo(-40, 50, -42, 10); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#2b2c30'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, -30); g.lineTo(0, 55); g.moveTo(-28, -8); g.lineTo(28, -8); g.stroke(); g.restore();
    const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const capeMat = new THREE.MeshStandardMaterial({ map: capeTex, roughness: 0.95, side: THREE.DoubleSide });
  const capeHold = new THREE.Group(); capeHold.position.set(0, 1.47, -0.13);
  const capeGeo = new THREE.PlaneGeometry(0.46, 1.32, 6, 14); capeGeo.translate(0, -0.66, 0);
  const cape = mk(capeGeo, capeMat, capeHold); cape.frustumCulled = false;
  cape.userData.rest = Float32Array.from(capeGeo.attributes.position.array);
  attach('spine_03', capeHold);
  // energy sword in the right hand (blade along +Z in T-pose)
  const sword = new THREE.Group(); sword.position.set(-0.79, 1.44, -0.03);
  sword.rotation.set(0, Math.PI / 2, 0); // grip axis of the UAL hand
  mk(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), leather, sword, [0, 0, -0.02], [Math.PI / 2, 0, 0]);
  mk(new THREE.BoxGeometry(0.035, 0.28, 0.04), trim, sword, [0, 0, 0.09]);
  mk(new THREE.SphereGeometry(0.03, 8, 8), trim, sword, [0, 0, -0.13]);
  const bladeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.6, 3.4), toneMapped: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 3.2, 4.0), toneMapped: false });
  const bladeGeo = new THREE.CylinderGeometry(0.008, 0.032, 1.0, 4); bladeGeo.rotateX(Math.PI / 2); bladeGeo.rotateZ(Math.PI / 4); bladeGeo.scale(0.35, 1.6, 1);
  const blade = mk(bladeGeo, bladeMat, sword, [0, 0, 0.61]); blade.castShadow = false;
  mk(new THREE.BoxGeometry(0.006, 0.012, 0.9), coreMat, sword, [0, 0, 0.58]).castShadow = false;
  const glowL = new THREE.PointLight(0x4fb6ff, 6, 6, 1.8); glowL.position.set(0, 0, 0.6); sword.add(glowL);
  const tipA = new THREE.Object3D(); tipA.position.set(0, 0, 0.14); sword.add(tipA);
  const tipB = new THREE.Object3D(); tipB.position.set(0, 0, 1.1); sword.add(tipB);
  attach('hand_r', sword);
  const rig = new ClipRig(model);
  rig.apply(KIDLE, 1);
  return { root, body, rig, cape, sword, blade, bladeMat, tipA, tipB, glowL, handR: bones.hand_r, model };
}

export function updateCape(k, speed, t, dt) {
  const geo = k.cape.geometry, p = geo.attributes.position, rest = k.cape.userData.rest;
  const sw = Math.min(1, speed / 7);
  for (let i = 0; i < p.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1];
    const v = -y / 1.32;
    const flutter = Math.sin(t * (6 + sw * 8) + v * 5 + x * 6) * 0.03 * v * (0.4 + sw);
    const back = -(0.06 + v * v * (0.14 + sw * 0.55)) + flutter;
    const lift = v * v * sw * 0.32;
    p.setXYZ(i, x * (1 + v * 0.75), y + lift, back - Math.abs(x) * 0.25 * v);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

// ------------------------------------------------------------------ BRUTE
export function buildBoss() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const holder = new THREE.Group(); holder.scale.set(2.05, 1.92, 2.0); root.add(holder);
  const { model, bones, attach } = instance(null);
  holder.add(model);
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.name.startsWith('SuperHero')) { addHeightAttr(o.geometry); o.material = regionMaterial(o.material, { cut: 2.0, col: 0x8a8b92, metal: 0.05, rough: 0.62, disc: 0.845, marks: true }); }
    else o.visible = false; // eyes / eyebrows (replaced by the skull)
  });
  const armorTex = texCanvas(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f09038'); gr.addColorStop(1, '#b8561a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,210,140' : '90,30,5'},0.25)`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + Math.random() * 40 - 20, y + Math.random() * 40 - 20); g.stroke(); }
    g.strokeStyle = 'rgba(150,15,15,0.85)'; g.lineWidth = 6; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 20, x + 40, y + 30, x + 80, y + 8); g.stroke(); }
  });
  const armor = new THREE.MeshStandardMaterial({ map: armorTex, roughness: 0.42, metalness: 0.45, flatShading: true });
  const darkArm = new THREE.MeshStandardMaterial({ color: 0x7a3414, roughness: 0.55, metalness: 0.4, flatShading: true });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x7e1c12, roughness: 0.36, metalness: 0.65, flatShading: true });
  const plateDark = new THREE.MeshStandardMaterial({ color: 0x262a33, roughness: 0.45, metalness: 0.7, flatShading: true });
  const boneM = new THREE.MeshStandardMaterial({ color: 0xbcb8ae, roughness: 0.6, flatShading: true });
  const boneDark = new THREE.MeshStandardMaterial({ color: 0x141216, roughness: 0.9 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 3.2), toneMapped: false });
  const p1 = [], p2 = [];
  const piece = (bone, pos, build, list) => { const g = new THREE.Group(); g.position.set(...pos); build(g); attach(bone, g); if (list) list.push(g); return g; };
  // skull head
  let head;
  piece('Head', [0, 1.69, 0.0], (g) => {
    head = g;
    mk(new THREE.SphereGeometry(0.115, 16, 12), boneM, g, [0, 0.02, 0], [0, 0, 0], [0.95, 1.0, 1.05]);
    mk(new THREE.SphereGeometry(0.085, 12, 10), boneM, g, [0, -0.05, 0.04], [0, 0, 0], [1.0, 0.8, 0.95]);
    for (const s of [-1, 1]) {
      mk(new THREE.SphereGeometry(0.034, 10, 8), boneDark, g, [0.042 * s, -0.005, 0.088], [0, 0, 0], [1.15, 0.95, 0.6]);
      mk(new THREE.SphereGeometry(0.015, 8, 8), eyeMat, g, [0.04 * s, -0.005, 0.102]);
      mk(new THREE.BoxGeometry(0.055, 0.017, 0.03), boneM, g, [0.044 * s, 0.03, 0.092], [0, 0, -0.25 * s]);
      mk(new THREE.ConeGeometry(0.018, 0.09, 5), boneM, g, [0.095 * s, 0.09, -0.01], [0, 0, -0.6 * s]); // horns
    }
    mk(new THREE.ConeGeometry(0.014, 0.035, 3), boneDark, g, [0, -0.045, 0.112], [Math.PI, 0, 0]);
    mk(new THREE.BoxGeometry(0.11, 0.04, 0.1), boneM, g, [0, -0.1, 0.05]);
    for (let i = 0; i < 6; i++) mk(new THREE.BoxGeometry(0.011, 0.016, 0.01), boneM, g, [-0.033 + i * 0.013, -0.077, 0.1]);
  });
  const eyeL = new THREE.PointLight(0x40e0ff, 1, 3, 2); eyeL.position.set(0, 0, 0.35); head.add(eyeL);
  // neck collar of skin under the skull
  piece('neck_01', [0, 1.56, -0.03], (g) => mk(new THREE.CylinderGeometry(0.075, 0.1, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x77787f, roughness: 0.7 }), g));
  // orange armor: pauldrons, bracers, belt + tassets, knee pads, spiked collar
  for (const s of [-1, 1]) {
    const R = s < 0 ? '_r' : '_l';
    piece('upperarm' + R, [0.24 * s, 1.48, -0.04], (g) => {
      mk(new THREE.SphereGeometry(0.15, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), armor, g, [0, 0, 0], [0, 0, -0.5 * s], [1.2, 0.85, 1.15]);
      mk(new THREE.SphereGeometry(0.13, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), darkArm, g, [0.07 * s, -0.06, 0], [0, 0, -0.9 * s], [1.1, 0.75, 1.05]);
      for (let i = 0; i < 3; i++) mk(new THREE.ConeGeometry(0.02, 0.08, 4), boneM, g, [0.02 * s + 0.03 * s * i, 0.08 - i * 0.02, -0.03 + i * 0.03], [0, 0, -0.5 * s]);
    });
    piece('lowerarm' + R, [0.6 * s, 1.455, -0.07], (g) => {
      mk(new THREE.CylinderGeometry(0.06, 0.052, 0.2, 7), armor, g, [0, 0, 0], [0, 0, Math.PI / 2]);
      mk(new THREE.BoxGeometry(0.16, 0.03, 0.03), darkArm, g, [0, 0.055, 0]);
    });
    piece('calf' + R, [0.114 * s, 0.54, 0.04], (g) => mk(new THREE.SphereGeometry(0.075, 7, 5), armor, g, [0, 0, 0], [0, 0, 0], [1, 1.2, 0.7]));
    piece('calf' + R, [0.114 * s, 0.3, 0.02], (g) => mk(new THREE.CylinderGeometry(0.065, 0.055, 0.28, 7), darkArm, g));
  }
  piece('pelvis', [0, 0.99, -0.03], (g) => {
    mk(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 10), armor, g, [0, 0, 0], [0, 0, 0], [1.08, 1, 0.9]);
    mk(new THREE.BoxGeometry(0.17, 0.25, 0.03), darkArm, g, [0, -0.16, 0.16], [0.1, 0, 0]);
    for (const s of [-1, 1]) mk(new THREE.BoxGeometry(0.13, 0.17, 0.03), armor, g, [0.15 * s, -0.1, 0.11], [0.15, 0.5 * s, 0.15 * s]);
    mk(new THREE.BoxGeometry(0.2, 0.22, 0.03), darkArm, g, [0, -0.15, -0.18], [-0.1, 0, 0]);
  });
  piece('spine_03', [0, 1.45, -0.04], (g) => { mk(new THREE.TorusGeometry(0.13, 0.03, 5, 10), darkArm, g, [0, 0, 0], [Math.PI / 2, 0, 0]); }, p1);
  // phase 2: dark-red chest plate with cyan gem, extra plates
  let gem;
  piece('spine_03', [0, 1.32, 0.04], (g) => {
    mk(new THREE.SphereGeometry(0.2, 9, 7), plateMat, g, [0, 0, 0], [0, 0, 0], [1.15, 1.0, 0.75]);
    mk(new THREE.SphereGeometry(0.19, 9, 7), plateDark, g, [0, -0.2, -0.01], [0, 0, 0], [1.0, 0.8, 0.75]);
    gem = mk(new THREE.OctahedronGeometry(0.035), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.0), toneMapped: false }), g, [0, 0.02, 0.15], [0, 0, 0], [1, 1.3, 0.6]);
  }, p2);
  for (const s of [-1, 1]) piece(s < 0 ? 'upperarm_r' : 'upperarm_l', [0.27 * s, 1.5, -0.04], (g) => mk(new THREE.SphereGeometry(0.17, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), plateMat, g, [0, 0, 0], [0, 0, -0.45 * s], [1.2, 0.9, 1.2]), p2);
  // blade (phase 2 + finisher)
  const blade = new THREE.Group(); blade.position.set(-0.78, 1.44, -0.03); blade.rotation.set(0, Math.PI / 2, 0);
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.95, roughness: 0.25 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.4, 2.2), toneMapped: false });
  mk(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), plateDark, blade, [0, 0, -0.03], [Math.PI / 2, 0, 0]);
  mk(new THREE.BoxGeometry(0.035, 0.24, 0.04), plateDark, blade, [0, 0, 0.08]);
  const bg = new THREE.BoxGeometry(0.02, 0.09, 0.62); bg.translate(0, 0, 0.42);
  mk(bg, steel, blade);
  mk(new THREE.BoxGeometry(0.008, 0.012, 0.6), edgeMat, blade, [0, 0.045, 0.42]).castShadow = false;
  const bTipA = new THREE.Object3D(); bTipA.position.set(0, 0, 0.15); blade.add(bTipA);
  const bTipB = new THREE.Object3D(); bTipB.position.set(0, 0, 0.72); blade.add(bTipB);
  attach('hand_r', blade); blade.visible = false;
  function setPhase(n) {
    for (const g of p2) g.visible = n === 2;
    for (const g of p1) g.visible = n !== 2;
    armor.color.set(n === 2 ? 0x8a2a1c : 0xffffff); darkArm.color.set(n === 2 ? 0x3a1410 : 0x7a3414);
  }
  setPhase(1);
  const rig = new ClipRig(model);
  rig.apply(BIDLE, 1);
  return { root, body, rig, eyeL, eyeMat, blade, bTipA, bTipB, fistR: bones.hand_r, setPhase, gem, head, model };
}
