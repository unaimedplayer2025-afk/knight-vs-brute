// Procedural rigs for the caped knight and the skull-faced brute, plus a tiny pose/keyframe system.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ss = (x) => x * x * (3 - 2 * x);
export function lerp(a, b, t) { return a + (b - a) * t; }

// anim = { dur, loop, keys: [[t, pose], ...] }, pose = { joint: [x,y,z], hy: number }
export function sample(anim, time) {
  const k = anim.keys;
  let t = anim.loop ? (time % anim.dur) : Math.min(time, anim.dur);
  if (t <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, p0] = k[i], [t1, p1] = k[i + 1];
    if (t >= t0 && t <= t1) {
      const f = ss((t - t0) / Math.max(1e-6, t1 - t0));
      const out = {};
      const names = new Set([...Object.keys(p0), ...Object.keys(p1)]);
      for (const n of names) {
        const a = p0[n] ?? (n === 'hy' || n === 'hz' ? 0 : [0, 0, 0]);
        const b = p1[n] ?? (n === 'hy' || n === 'hz' ? 0 : [0, 0, 0]);
        out[n] = typeof a === 'number' ? lerp(a, b, f) : [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
      }
      return out;
    }
  }
  return k[k.length - 1][1];
}
export function addPose(a, b, w = 1) {
  const out = { ...a };
  for (const n in b) {
    const bv = b[n], av = a[n];
    if (typeof bv === 'number') out[n] = (av || 0) + bv * w;
    else { const x = av || [0, 0, 0]; out[n] = [x[0] + bv[0] * w, x[1] + bv[1] * w, x[2] + bv[2] * w]; }
  }
  return out;
}

class Rig {
  constructor() { this.j = {}; this.hipsBaseY = 0; this.hips = null; }
  add(name, o, order) { if (order) o.rotation.order = order; o.userData.base = o.rotation.clone(); this.j[name] = o; return o; }
  apply(pose, k) {
    for (const n in this.j) {
      const o = this.j[n], b = o.userData.base, p = pose[n] || [0, 0, 0];
      o.rotation.x = lerp(o.rotation.x, b.x + p[0], k);
      o.rotation.y = lerp(o.rotation.y, b.y + p[1], k);
      o.rotation.z = lerp(o.rotation.z, b.z + p[2], k);
    }
    if (this.hips) {
      this.hips.position.y = lerp(this.hips.position.y, this.hipsBaseY + (pose.hy || 0), k);
      this.hips.position.z = lerp(this.hips.position.z, (pose.hz || 0), k);
    }
  }
}

function tag(t, m) { m.userData.tag = t; return m; }
function mk(geo, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
// merge each joint's direct mesh children that share a material (+tag) into one mesh
export function mergeRig(rootObj) {
  const joints = [];
  rootObj.traverse((o) => { if (!o.isMesh) joints.push(o); });
  for (const j of joints) {
    const groups = new Map();
    for (const c of j.children.slice()) {
      if (!c.isMesh || c.userData.keep || c.children.length) continue;
      const key = c.material.uuid + '|' + (c.userData.tag || '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map((c) => {
        c.updateMatrix();
        let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
        g.applyMatrix4(c.matrix); return g;
      });
      const m = new THREE.Mesh(mergeGeometries(geos, false), list[0].material);
      m.castShadow = true; m.receiveShadow = true; m.userData.tag = list[0].userData.tag;
      list.forEach(c => j.remove(c));
      j.add(m);
    }
  }
}
function joint(parent, pos = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; }
function texCanvas(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// ------------------------------------------------------------------------------------------
// KNIGHT: dark plate armor, dark cape with a shield sigil, bare head with dark hair,
// glowing blue energy sword.
// ------------------------------------------------------------------------------------------
export function buildKnight() {
  const root = new THREE.Group();
  const body = joint(root); // whole-body tilt (falls)
  const rig = new Rig();
  const armor = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.85, roughness: 0.35, envMapIntensity: 0.9 });
  const armorDark = new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.8, roughness: 0.45, envMapIntensity: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8d96a8, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.0 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2a221d, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x9c6e55, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.9 });
  const capeTex = texCanvas(256, 512, (g, w, h) => {
    g.fillStyle = '#2b2c30'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '90,90,96'},0.08)`; g.fillRect(Math.random() * w, 0, 3 + Math.random() * 8, h); }
    // shield sigil like the knight's cape in the clip
    g.save(); g.translate(w / 2, h * 0.2);
    g.fillStyle = '#5c5f66'; g.strokeStyle = '#86898f'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-42, -40); g.lineTo(42, -40); g.lineTo(42, 10); g.quadraticCurveTo(40, 50, 0, 72); g.quadraticCurveTo(-40, 50, -42, 10); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#2b2c30'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, -30); g.lineTo(0, 55); g.moveTo(-28, -8); g.lineTo(28, -8); g.stroke();
    g.restore();
    const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const capeMat = new THREE.MeshStandardMaterial({ map: capeTex, roughness: 0.95, side: THREE.DoubleSide });

  const hips = rig.add('hips', joint(body, [0, 0.96, 0]));
  rig.hips = hips; rig.hipsBaseY = 0.96;
  mk(new THREE.CylinderGeometry(0.19, 0.17, 0.16, 12), leather, hips, [0, 0.02, 0]);
  mk(new THREE.TorusGeometry(0.19, 0.035, 6, 16), trim, hips, [0, 0.08, 0], [Math.PI / 2, 0, 0]);
  const spine = rig.add('spine', joint(hips, [0, 0.08, 0]));
  mk(new THREE.CapsuleGeometry(0.17, 0.26, 4, 12), armorDark, spine, [0, 0.24, 0], [0, 0, 0], [1.25, 1, 0.82]);
  mk(new THREE.SphereGeometry(0.2, 16, 12), armor, spine, [0, 0.35, 0.05], [0, 0, 0], [1.2, 1.05, 0.75]); // breastplate
  mk(new THREE.BoxGeometry(0.03, 0.2, 0.03), trim, spine, [0, 0.35, 0.2]);
  for (let i = 0; i < 3; i++) mk(new THREE.CylinderGeometry(0.2 - i * 0.005, 0.21, 0.06, 14, 1, true), armor, spine, [0, 0.1 + i * 0.065, 0.0], [0, 0, 0], [1.15, 1, 0.85]);
  mk(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 10), armorDark, spine, [0, 0.55, 0]); // gorget
  const neck = rig.add('neck', joint(spine, [0, 0.58, 0]));
  const head = rig.add('head', joint(neck, [0, 0.06, 0]));
  mk(new THREE.SphereGeometry(0.115, 14, 12), skin, head, [0, 0.1, 0.01], [0, 0, 0], [0.9, 1.05, 0.98]);
  mk(new THREE.SphereGeometry(0.12, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, head, [0, 0.12, -0.01], [-0.2, 0, 0], [0.95, 1, 1.02]);
  mk(new THREE.BoxGeometry(0.11, 0.05, 0.05), hair, head, [0, 0.03, 0.08]); // beard shadow
  // cape
  const capeGeo = new THREE.PlaneGeometry(0.46, 1.32, 6, 14); capeGeo.translate(0, -0.66, 0);
  const cape = mk(capeGeo, capeMat, spine, [0, 0.56, -0.17]);
  cape.userData.rest = Float32Array.from(capeGeo.attributes.position.array);
  mk(new THREE.CylinderGeometry(0.2, 0.25, 0.1, 12, 1, true), capeMat, spine, [0, 0.55, -0.04], [0, 0, 0], [1.3, 1, 1]); // collar drape

  const arm = (side) => {
    const s = side === 'L' ? 1 : -1;
    const sh = rig.add('sh' + side, joint(spine, [0.27 * s, 0.5, 0]), 'YXZ');
    mk(new THREE.SphereGeometry(0.13, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), armor, sh, [0.03 * s, 0.03, 0], [0, 0, -0.4 * s], [1.25, 1, 1.15]);
    mk(new THREE.SphereGeometry(0.12, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), trim, sh, [0.05 * s, -0.04, 0], [0, 0, -0.6 * s], [1.15, 0.9, 1.1]);
    mk(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), armorDark, sh, [0, -0.15, 0]);
    const el = rig.add('el' + side, joint(sh, [0, -0.3, 0]));
    mk(new THREE.SphereGeometry(0.065, 8, 8), trim, el);
    mk(new THREE.CylinderGeometry(0.075, 0.055, 0.22, 10), armor, el, [0, -0.13, 0]);
    const ha = rig.add('ha' + side, joint(el, [0, -0.27, 0]));
    mk(new THREE.BoxGeometry(0.09, 0.1, 0.1), armorDark, ha, [0, -0.02, 0]);
    return ha;
  };
  arm('L'); const handR = arm('R');

  const leg = (side) => {
    const s = side === 'L' ? 1 : -1;
    const hp = rig.add('hip' + side, joint(hips, [0.105 * s, -0.04, 0]));
    mk(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), armorDark, hp, [0, -0.22, 0]);
    mk(new THREE.BoxGeometry(0.17, 0.24, 0.05), armor, hp, [0.02 * s, -0.1, 0.1], [-0.15, 0, 0]); // tasset
    mk(new THREE.BoxGeometry(0.17, 0.24, 0.05), armor, hp, [0.02 * s, -0.1, -0.1], [0.15, 0, 0]);
    const kn = rig.add('kn' + side, joint(hp, [0, -0.45, 0]));
    mk(new THREE.SphereGeometry(0.07, 8, 8), trim, kn, [0, 0, 0.04]);
    mk(new THREE.CylinderGeometry(0.075, 0.06, 0.36, 10), armor, kn, [0, -0.2, 0.01]);
    mk(new THREE.BoxGeometry(0.11, 0.08, 0.22), armorDark, kn, [0, -0.43, 0.04]);
  };
  leg('L'); leg('R');

  // energy sword: hilt in the right hand, blade along hand +z
  const sword = joint(handR, [0, -0.04, 0.02]);
  mk(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), leather, sword, [0, 0, -0.02], [Math.PI / 2, 0, 0]);
  mk(new THREE.BoxGeometry(0.28, 0.035, 0.04), trim, sword, [0, 0, 0.09]);
  mk(new THREE.SphereGeometry(0.03, 8, 8), trim, sword, [0, 0, -0.13]);
  const bladeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.6, 3.4), toneMapped: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 3.0, 3.6), toneMapped: false });
  const bladeGeo = new THREE.CylinderGeometry(0.008, 0.032, 1.0, 4); bladeGeo.rotateX(Math.PI / 2); bladeGeo.rotateZ(Math.PI / 4); bladeGeo.scale(1.6, 0.35, 1);
  const blade = mk(bladeGeo, bladeMat, sword, [0, 0, 0.61]); blade.castShadow = false;
  const core = mk(new THREE.BoxGeometry(0.012, 0.006, 0.9), coreMat, sword, [0, 0, 0.58]); core.castShadow = false;
  const glowL = new THREE.PointLight(0x4fb6ff, 6, 6, 1.8); glowL.position.set(0, 0, 0.6); sword.add(glowL);
  const tipA = new THREE.Object3D(); tipA.position.set(0, 0, 0.14); sword.add(tipA);
  const tipB = new THREE.Object3D(); tipB.position.set(0, 0, 1.1); sword.add(tipB);

  cape.userData.keep = true; blade.userData.keep = true;
  mergeRig(root);
  return { root, body, rig, cape, sword, blade, bladeMat, tipA, tipB, glowL, handR };
}

export function updateCape(k, speed, t, dt) {
  const geo = k.cape.geometry, p = geo.attributes.position, rest = k.cape.userData.rest;
  const sw = Math.min(1, speed / 7);
  for (let i = 0; i < p.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1];
    const v = -y / 1.32; // 0 top .. 1 bottom
    const flutter = Math.sin(t * (6 + sw * 8) + v * 5 + x * 6) * 0.03 * v * (0.4 + sw);
    const back = -(0.04 + v * v * (0.12 + sw * 0.55)) + flutter;
    const lift = v * v * sw * 0.32;
    p.setXYZ(i, x * (1 + v * 0.75), y + lift, back - Math.abs(x) * 0.25 * v);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

// knight animations (radians; see README in the repo for conventions)
const KI = { hipL: [-0.12, 0, 0.03], hipR: [0.15, 0, -0.03], knL: [0.22, 0, 0], knR: [0.18, 0, 0], spine: [0.05, 0, 0], shL: [-0.15, 0, 0.18], elL: [-0.5, 0, 0], shR: [-0.35, -0.25, -0.12], elR: [-0.75, 0, 0], haR: [1.35, 0, 0.25], hy: -0.03 };
export const KA = {
  idle: { dur: 2.4, loop: true, keys: [[0, KI], [1.2, { ...KI, spine: [0.08, 0, 0], hy: -0.05 }], [2.4, KI]] },
  // 3-hit combo: right->left sweep, backhand, overhead chop
  slash1: { dur: 0.42, keys: [
    [0, { ...KI, shR: [-1.5, -1.45, 0], elR: [-0.35, 0, 0], haR: [1.5, 0, 0], spine: [0.1, -0.7, 0], hipL: [-0.4, 0, 0], knL: [0.4, 0, 0], hipR: [0.3, 0, 0], knR: [0.3, 0, 0], hy: -0.08 }],
    [0.1, { ...KI, shR: [-1.6, -1.6, 0], elR: [-0.3, 0, 0], haR: [1.55, 0, 0], spine: [0.15, -0.85, 0], hipL: [-0.5, 0, 0], knL: [0.5, 0, 0], hipR: [0.35, 0, 0], knR: [0.3, 0, 0], hy: -0.1 }],
    [0.22, { ...KI, shR: [-1.55, 1.3, 0], elR: [-0.1, 0, 0], haR: [1.55, 0, 0], spine: [0.22, 0.75, 0], shL: [-0.3, 0, 0.7], hipL: [-0.75, 0, 0], knL: [0.7, 0, 0], hipR: [0.45, 0, 0], knR: [0.25, 0, 0], hy: -0.16 }],
    [0.42, { ...KI, shR: [-1.2, 1.1, 0], elR: [-0.4, 0, 0], haR: [1.4, 0, 0], spine: [0.15, 0.5, 0], hipL: [-0.5, 0, 0], knL: [0.5, 0, 0], hy: -0.1 }]] },
  slash2: { dur: 0.42, keys: [
    [0, { ...KI, shR: [-1.3, 1.2, 0], elR: [-0.6, 0, 0], haR: [1.6, 0, 0.6], spine: [0.15, 0.7, 0], hipL: [-0.5, 0, 0], knL: [0.5, 0, 0], hy: -0.1 }],
    [0.09, { ...KI, shR: [-1.2, 1.35, 0], elR: [-0.7, 0, 0], haR: [1.6, 0, 0.7], spine: [0.15, 0.8, 0], hipR: [-0.5, 0, 0], knR: [0.5, 0, 0], hy: -0.12 }],
    [0.22, { ...KI, shR: [-2.0, -1.3, 0], elR: [-0.05, 0, 0], haR: [1.6, 0, 0.5], spine: [0.05, -0.8, 0], shL: [-0.2, 0, 0.6], hipR: [-0.7, 0, 0], knR: [0.6, 0, 0], hipL: [0.4, 0, 0], hy: -0.15 }],
    [0.42, { ...KI, shR: [-1.6, -1.0, 0], elR: [-0.3, 0, 0], haR: [1.5, 0, 0.3], spine: [0.08, -0.5, 0], hipR: [-0.4, 0, 0], knR: [0.4, 0, 0], hy: -0.08 }]] },
  slash3: { dur: 0.6, keys: [
    [0, { ...KI, shR: [-2.4, -0.2, 0], elR: [-0.9, 0, 0], haR: [0.9, 0, 0], shL: [-2.2, 0, 0.2], elL: [-0.9, 0, 0], spine: [-0.25, -0.1, 0], hy: 0.0 }],
    [0.16, { ...KI, shR: [-3.0, -0.1, 0], elR: [-0.6, 0, 0], haR: [0.8, 0, 0], shL: [-2.8, 0, 0.3], elL: [-0.7, 0, 0], spine: [-0.35, 0, 0], hipL: [-0.5, 0, 0], knL: [0.3, 0, 0], hy: 0.05 }],
    [0.3, { ...KI, shR: [-0.85, -0.15, 0], elR: [-0.05, 0, 0], haR: [1.75, 0, 0], shL: [-0.9, 0.3, 0.2], elL: [-0.3, 0, 0], spine: [0.6, 0, 0], hipL: [-1.0, 0, 0], knL: [1.2, 0, 0], hipR: [0.5, 0, 0], knR: [0.8, 0, 0], hy: -0.35 }],
    [0.6, { ...KI, shR: [-0.8, -0.2, 0], elR: [-0.2, 0, 0], haR: [1.7, 0, 0], spine: [0.45, 0, 0], hipL: [-0.8, 0, 0], knL: [1.0, 0, 0], hipR: [0.4, 0, 0], knR: [0.6, 0, 0], hy: -0.28 }]] },
  // leaping overhead strike: crouch, rise with sword overhead, slam
  heavy: { dur: 1.0, keys: [
    [0, { ...KI, spine: [0.4, 0, 0], hipL: [-0.9, 0, 0], knL: [1.4, 0, 0], hipR: [-0.6, 0, 0], knR: [1.4, 0, 0], shR: [-0.2, 0, -0.3], elR: [-0.4, 0, 0], hy: -0.35 }],
    [0.18, { ...KI, spine: [0.45, 0, 0], hipL: [-1.0, 0, 0], knL: [1.6, 0, 0], hipR: [-0.7, 0, 0], knR: [1.6, 0, 0], shR: [-0.3, 0, -0.3], hy: -0.4 }],
    [0.32, { ...KI, spine: [-0.4, 0, 0], shR: [-3.1, 0, 0], elR: [-0.9, 0, 0], haR: [0.6, 0, 0], shL: [-3.0, 0, 0.25], elL: [-0.9, 0, 0], hipL: [-0.9, 0, 0], knL: [1.5, 0, 0], hipR: [0.2, 0, 0], knR: [1.2, 0, 0], hy: 0 }],
    [0.55, { ...KI, spine: [-0.45, 0, 0], shR: [-3.3, 0, 0], elR: [-1.0, 0, 0], haR: [0.5, 0, 0], shL: [-3.2, 0, 0.25], elL: [-1.0, 0, 0], hipL: [-1.1, 0, 0], knL: [1.8, 0, 0], hipR: [-0.3, 0, 0], knR: [1.6, 0, 0], hy: 0 }],
    [0.66, { ...KI, spine: [0.75, 0, 0], shR: [-0.7, 0, 0], elR: [0, 0, 0], haR: [1.8, 0, 0], shL: [-0.8, 0.3, 0.2], elL: [-0.2, 0, 0], hipL: [-1.2, 0, 0], knL: [1.5, 0, 0], hipR: [0.4, 0, 0], knR: [1.7, 0, 0], hy: -0.42 }],
    [1.0, { ...KI, spine: [0.6, 0, 0], shR: [-0.7, 0, 0], haR: [1.8, 0, 0], hipL: [-1.0, 0, 0], knL: [1.3, 0, 0], hipR: [0.3, 0, 0], knR: [1.3, 0, 0], hy: -0.35 }]] },
  special: { dur: 0.7, keys: [
    [0, { ...KI, shR: [-1.3, -1.9, 0], elR: [-0.3, 0, 0], haR: [1.6, 0, 0], spine: [0.1, -1.0, 0], hy: -0.15, hipL: [-0.6, 0, 0], knL: [0.7, 0, 0] }],
    [0.25, { ...KI, shR: [-1.5, -2.1, 0], elR: [-0.2, 0, 0], haR: [1.6, 0, 0], spine: [0.15, -1.1, 0], hy: -0.2, hipL: [-0.7, 0, 0], knL: [0.8, 0, 0] }],
    [0.38, { ...KI, shR: [-1.6, 1.5, 0], elR: [0, 0, 0], haR: [1.6, 0, 0], spine: [0.25, 0.9, 0], shL: [-0.4, 0, 1.0], hy: -0.25, hipL: [-0.9, 0, 0], knL: [0.9, 0, 0], hipR: [0.5, 0, 0] }],
    [0.7, { ...KI, shR: [-1.3, 1.2, 0], haR: [1.5, 0, 0], spine: [0.15, 0.6, 0], hy: -0.12 }]] },
  roll: { dur: 0.5, keys: [
    [0, { ...KI, spine: [0.9, 0, 0], hipL: [-1.6, 0, 0], knL: [2.0, 0, 0], hipR: [-1.5, 0, 0], knR: [2.1, 0, 0], shL: [-1.0, 0, 0.3], shR: [-1.0, 0, -0.3], elR: [-1.2, 0, 0], hy: -0.45 }],
    [0.5, { ...KI, spine: [0.9, 0, 0], hipL: [-1.6, 0, 0], knL: [2.0, 0, 0], hipR: [-1.5, 0, 0], knR: [2.1, 0, 0], shL: [-1.0, 0, 0.3], shR: [-1.0, 0, -0.3], elR: [-1.2, 0, 0], hy: -0.45 }]] },
  hurt: { dur: 0.45, keys: [[0, { ...KI, spine: [-0.45, 0.2, 0], head: [-0.4, 0, 0], shL: [-0.6, 0, 0.9], shR: [-0.3, 0, -0.9], hy: -0.08 }], [0.45, KI]] },
  kneel: { dur: 0.6, keys: [[0, KI], [0.6, { ...KI, spine: [0.35, 0, 0], head: [0.2, 0, 0], hipL: [-1.45, 0, 0.05], knL: [1.5, 0, 0], hipR: [0.15, 0, -0.05], knR: [2.25, 0, 0], shR: [-0.55, 0, -0.35], elR: [-0.4, 0, 0], haR: [2.4, 0, 0], shL: [-1.2, 0.3, 0.3], elL: [-1.4, 0, 0], hy: -0.5 }]] },
  dead: { dur: 0.1, keys: [[0, { spine: [0, 0, 0], shL: [0.1, 0, 0.6], shR: [0.1, 0, -0.7], elL: [-0.2, 0, 0], hipL: [0, 0, 0.12], hipR: [0, 0, -0.1], knL: [0.2, 0, 0], head: [0, 0.4, 0], haR: [1.6, 0, 0] }]] },
  victory: { dur: 0.6, keys: [[0, KI], [0.6, { ...KI, shR: [-3.0, 0, -0.15], elR: [-0.1, 0, 0], haR: [1.5, 0, 0], spine: [-0.1, 0, 0], head: [-0.25, 0, 0], shL: [-0.3, 0, 0.5] }]] },
};
export const KIDLE = KI;
export function runPose(ph, amt) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    hipL: [-s * 0.85, 0, 0], hipR: [s * 0.85, 0, 0],
    knL: [Math.max(0, c) * 1.2 + 0.15, 0, 0], knR: [Math.max(0, -c) * 1.2 + 0.15, 0, 0],
    shL: [s * 0.6 - 0.2, 0, 0.18], elL: [-0.7, 0, 0],
    shR: [-0.5 - s * 0.25, -0.2, -0.25], elR: [-0.6, 0, 0], haR: [1.2, 0, 0.3],
    spine: [0.22 * amt, -s * 0.12, 0], hy: -0.06 - Math.abs(c) * 0.06 * amt,
  };
}

// ------------------------------------------------------------------------------------------
// BRUTE: huge hunched skull-faced brute, grey skin with red markings, orange armor plates.
// Phase 2 swaps to dark-red full plate with a cyan chest gem and draws a blade (like the clip).
// ------------------------------------------------------------------------------------------
export function buildBoss() {
  const root = new THREE.Group();
  const body = joint(root);
  const rig = new Rig();
  const skinTex = texCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#6f6d74'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,30,40' : '200,200,205'},0.06)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, 7); g.fill(); }
    // red tribal slash markings
    g.strokeStyle = '#a3141c'; g.lineCap = 'round';
    for (let i = 0; i < 44; i++) {
      g.lineWidth = 4 + Math.random() * 8;
      const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6, l = 20 + Math.random() * 60;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y + 4); g.lineTo(x + Math.cos(a - 0.4) * l * 0.5, y + Math.sin(a - 0.4) * l * 0.5); g.stroke();
    }
  });
  const armorTex = texCanvas(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e48a32'); gr.addColorStop(1, '#b45a1a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,200,120' : '90,30,5'},0.25)`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + Math.random() * 60 - 30, y + Math.random() * 60 - 30); g.stroke(); }
    g.strokeStyle = 'rgba(170,20,20,0.8)'; g.lineWidth = 8; g.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 40, y - 30, x + 60, y + 40, x + 110, y + 10); g.stroke(); }
  });
  const skin = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.6, metalness: 0.08 });
  const armor = new THREE.MeshStandardMaterial({ map: armorTex, roughness: 0.45, metalness: 0.4, envMapIntensity: 0.8, flatShading: true });
  const darkArm = new THREE.MeshStandardMaterial({ color: 0x8a3a16, roughness: 0.55, metalness: 0.4, flatShading: true });
  const bone = new THREE.MeshStandardMaterial({ color: 0xb4b2ad, roughness: 0.6, flatShading: true });
  const boneDark = new THREE.MeshStandardMaterial({ color: 0x1c1a1e, roughness: 0.9 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 3.2), toneMapped: false });
  const p2 = []; // phase-2-only plate
  const p1 = []; // phase-1-only bits

  const hips = rig.add('hips', joint(body, [0, 1.78, 0]));
  rig.hips = hips; rig.hipsBaseY = 1.78;
  mk(new THREE.SphereGeometry(0.62, 16, 12), skin, hips, [0, 0.05, 0], [0, 0, 0], [1.15, 0.6, 0.85]);
  // belt + loincloth plates (orange)
  mk(new THREE.CylinderGeometry(0.72, 0.7, 0.22, 16, 1, true), armor, hips, [0, 0.12, 0], [0, 0, 0], [1.02, 1, 0.82]);
  mk(new THREE.BoxGeometry(0.62, 0.7, 0.08), darkArm, hips, [0, -0.32, 0.5], [0.12, 0, 0]);
  for (const sx of [-1, 1]) mk(new THREE.BoxGeometry(0.42, 0.4, 0.07), armor, hips, [0.5 * sx, -0.12, 0.34], [0.15, 0.5 * sx, 0.2 * sx]);
  mk(new THREE.BoxGeometry(0.62, 0.62, 0.08), darkArm, hips, [0, -0.28, -0.52], [-0.12, 0, 0]);
  const spine = rig.add('spine', joint(hips, [0, 0.2, 0]));
  const chest = rig.add('chest', joint(spine, [0, 0.55, 0]));
  mk(new THREE.CapsuleGeometry(0.5, 0.35, 6, 14), skin, spine, [0, 0.35, 0.05], [0, 0, 0], [1.05, 1, 0.8]); // abdomen
  for (let r = 0; r < 3; r++) for (let s of [-1, 1]) mk(new THREE.SphereGeometry(0.15, 8, 8), skin, spine, [0.15 * s, 0.15 + r * 0.2, 0.42], [0, 0, 0], [1.1, 0.9, 0.6]); // abs
  mk(new THREE.SphereGeometry(0.8, 18, 14), skin, chest, [0, 0.35, 0], [0, 0, 0], [1.35, 0.95, 0.9]); // ribcage
  for (const s of [-1, 1]) mk(new THREE.SphereGeometry(0.45, 14, 10), skin, chest, [0.42 * s, 0.4, 0.42], [0, 0, 0], [1.1, 0.8, 0.6]); // pecs
  mk(new THREE.SphereGeometry(0.7, 14, 10), skin, chest, [0, 0.62, -0.3], [0, 0, 0], [1.35, 0.55, 0.8]); // trapezius hump
  // phase-2 chest plate + cyan core gem
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x8c2415, roughness: 0.38, metalness: 0.6, envMapIntensity: 0.9, flatShading: true });
  const plateDark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.5, metalness: 0.6 });
  p2.push(tag('p2', mk(new THREE.SphereGeometry(0.84, 18, 14), plateMat, chest, [0, 0.36, 0.06], [0, 0, 0], [1.38, 0.98, 0.9])));
  p2.push(tag('p2', mk(new THREE.CapsuleGeometry(0.52, 0.3, 6, 14), plateDark, spine, [0, 0.35, 0.06], [0, 0, 0], [1.08, 1, 0.82])));
  const gemMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.0), toneMapped: false });
  const gem = mk(new THREE.OctahedronGeometry(0.13), gemMat, chest, [0, 0.42, 0.82], [0, 0, 0], [1, 1.3, 0.6]); gem.userData.keep = true; gem.userData.tag = 'p2'; p2.push(gem);
  p2.push(tag('p2', mk(new THREE.BoxGeometry(0.75, 0.9, 0.1), plateMat, hips, [0, -0.4, 0.56], [0.12, 0, 0])));

  const neck = rig.add('neck', joint(chest, [0, 0.66, 0.55]));
  mk(new THREE.CylinderGeometry(0.26, 0.36, 0.4, 10), skin, neck, [0, 0.05, -0.05], [0.5, 0, 0]);
  const head = rig.add('head', joint(neck, [0, 0.2, 0.14]));
  head.scale.setScalar(1.22);
  // skull face
  mk(new THREE.SphereGeometry(0.34, 18, 14), bone, head, [0, 0.2, 0], [0, 0, 0], [0.92, 1.0, 1.0]);
  mk(new THREE.SphereGeometry(0.25, 14, 10), bone, head, [0, 0.0, 0.12], [0, 0, 0], [1.0, 0.8, 0.9]); // cheeks/maxilla
  for (const s of [-1, 1]) {
    mk(new THREE.SphereGeometry(0.105, 10, 8), boneDark, head, [0.125 * s, 0.13, 0.26], [0, 0, 0], [1.15, 0.95, 0.6]);
    mk(new THREE.SphereGeometry(0.045, 8, 8), eyeMat, head, [0.12 * s, 0.13, 0.31]);
    mk(new THREE.BoxGeometry(0.16, 0.05, 0.08), bone, head, [0.13 * s, 0.22, 0.27], [0, 0, -0.25 * s]); // brow ridge
  }
  mk(new THREE.ConeGeometry(0.045, 0.1, 3), boneDark, head, [0, 0.03, 0.33], [Math.PI, 0, 0]);
  const jaw = rig.add('jaw', joint(head, [0, -0.04, 0.02]));
  mk(new THREE.BoxGeometry(0.34, 0.12, 0.3), bone, jaw, [0, -0.08, 0.13]);
  for (let i = 0; i < 6; i++) mk(new THREE.BoxGeometry(0.035, 0.06, 0.03), bone, head, [-0.1 + i * 0.04, -0.06, 0.3]);
  for (let i = 0; i < 6; i++) mk(new THREE.BoxGeometry(0.035, 0.05, 0.03), bone, jaw, [-0.1 + i * 0.04, -0.01, 0.27]);
  // orange spiky crest
  for (let i = 0; i < 5; i++) { const m = mk(new THREE.ConeGeometry(0.06, 0.25, 5), armor, head, [(i - 2) * 0.12, 0.44 - Math.abs(i - 2) * 0.05, -0.12], [-0.6, 0, (i - 2) * -0.3]); m.userData.tag = 'p1'; p1.push(m); }
  // phase-2 helmet/mask tint
  const maskMat = new THREE.MeshStandardMaterial({ color: 0x55657a, roughness: 0.5, metalness: 0.5 });
  p2.push(tag('p2', mk(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), plateMat, head, [0, 0.21, -0.02], [-0.25, 0, 0], [0.98, 0.9, 1.02])));
  const eyeL = new THREE.PointLight(0x40e0ff, 1, 3, 2); eyeL.position.set(0, 0.15, 1.1); head.add(eyeL);

  const arm = (side) => {
    const s = side === 'L' ? 1 : -1;
    const sh = rig.add('sh' + side, joint(chest, [1.05 * s, 0.55, 0]), 'YXZ');
    mk(new THREE.SphereGeometry(0.42, 14, 10), skin, sh, [0, -0.05, 0]); // deltoid
    // big orange pauldron with spikes
    const pa = mk(new THREE.SphereGeometry(0.56, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), armor, sh, [0.14 * s, 0.1, 0], [0, 0, -0.45 * s], [1.2, 0.85, 1.15]);
    mk(new THREE.SphereGeometry(0.5, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.45), armor, sh, [0.3 * s, -0.12, 0], [0, 0, -0.95 * s], [1.1, 0.7, 1.05]);
    mk(new THREE.SphereGeometry(0.44, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.45), darkArm, sh, [0.36 * s, -0.32, 0], [0, 0, -1.25 * s], [1.0, 0.6, 1.0]);
    for (let i = 0; i < 4; i++) mk(new THREE.ConeGeometry(0.07, 0.3, 5), armor, pa, [Math.cos(i * 1.6) * 0.25, 0.42, Math.sin(i * 1.6) * 0.25], [Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4]);
    
    mk(new THREE.CapsuleGeometry(0.28, 0.5, 6, 12), skin, sh, [0, -0.45, 0]); // bicep
    const el = rig.add('el' + side, joint(sh, [0, -0.88, 0]));
    mk(new THREE.SphereGeometry(0.26, 10, 8), skin, el);
    mk(new THREE.CapsuleGeometry(0.26, 0.45, 6, 12), skin, el, [0, -0.38, 0]);
    // orange bracer (flared) with plates
    mk(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 6), armor, el, [0, -0.45, 0.03], [0, 0.3, 0], [1, 1, 1.05]);
    for (let i = 0; i < 3; i++) mk(new THREE.ConeGeometry(0.06, 0.24, 4), darkArm, el, [0.36 * s, -0.3 - i * 0.16, -0.1], [0, 0, -1.3 * s]);
    mk(new THREE.BoxGeometry(0.1, 0.5, 0.45), armor, el, [0.32 * s, -0.42, 0], [0, 0, 0.2 * s]);
    const fi = rig.add('fi' + side, joint(el, [0, -0.86, 0]));
    mk(new THREE.SphereGeometry(0.27, 12, 10), skin, fi, [0, -0.08, 0.02], [0, 0, 0], [1.0, 1.1, 1.05]);
    for (let i = 0; i < 4; i++) mk(new THREE.SphereGeometry(0.075, 8, 6), skin, fi, [(i - 1.5) * 0.11, -0.22, 0.17]); // knuckles
    p2.push(tag('p2', mk(new THREE.SphereGeometry(0.58, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), plateMat, sh, [0.12 * s, 0.1, 0], [0, 0, -0.45 * s], [1.2, 1.0, 1.2])));
    p2.push(tag('p2', mk(new THREE.CylinderGeometry(0.38, 0.32, 0.6, 10), plateMat, el, [0, -0.45, 0.03])));
    return fi;
  };
  arm('L'); const fistR = arm('R');

  const leg = (side) => {
    const s = side === 'L' ? 1 : -1;
    const hp = rig.add('hip' + side, joint(hips, [0.45 * s, -0.08, 0]));
    mk(new THREE.CapsuleGeometry(0.34, 0.5, 6, 12), skin, hp, [0, -0.42, 0]);
    mk(new THREE.BoxGeometry(0.5, 0.5, 0.12), armor, hp, [0.06 * s, -0.25, 0.28], [-0.1, 0, 0]); // thigh plate
    const kn = rig.add('kn' + side, joint(hp, [0, -0.88, 0]));
    mk(new THREE.SphereGeometry(0.24, 6, 4), armor, kn, [0, 0.02, 0.2], [0, 0, 0], [1.2, 1, 0.8]); // knee plate
    mk(new THREE.CapsuleGeometry(0.25, 0.45, 6, 12), skin, kn, [0, -0.38, 0]);
    mk(new THREE.CylinderGeometry(0.31, 0.27, 0.55, 5, 1, false, -Math.PI / 2, Math.PI), armor, kn, [0, -0.42, 0.04], [0, Math.PI, 0]);
    mk(new THREE.BoxGeometry(0.42, 0.2, 0.62), skin, kn, [0, -0.83, 0.12]); // foot
    for (let i = 0; i < 3; i++) mk(new THREE.ConeGeometry(0.05, 0.14, 4), boneDark, kn, [(i - 1) * 0.12, -0.86, 0.45], [Math.PI / 2, 0, 0]);
    p2.push(tag('p2', mk(new THREE.BoxGeometry(0.55, 0.62, 0.14), plateMat, hp, [0.04 * s, -0.35, 0.3], [-0.1, 0, 0])));
    p2.push(tag('p2', mk(new THREE.CylinderGeometry(0.32, 0.29, 0.6, 10, 1, false, -Math.PI / 2, Math.PI), plateMat, kn, [0, -0.42, 0.05], [0, Math.PI, 0])));
  };
  leg('L'); leg('R');

  // tail (seen in the clip)
  let par = hips;
  for (let i = 0; i < 5; i++) {
    const tj = rig.add('tail' + i, joint(par, i === 0 ? [0, -0.1, -0.5] : [0, 0, -0.42]));
    tj.rotation.x = i === 0 ? 0.9 : 0.15; tj.userData.base = tj.rotation.clone();
    mk(new THREE.CylinderGeometry(0.16 - i * 0.03, 0.2 - i * 0.03, 0.46, 8), skin, tj, [0, 0, -0.21], [Math.PI / 2, 0, 0]);
    tj.userData.tag = 'p1'; p1.push(tj);
    par = tj;
  }

  // the blade he draws (phase 2 + finisher): grey steel with a pale-blue glowing edge
  const blade = joint(fistR, [0, -0.12, 0.05]);
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8e4f0, metalness: 0.95, roughness: 0.18, emissive: 0x6a8cff, emissiveIntensity: 0.6 });
  mk(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), darkArm, blade, [0, 0, 0], [Math.PI / 2, 0, 0]);
  mk(new THREE.BoxGeometry(0.5, 0.07, 0.09), plateDark, blade, [0, 0, 0.22]);
  const bg = new THREE.BoxGeometry(0.16, 0.03, 1.0); bg.translate(0, 0, 0.5);
  const bm = mk(bg, steel, blade, [0, 0, 0.25]);
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.8, 2.6), toneMapped: false });
  const eg = new THREE.BoxGeometry(0.02, 0.035, 0.98); eg.translate(0, 0, 0.5);
  mk(eg, edgeMat, blade, [0.08, 0, 0.26]);
  blade.visible = false;
  blade.userData.bladeMesh = bm;
  const bTipA = new THREE.Object3D(); bTipA.position.set(0, 0, 0.3); blade.add(bTipA);
  const bTipB = new THREE.Object3D(); bTipB.position.set(0, 0, 1.25); blade.add(bTipB);

  mergeRig(root);
  p1.length = 0; p2.length = 0;
  root.traverse((o) => { if (o.userData.tag === 'p1') p1.push(o); if (o.userData.tag === 'p2') p2.push(o); });
  p2.forEach(m => { m.visible = false; });
  function setPhase(n) {
    const two = n >= 2;
    p2.forEach(m => { m.visible = two; });
    p1.forEach(m => { m.visible = !two; });
    armor.map = two ? null : armorTex;
    armor.color.set(two ? 0x9a2a18 : 0xffffff);
    armor.metalness = two ? 0.6 : 0.35;
    skin.map = two ? null : skinTex;
    skin.color.set(two ? 0x3c4452 : 0xffffff);
    bone.color.set(two ? 0x7d8ea4 : 0xc9c7c2);
    armor.needsUpdate = true; skin.needsUpdate = true;
  }

  return { root, body, rig, eyeL, eyeMat, blade, bTipA, bTipB, fistR, setPhase, gem, head };
}

const BI = { hips: [0, 0, 0], spine: [0.35, 0, 0], chest: [0.12, 0, 0], neck: [-0.35, 0, 0], head: [-0.1, 0, 0],
  shL: [0.05, 0, 0.32], elL: [-0.45, 0, 0], shR: [0.05, 0, -0.32], elR: [-0.45, 0, 0],
  hipL: [-0.35, 0, 0.1], knL: [0.6, 0, 0], hipR: [-0.35, 0, -0.1], knR: [0.6, 0, 0], hy: -0.18 };
export const BIDLE = BI;
export const BA = {
  idle: { dur: 2.0, loop: true, keys: [[0, BI], [1.0, { ...BI, spine: [0.4, 0, 0], shL: [0.05, 0, 0.36], shR: [0.05, 0, -0.36], hy: -0.22 }], [2.0, BI]] },
  // windup -> slam both fists into the ground
  smash: { dur: 1.55, keys: [
    [0, BI],
    [0.7, { ...BI, spine: [-0.25, 0, 0], chest: [-0.2, 0, 0], neck: [-0.3, 0, 0], head: [-0.3, 0, 0], jaw: [0.35, 0, 0], shL: [-3.0, 0, 0.25], elL: [-0.6, 0, 0], shR: [-3.0, 0, -0.25], elR: [-0.6, 0, 0], hy: 0.05 }],
    [0.86, { ...BI, spine: [1.0, 0, 0], chest: [0.3, 0, 0], neck: [-0.7, 0, 0], shL: [-1.1, 0, 0.1], elL: [-0.1, 0, 0], shR: [-1.1, 0, -0.1], elR: [-0.1, 0, 0], hipL: [-0.9, 0, 0.15], knL: [1.3, 0, 0], hipR: [-0.9, 0, -0.15], knR: [1.3, 0, 0], hy: -0.62 }],
    [1.55, { ...BI, spine: [0.8, 0, 0], shL: [-0.7, 0, 0.2], shR: [-0.7, 0, -0.2], hipL: [-0.6, 0, 0.1], knL: [1.0, 0, 0], hipR: [-0.6, 0, -0.1], knR: [1.0, 0, 0], hy: -0.42 }]] },
  punchR: { dur: 0.95, keys: [
    [0, BI],
    [0.42, { ...BI, spine: [0.3, 0.7, 0], shR: [0.6, 0.3, -0.5], elR: [-1.8, 0, 0], shL: [-0.5, 0, 0.4], hipR: [0.2, 0, -0.1], hy: -0.25 }],
    [0.55, { ...BI, spine: [0.55, -0.55, 0], shR: [-1.55, -0.15, 0], elR: [-0.05, 0, 0], shL: [0.3, 0, 0.5], hipL: [-0.8, 0, 0.1], knL: [0.8, 0, 0], hipR: [0.3, 0, 0], hy: -0.3, hz: 0.4 }],
    [0.95, { ...BI, spine: [0.45, -0.3, 0], shR: [-1.0, 0, -0.1], elR: [-0.4, 0, 0], hz: 0.2 }]] },
  punchL: { dur: 0.85, keys: [
    [0, { ...BI, spine: [0.45, -0.3, 0], shR: [-1.0, 0, -0.1] }],
    [0.32, { ...BI, spine: [0.3, -0.7, 0], shL: [0.6, -0.3, 0.5], elL: [-1.8, 0, 0], shR: [-0.5, 0, -0.4], hy: -0.25 }],
    [0.45, { ...BI, spine: [0.55, 0.55, 0], shL: [-1.55, 0.15, 0], elL: [-0.05, 0, 0], shR: [0.3, 0, -0.5], hipR: [-0.8, 0, -0.1], knR: [0.8, 0, 0], hipL: [0.3, 0, 0], hy: -0.3, hz: 0.4 }],
    [0.85, { ...BI, spine: [0.45, 0.2, 0], shL: [-0.9, 0, 0.1], hz: 0.1 }]] },
  // uppercut finisher of the punch combo
  upper: { dur: 1.0, keys: [
    [0, BI],
    [0.45, { ...BI, spine: [0.8, 0.4, 0], shR: [0.5, 0, -0.3], elR: [-1.4, 0, 0], hipL: [-0.7, 0, 0.1], knL: [1.2, 0, 0], hipR: [-0.4, 0, -0.1], knR: [1.2, 0, 0], hy: -0.6 }],
    [0.6, { ...BI, spine: [-0.15, -0.3, 0], shR: [-2.7, 0, -0.2], elR: [-0.9, 0, 0], neck: [-0.6, 0, 0], hipL: [-0.2, 0, 0], knL: [0.2, 0, 0], hy: 0.1, hz: 0.5 }],
    [1.0, { ...BI, spine: [0.3, 0, 0], shR: [-1.2, 0, -0.2] }]] },
  charge: { dur: 0.6, loop: true, keys: [
    [0, { ...BI, spine: [0.95, 0, 0], neck: [-0.9, 0, 0], shL: [0.7, 0, 0.35], shR: [-0.8, 0, -0.35], elL: [-0.5, 0, 0], elR: [-0.8, 0, 0], hipL: [-1.1, 0, 0.1], knL: [0.6, 0, 0], hipR: [0.5, 0, -0.1], knR: [1.3, 0, 0], hy: -0.32 }],
    [0.3, { ...BI, spine: [0.95, 0, 0], neck: [-0.9, 0, 0], shL: [-0.8, 0, 0.35], shR: [0.7, 0, -0.35], elL: [-0.8, 0, 0], elR: [-0.5, 0, 0], hipL: [0.5, 0, 0.1], knL: [1.3, 0, 0], hipR: [-1.1, 0, -0.1], knR: [0.6, 0, 0], hy: -0.32 }],
    [0.6, { ...BI, spine: [0.95, 0, 0], neck: [-0.9, 0, 0], shL: [0.7, 0, 0.35], shR: [-0.8, 0, -0.35], elL: [-0.5, 0, 0], elR: [-0.8, 0, 0], hipL: [-1.1, 0, 0.1], knL: [0.6, 0, 0], hipR: [0.5, 0, -0.1], knR: [1.3, 0, 0], hy: -0.32 }]] },
  chargeWind: { dur: 0.6, keys: [[0, BI], [0.6, { ...BI, spine: [0.9, 0, 0], neck: [-0.9, 0, 0], jaw: [0.3, 0, 0], shL: [0.9, 0, 0.5], shR: [0.9, 0, -0.5], hipL: [-0.9, 0, 0.15], knL: [1.4, 0, 0], hipR: [0.2, 0, -0.15], knR: [1.4, 0, 0], hy: -0.62 }]] },
  roar: { dur: 0.8, keys: [[0, BI], [0.8, { ...BI, spine: [-0.15, 0, 0], chest: [-0.25, 0, 0], neck: [-0.25, 0, 0], head: [-0.55, 0, 0], jaw: [0.55, 0, 0], shL: [-0.25, 0, 1.05], elL: [-1.2, 0.0, 0], shR: [-0.25, 0, -1.05], elR: [-1.2, 0, 0], hipL: [-0.1, 0, 0.25], hipR: [-0.1, 0, -0.25], knL: [0.25, 0, 0], knR: [0.25, 0, 0], hy: -0.08 }]] },
  stagger: { dur: 1.1, keys: [[0, { ...BI, spine: [-0.35, 0.2, 0], head: [-0.5, 0, 0], jaw: [0.3, 0, 0], shL: [-0.4, 0, 0.9], shR: [-0.4, 0, -0.9], hy: -0.05, hz: -0.3 }], [0.5, { ...BI, spine: [0.7, 0, 0], shL: [0.2, 0, 0.4], shR: [0.2, 0, -0.4], hipL: [-0.7, 0, 0], knL: [1.2, 0, 0], hipR: [-0.6, 0, 0], knR: [1.2, 0, 0], hy: -0.55 }], [1.1, BI]] },
  hit: { dur: 0.3, keys: [[0, { ...BI, spine: [0.1, 0.25, 0], head: [-0.35, 0.3, 0], hy: -0.1 }], [0.3, BI]] },
  // phase 2: two-handed blade swing (overhead diagonal) and a horizontal sweep
  sword1: { dur: 1.15, keys: [
    [0, BI],
    [0.55, { ...BI, spine: [-0.1, 0.6, 0], shR: [-2.9, 0.4, -0.3], elR: [-0.8, 0, 0], fiR: [0.6, 0, 0], shL: [-2.4, 0.4, 0.4], elL: [-1.0, 0, 0], head: [-0.2, 0, 0], hy: 0 }],
    [0.72, { ...BI, spine: [0.85, -0.5, 0], shR: [-0.9, -0.3, -0.2], elR: [-0.1, 0, 0], fiR: [1.5, 0, 0], shL: [-0.7, -0.2, 0.3], elL: [-0.6, 0, 0], hipL: [-0.9, 0, 0.1], knL: [1.1, 0, 0], hy: -0.45, hz: 0.6 }],
    [1.15, { ...BI, spine: [0.6, -0.3, 0], shR: [-0.8, 0, -0.2], fiR: [1.4, 0, 0], hy: -0.3, hz: 0.3 }]] },
  sword2: { dur: 1.0, keys: [
    [0, { ...BI, shR: [-0.8, 0, -0.2], fiR: [1.4, 0, 0] }],
    [0.45, { ...BI, spine: [0.3, -0.9, 0], shR: [-1.5, -1.6, 0], elR: [-0.4, 0, 0], fiR: [1.6, 0, 0], hy: -0.25 }],
    [0.6, { ...BI, spine: [0.4, 0.9, 0], shR: [-1.5, 1.4, 0], elR: [0, 0, 0], fiR: [1.6, 0, 0], shL: [-0.4, 0, 0.9], hy: -0.35, hz: 0.4 }],
    [1.0, { ...BI, spine: [0.35, 0.5, 0], shR: [-1.2, 0.9, 0], fiR: [1.5, 0, 0], hy: -0.2 }]] },
  // leaping slam (phase 2)
  leap: { dur: 1.6, keys: [
    [0, BI],
    [0.45, { ...BI, spine: [0.9, 0, 0], shL: [0.8, 0, 0.4], shR: [0.8, 0, -0.4], hipL: [-1.1, 0, 0.1], knL: [1.6, 0, 0], hipR: [-1.1, 0, -0.1], knR: [1.6, 0, 0], hy: -0.7 }],
    [0.75, { ...BI, spine: [-0.3, 0, 0], shL: [-3.0, 0, 0.3], shR: [-3.0, 0, -0.3], elL: [-0.5, 0, 0], elR: [-0.5, 0, 0], hipL: [-0.9, 0, 0], knL: [1.4, 0, 0], hipR: [-0.2, 0, 0], knR: [1.2, 0, 0], hy: 0 }],
    [1.0, { ...BI, spine: [1.0, 0, 0], shL: [-1.0, 0, 0.1], shR: [-1.0, 0, -0.1], hipL: [-1.0, 0, 0.15], knL: [1.4, 0, 0], hipR: [-1.0, 0, -0.15], knR: [1.4, 0, 0], hy: -0.7 }],
    [1.6, { ...BI, spine: [0.7, 0, 0], shL: [-0.6, 0, 0.2], shR: [-0.6, 0, -0.2], hy: -0.4 }]] },
  // finisher (from the clip): parry, draw blade, raise, stab down at the kneeling knight
  draw: { dur: 0.7, keys: [[0, BI], [0.35, { ...BI, spine: [0.3, 0.4, 0], shR: [0.4, 0.3, -0.2], elR: [-1.6, 0, 0], fiR: [0.2, 0, 0] }], [0.7, { ...BI, spine: [0.25, 0, 0], shR: [-1.2, 0.3, -0.25], elR: [-0.7, 0, 0], fiR: [1.2, 0, 0] }]] },
  raise: { dur: 0.6, keys: [[0, { ...BI, spine: [0.25, 0, 0], shR: [-1.2, 0.3, -0.25], elR: [-0.7, 0, 0], fiR: [1.2, 0, 0] }], [0.6, { ...BI, spine: [-0.2, 0.2, 0], head: [0.1, 0, 0], shR: [-2.9, 0.2, -0.2], elR: [-0.5, 0, 0], fiR: [2.2, 0, 0], shL: [-0.6, 0, 0.6] }]] },
  stab: { dur: 0.45, keys: [[0, { ...BI, spine: [-0.2, 0.2, 0], shR: [-2.9, 0.2, -0.2], elR: [-0.5, 0, 0], fiR: [2.2, 0, 0], shL: [-0.6, 0, 0.6] }], [0.16, { ...BI, spine: [1.0, 0, 0], head: [0.3, 0, 0], shR: [-1.2, 0.1, -0.1], elR: [0, 0, 0], fiR: [2.5, 0, 0], shL: [-0.3, 0, 0.7], hipL: [-0.9, 0, 0.1], knL: [1.2, 0, 0], hipR: [-0.5, 0, -0.1], knR: [1.4, 0, 0], hy: -0.7 }], [0.45, { ...BI, spine: [0.95, 0, 0], shR: [-1.1, 0.1, -0.1], fiR: [2.5, 0, 0], hipL: [-0.9, 0, 0.1], knL: [1.2, 0, 0], hipR: [-0.5, 0, -0.1], knR: [1.4, 0, 0], hy: -0.68 }]] },
  kneel: { dur: 0.9, keys: [[0, { ...BI, spine: [-0.35, 0, 0], head: [-0.5, 0, 0], shL: [-0.3, 0, 0.8], shR: [-0.3, 0, -0.8] }], [0.9, { ...BI, spine: [0.55, 0, 0], head: [0.4, 0, 0], neck: [0, 0, 0], shL: [0.2, 0, 0.3], shR: [0.2, 0, -0.3], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0], hipL: [-1.5, 0, 0.1], knL: [1.6, 0, 0], hipR: [0.1, 0, -0.1], knR: [2.2, 0, 0], hy: -0.95 }]] },
  walk: null,
};
export function bossWalk(ph, amt) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    ...BI,
    hipL: [-0.35 - s * 0.55 * amt, 0, 0.1], hipR: [-0.35 + s * 0.55 * amt, 0, -0.1],
    knL: [0.6 + Math.max(0, c) * 0.7 * amt, 0, 0], knR: [0.6 + Math.max(0, -c) * 0.7 * amt, 0, 0],
    shL: [0.05 + s * 0.35 * amt, 0, 0.32], shR: [0.05 - s * 0.35 * amt, 0, -0.32],
    spine: [0.4, s * 0.12 * amt, -s * 0.06 * amt], hy: -0.2 - Math.abs(c) * 0.1 * amt,
  };
}
