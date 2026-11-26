// Cavern arena scenery built from Three.js geometry + procedural canvas textures.
// Matches John's clip: round engraved stone platform, balustrade, purple/teal crystals,
// glowing mushrooms, waterfalls, lit castle town, starry sky with teal magic ribbons,
// a light shaft from above, mist and floating motes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ARENA_R = 12.6;      // playable radius
const RAIL_R = 14.4;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const R = rng(1337);
const rr = (a, b) => a + (b - a) * R();

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function softTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.45)')); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

export function cloudTex() {
  return canvasTex(256, 256, (g, w) => {
    for (let i = 0; i < 40; i++) {
      const x = w / 2 + rr(-60, 60), y = w / 2 + rr(-50, 50), r = rr(30, 70);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }
  });
}

function floorTex() {
  return canvasTex(2048, 2048, (g, w) => {
    g.fillStyle = '#2c2f36'; g.fillRect(0, 0, w, w);
    // flagstones in polar rings (looks like the round platform in the clip)
    const cx = w / 2, cy = w / 2;
    const rings = 14;
    for (let ri = 0; ri < rings; ri++) {
      const r0 = (ri / rings) * w * 0.5, r1 = ((ri + 1) / rings) * w * 0.5;
      const n = Math.max(6, Math.floor(ri * 6.5));
      const off = R() * Math.PI * 2;
      for (let k = 0; k < n; k++) {
        const a0 = off + (k / n) * Math.PI * 2 + rr(-0.02, 0.02), a1 = off + ((k + 1) / n) * Math.PI * 2;
        const v = Math.floor(rr(48, 78));
        g.fillStyle = `rgb(${v},${v + 3},${v + 9})`;
        g.beginPath();
        g.arc(cx, cy, r1 - 5, a0 + 0.006, a1 - 0.006);
        g.arc(cx, cy, Math.max(0, r0 + 5), a1 - 0.006, a0 + 0.006, true);
        g.closePath(); g.fill();
        // speckle + cracks
        for (let s = 0; s < 10; s++) {
          const a = rr(a0, a1), rad = rr(r0, r1);
          g.fillStyle = `rgba(${R() < 0.5 ? '20,22,28' : '120,125,135'},${rr(0.08, 0.25)})`;
          g.beginPath(); g.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, rr(2, 10), 0, 7); g.fill();
        }
        if (R() < 0.3) {
          g.strokeStyle = 'rgba(10,10,14,0.55)'; g.lineWidth = 2; g.beginPath();
          let a = rr(a0, a1), rad = rr(r0, r1); g.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
          for (let q = 0; q < 4; q++) { a += rr(-0.04, 0.04); rad += rr(-25, 25); g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
          g.stroke();
        }
        if (R() < 0.18) { // moss
          const a = rr(a0, a1), rad = rr(r0, r1);
          const gr = g.createRadialGradient(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 0, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 40);
          gr.addColorStop(0, 'rgba(60,90,50,0.45)'); gr.addColorStop(1, 'rgba(60,90,50,0)');
          g.fillStyle = gr; g.fillRect(0, 0, w, w);
        }
      }
    }
    // engraved circle with runes (the big carved ring in the clip)
    const ring = (r, lw, col) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); };
    for (const [r, lw] of [[w * 0.40, 16], [w * 0.355, 10], [w * 0.2, 12], [w * 0.17, 6], [w * 0.06, 8]]) {
      ring(r, lw + 6, 'rgba(150,160,175,0.18)'); ring(r, lw, 'rgba(12,13,18,0.85)');
    }
    g.font = 'bold 54px serif'; g.fillStyle = 'rgba(12,13,18,0.8)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2, r = w * 0.378;
      g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a + Math.PI / 2);
      g.fillText(runes[i % runes.length], 0, 0); g.restore();
    }
    for (let i = 0; i < 8; i++) { // spokes between inner rings
      const a = (i / 8) * Math.PI * 2;
      g.strokeStyle = 'rgba(12,13,18,0.8)'; g.lineWidth = 8; g.beginPath();
      g.moveTo(cx + Math.cos(a) * w * 0.06, cy + Math.sin(a) * w * 0.06); g.lineTo(cx + Math.cos(a) * w * 0.17, cy + Math.sin(a) * w * 0.17); g.stroke();
    }
  });
}

function windowTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 8) { g.fillStyle = `rgba(0,0,0,${rr(0.05, 0.2)})`; g.fillRect(0, y, w, 2); }
    for (let i = 0; i < 18; i++) {
      const x = rr(10, w - 30), y = rr(10, w - 40);
      g.fillStyle = '#ffb04a'; g.fillRect(x, y, 12, 20); g.beginPath(); g.arc(x + 6, y, 6, Math.PI, 0); g.fill();
    }
  });
}
function windowEmissive() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
  });
}

function rockGeo(r, detail = 1, squash = 1) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = 1 + (Math.sin(v.x * 3.1 + v.y * 1.7) * 0.12 + Math.sin(v.z * 2.3 - v.y * 2.9) * 0.1 + rr(-0.1, 0.1));
    v.multiplyScalar(n); v.y *= squash; p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function ribbonMaterial(color, speed = 0.25, alpha = 0.8) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { t: { value: 0 }, col: { value: new THREE.Color(color) }, sp: { value: speed }, a: { value: alpha } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform float t; uniform vec3 col; uniform float sp; uniform float a;
      void main(){
        float u=vUv.x; float edge = 1.0-abs(vUv.y-0.5)*2.0; edge = pow(max(edge,0.0), 2.5);
        float flow = 0.55+0.45*sin(u*28.0 - t*sp*20.0) * sin(u*9.0 + t*sp*7.0);
        float ends = smoothstep(0.0,0.12,u)*smoothstep(1.0,0.85,u);
        gl_FragColor = vec4(col*(0.6+flow*1.4), edge*flow*ends*a);
      }`,
  });
}
export { ribbonMaterial };

// Merge static meshes that share a material into one draw call each (big win on phones / software GL).
function mergeStatic(scene, startIdx) {
  const groups = new Map();
  const victims = [];
  scene.updateMatrixWorld(true);
  const list = scene.children.slice(startIdx);
  for (const top of list) {
    top.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
      const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(o.matrixWorld);
      if (!groups.has(key)) groups.set(key, { mat: o.material, geos: [], cast: o.castShadow, recv: o.receiveShadow });
      groups.get(key).geos.push(g);
      victims.push(o);
    });
  }
  for (const o of victims) o.parent.remove(o);
  for (const { mat, geos, cast, recv } of groups.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.castShadow = cast; m.receiveShadow = recv; m.matrixAutoUpdate = false;
    scene.add(m);
  }
  return groups.size;
}

export function buildWorld(scene, renderer) {
  const startIdx = scene.children.length;
  const upd = [];
  const world = { update(t, dt) { for (const f of upd) f(t, dt); }, lights: [] };

  // --- Sky dome: dark navy with stars + purple/teal nebula ---------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vP; uniform float t;
      float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.1; a*=0.5;} return s; }
      void main(){
        vec3 d=normalize(vP); float y=d.y;
        vec3 col=mix(vec3(0.02,0.035,0.075), vec3(0.03,0.05,0.12), smoothstep(-0.1,0.5,y));
        float neb=fbm(d*3.0+vec3(0.0,0.0,t*0.01));
        float neb2=fbm(d*5.0+vec3(3.0,1.0,-t*0.012));
        col+=vec3(0.30,0.12,0.45)*pow(neb,5.0)*1.5*smoothstep(0.0,0.4,y);
        col+=vec3(0.05,0.35,0.35)*pow(neb2,6.0)*1.6*smoothstep(0.05,0.5,y);
        vec3 sp=d*420.0; float s=h(floor(sp)); float tw=0.6+0.4*sin(t*2.0+s*50.0);
        col+=vec3(0.85,0.9,1.0)*step(0.9965,s)*tw*smoothstep(0.0,0.2,y)*1.4;
        vec3 sp2=d*160.0; float s2=h(floor(sp2)+7.0); col+=vec3(0.7,0.8,1.0)*step(0.999,s2)*2.0*smoothstep(0.0,0.2,y);
        gl_FragColor=vec4(col,1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat);
  scene.add(sky);
  upd.push((t) => { skyMat.uniforms.t.value = t; });

  // --- Teal magic ribbons swirling in the sky --------------------------------------
  const ribbons = [];
  for (let i = 0; i < 7; i++) {
    const pts = [];
    const baseA = rr(-1.2, 1.2) + (i % 2 ? Math.PI : 0) * 0.15, baseY = rr(45, 110), dist = rr(110, 200);
    for (let k = 0; k < 7; k++) {
      const a = baseA + (k - 3) * rr(0.13, 0.22);
      pts.push(new THREE.Vector3(Math.sin(a) * dist, baseY + Math.sin(k * 1.3 + i) * rr(8, 20), -Math.cos(a) * dist + rr(-15, 15)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mat = ribbonMaterial(i % 3 === 2 ? 0x7d6cff : 0x35e6d0, rr(0.15, 0.3), rr(0.35, 0.7));
    const geo = new THREE.TubeGeometry(curve, 80, rr(1.2, 3.2), 6, false);
    // flatten tube into a ribbon look: scale normals side
    const m = new THREE.Mesh(geo, mat);
    m.scale.y = 0.6;
    scene.add(m); ribbons.push(m);
    // ribbons all around (also behind camera start)
    if (i < 4) { const m2 = m.clone(); m2.material = mat; m2.rotation.y = Math.PI * rr(0.6, 1.4); scene.add(m2); }
    upd.push((t) => { mat.uniforms.t.value = t + i * 3.1; });
  }

  // --- Lighting ------------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x7e9cff, 0x1a1420, 0.9));
  const moon = new THREE.DirectionalLight(0xb8d0ff, 1.6);
  moon.position.set(-10, 30, -18);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const sc = moon.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 5; sc.far = 70;
  moon.shadow.bias = -0.0008; moon.shadow.normalBias = 0.03;
  scene.add(moon); scene.add(moon.target);
  const front = new THREE.DirectionalLight(0xffd9b0, 0.55); front.position.set(8, 12, 22); scene.add(front);
  const warm = new THREE.PointLight(0xff9a40, 60, 60, 1.6); warm.position.set(-26, 10, -40); scene.add(warm);

  // --- Round stone platform --------------------------------------------------------
  const fTex = floorTex();
  const floorMat = new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.88, metalness: 0.05, bumpMap: fTex, bumpScale: 2.2 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(RAIL_R + 0.6, 96), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  world.floor = floor;
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.9, flatShading: true });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_R + 0.9, RAIL_R + 0.2, 3.2, 64, 1, true), rimMat);
  rim.position.y = -1.6; scene.add(rim);
  // dark under-ledge so the platform reads as a high balcony
  const under = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_R + 0.2, RAIL_R - 3, 26, 40), new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 1, flatShading: true }));
  under.position.y = -16; scene.add(under);

  // --- Balustrade (stone railing ring) -----------------------------------------------
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5d6068, roughness: 0.85, flatShading: false });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x45484f, roughness: 0.9 });
  const lathe = new THREE.LatheGeometry([
    [0.0, 0], [0.13, 0], [0.13, 0.06], [0.08, 0.1], [0.07, 0.2], [0.13, 0.38], [0.12, 0.52], [0.06, 0.62], [0.06, 0.7], [0.12, 0.74], [0.12, 0.8], [0, 0.8],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 10);
  const balCount = 150;
  const bal = new THREE.InstancedMesh(lathe, stoneMat, balCount);
  const dummy = new THREE.Object3D();
  let bi = 0;
  const posts = 20;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const p = new THREE.Group();
    p.position.set(Math.cos(a) * RAIL_R, 0, Math.sin(a) * RAIL_R); p.rotation.y = -a;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.25, 0.75), stoneDark); base.position.y = 0.12; p.add(base);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 0.55), stoneMat); col.position.y = 0.75; p.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.72), stoneDark); cap.position.y = 1.32; p.add(cap);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.32, 8), stoneMat); knob.position.y = 1.55; p.add(knob);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), stoneMat); ball.position.y = 1.78; p.add(ball);
    p.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(p);
    // rail + balusters to next post
    const a2 = ((i + 1) / posts) * Math.PI * 2, am = (a + a2) / 2;
    const chord = 2 * RAIL_R * Math.sin(Math.PI / posts) - 0.55;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(chord, 0.14, 0.42), stoneDark);
    rail.position.set(Math.cos(am) * RAIL_R * Math.cos(Math.PI / posts), 1.02, Math.sin(am) * RAIL_R * Math.cos(Math.PI / posts));
    rail.rotation.y = -am + Math.PI / 2; rail.castShadow = true; scene.add(rail);
    const bottom = rail.clone(); bottom.position.y = 0.08; scene.add(bottom);
    const per = 7;
    for (let k = 1; k <= per && bi < balCount; k++) {
      const f = k / (per + 1);
      const pa = new THREE.Vector3(Math.cos(a) * RAIL_R, 0, Math.sin(a) * RAIL_R), pb = new THREE.Vector3(Math.cos(a2) * RAIL_R, 0, Math.sin(a2) * RAIL_R);
      const pp = pa.lerp(pb, f);
      dummy.position.set(pp.x, 0.15, pp.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1.08, 1); dummy.updateMatrix();
      bal.setMatrixAt(bi++, dummy.matrix);
    }
  }
  bal.count = bi; bal.castShadow = true; scene.add(bal);

  // --- Crystals + mushrooms ---------------------------------------------------------
  const crystalMats = {
    purple: new THREE.MeshStandardMaterial({ color: 0x8a5cff, emissive: 0x7a3cff, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x6ff7ff, emissive: 0x1fd6e0, emissiveIntensity: 1.5, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }),
  };
  const crystalGeo = new THREE.CylinderGeometry(0, 1, 1, 6, 1); // point up, scaled later
  crystalGeo.translate(0, 0.5, 0);
  const crystalBase = new THREE.CylinderGeometry(1, 0.85, 0.35, 6); crystalBase.translate(0, -0.17, 0);
  const crystalGeoFull = (() => { const g = new THREE.CylinderGeometry(0.0, 0.22, 1, 6); g.translate(0, 0.5, 0); return g; })();
  function crystalCluster(kind, x, y, z, s = 1, light = false) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const n = 5 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(crystalGeoFull, crystalMats[kind]);
      const h = rr(0.6, 1.9) * s * (i === 0 ? 1.4 : 1);
      m.scale.set(s * rr(0.8, 1.4), h, s * rr(0.8, 1.4));
      m.rotation.set(rr(-0.6, 0.6), rr(0, 6), rr(-0.6, 0.6));
      if (i === 0) m.rotation.set(rr(-0.1, 0.1), 0, rr(-0.1, 0.1));
      m.position.set(rr(-0.3, 0.3) * s, 0, rr(-0.3, 0.3) * s);
      g.add(m);
    }
    scene.add(g);
    if (light) { const l = new THREE.PointLight(kind === 'purple' ? 0x9a5cff : 0x2fe8e0, 18 * s, 10 * s, 1.8); l.position.set(x, y + 1.2 * s, z); scene.add(l); world.lights.push(l); }
    return g;
  }
  const capMat = new THREE.MeshStandardMaterial({ color: 0x8a60d8, emissive: 0x6a2fd0, emissiveIntensity: 1.1, roughness: 0.5 });
  const capUnder = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.7, 2.2), toneMapped: false });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xc8c0d8, emissive: 0x302048, roughness: 0.7 });
  function mushroom(x, y, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); g.rotation.z = rr(-0.15, 0.15);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 8), stemMat); stem.position.y = 0.6; g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat); cap.scale.y = 0.55; cap.position.y = 1.15; g.add(cap);
    const und = new THREE.Mesh(new THREE.CircleGeometry(0.58, 16), capUnder); und.rotation.x = Math.PI / 2; und.position.y = 1.15; g.add(und);
    scene.add(g); return g;
  }
  // around the arena, just outside the railing (like the clip's foreground framing)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rr(-0.15, 0.15), r = RAIL_R + rr(1.2, 3.5);
    crystalCluster(i % 3 === 0 ? 'teal' : 'purple', Math.cos(a) * r, rr(-0.4, 0.2), Math.sin(a) * r, rr(0.8, 1.6), i % 3 === 1);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, r = RAIL_R + rr(2.2, 5);
    mushroom(Math.cos(a) * r, rr(-0.6, 0.1), Math.sin(a) * r, rr(0.9, 2.1));
  }
  // small crystals right at the rail inside edge (purple clusters at post bases)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    crystalCluster('purple', Math.cos(a) * (RAIL_R - 0.6), 0, Math.sin(a) * (RAIL_R - 0.6), 0.45);
  }

  // --- Cavern walls, cliffs, stalactites -----------------------------------------------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.95, flatShading: true });
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 1, flatShading: true });
  // ring of tall cave pillars/walls; lower in the -z "vista" direction
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rr(-0.05, 0.05);
    const toVista = Math.max(0, -Math.cos(a - Math.PI)); // 1 toward +z? we want vista at -z
    const vista = Math.max(0, Math.cos(a + Math.PI / 2)); // a = -PI/2 -> -z direction -> 1
    const r = rr(48, 66) + vista * 30;
    const h = rr(40, 90) * (1 - vista * 0.75) + 6;
    const m = new THREE.Mesh(rockGeo(1, 1, 1), R() < 0.5 ? rockMat : rockMat2);
    m.scale.set(rr(7, 13), h, rr(7, 13));
    m.position.set(Math.cos(a) * r, h * 0.35 - 12, Math.sin(a) * r);
    m.rotation.y = rr(0, 6);
    scene.add(m);
    void toVista;
  }
  // overhanging ceiling shards / stalactites on the sides and back
  const stalGeo = new THREE.ConeGeometry(1, 1, 6); stalGeo.rotateX(Math.PI);
  for (let i = 0; i < 40; i++) {
    const a = rr(0, Math.PI * 2);
    const vista = Math.max(0, Math.cos(a + Math.PI / 2));
    if (vista > 0.55) continue;
    const r = rr(30, 60);
    const m = new THREE.Mesh(stalGeo, rockMat2);
    const h = rr(10, 34);
    m.scale.set(rr(1.5, 4), h, rr(1.5, 4));
    m.position.set(Math.cos(a) * r, rr(38, 55) - h * 0.5 + 20, Math.sin(a) * r);
    scene.add(m);
  }
  // mid-distance cliffs + spires in the vista (behind the boss start)
  for (let i = 0; i < 16; i++) {
    const x = rr(-60, 60), z = rr(-90, -32);
    if (Math.abs(x) < 10 && z > -45) continue;
    const m = new THREE.Mesh(rockGeo(1, 1), rockMat);
    const h = rr(8, 30);
    m.scale.set(rr(2, 5), h, rr(2, 5));
    m.position.set(x, -14 + h * 0.6, z);
    scene.add(m);
    if (R() < 0.5) crystalCluster(R() < 0.5 ? 'teal' : 'purple', x + rr(-1, 1), -14 + h * 1.2, z, rr(0.8, 1.8));
  }
  // far rock spires silhouettes
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(rr(3, 7), rr(30, 70), 6), rockMat2);
    m.position.set(rr(-110, 110), rr(-6, 6), rr(-160, -110));
    scene.add(m);
  }

  // --- Lit castle / town on the cliffs (left of the vista, like the clip) ---------------
  const wallTex = windowTex();
  const winEm = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
  });
  void winEm;
  const townMat = new THREE.MeshStandardMaterial({ map: wallTex, emissiveMap: wallTex, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.9 });
  // emissive only from the orange windows: build a mask texture
  const winMask = canvasTex(256, 256, (g, w) => {
    const src = wallTex.image.getContext('2d').getImageData(0, 0, w, w); const d = src.data;
    for (let i = 0; i < d.length; i += 4) { const on = d[i] > 200 && d[i + 1] > 120; d[i] = on ? 255 : 0; d[i + 1] = on ? 160 : 0; d[i + 2] = on ? 70 : 0; d[i + 3] = 255; }
    g.putImageData(src, 0, 0);
  });
  townMat.emissiveMap = winMask; townMat.emissiveIntensity = 2.4;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2a33, roughness: 0.8 });
  const town = new THREE.Group();
  const cliff = new THREE.Mesh(rockGeo(1, 2, 1), rockMat); cliff.scale.set(26, 26, 18); cliff.position.set(0, -18, 0); town.add(cliff);
  for (let i = 0; i < 26; i++) {
    const w = rr(2.5, 5), h = rr(3, 9), d = rr(2.5, 5);
    const bx = rr(-16, 16), bz = rr(-10, 6);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), townMat);
    b.position.set(bx, 4 + h / 2 + rr(-1, 2) - Math.abs(bx) * 0.15, bz); town.add(b);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, rr(2, 4), 4), roofMat);
    roof.position.set(bx, b.position.y + h / 2 + 1, bz); roof.rotation.y = Math.PI / 4; town.add(roof);
  }
  for (let i = 0; i < 6; i++) {
    const tx = rr(-12, 12), tz = rr(-8, 2), th = rr(12, 22);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, th, 10), townMat); tw.position.set(tx, 4 + th / 2, tz); town.add(tw);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 10), roofMat); cone.position.set(tx, 4 + th + 3, tz); town.add(cone);
  }
  town.position.set(-38, 2, -70); town.rotation.y = 0.5; scene.add(town);
  const town2 = town.clone(); town2.position.set(46, -4, -96); town2.scale.setScalar(0.8); town2.rotation.y = -0.6; scene.add(town2);
  // stone aqueduct/bridge with arches across the vista
  const bridge = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.6, 14, 2.2), stoneDark); pier.position.set(i * 5 - 20, -4, 0); bridge.add(pier);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.6, 6, 12, Math.PI), stoneDark); arch.position.set(i * 5 - 17.5, 3, 0); bridge.add(arch);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 2.4), stoneDark); deck.position.set(0, 4.8, 0); bridge.add(deck);
  bridge.position.set(-6, -2, -58); bridge.rotation.y = 0.15; scene.add(bridge);

  // --- Waterfalls -------------------------------------------------------------------
  const fallMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform float t;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        float x=vUv.x; float col=floor(x*28.0);
        float s=h(vec2(col,1.0));
        float streak=0.55+0.45*sin((vUv.y*6.0 + t*(1.4+s)) * 6.2831 + s*20.0);
        float edge=smoothstep(0.0,0.18,x)*smoothstep(1.0,0.82,x);
        float a=edge*(0.35+0.5*streak)*smoothstep(0.0,0.1,vUv.y);
        gl_FragColor=vec4(vec3(0.5,0.75,1.0)*(0.6+streak*0.6), a*0.55);
      }`,
  });
  upd.push((t) => { fallMat.uniforms.t.value = t; });
  const mist = cloudTex();
  const falls = [[-14, 6, -46, 3.2, 22], [6, 4, -52, 4.5, 26], [20, 8, -60, 3, 24], [-28, 6, -58, 2.4, 18], [34, 2, -40, 2.6, 16]];
  for (const [x, y, z, w, h] of falls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), fallMat);
    m.position.set(x, y - h / 2 + 6, z); m.lookAt(0, m.position.y, 0); scene.add(m);
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mist, color: 0xa8c8ff, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
      sp.position.set(x + rr(-2, 2), y - h + 6 + rr(0, 2), z + rr(-1, 1)); sp.scale.setScalar(w * 3 + rr(0, 4)); scene.add(sp);
    }
    const rock = new THREE.Mesh(rockGeo(1, 1), rockMat); rock.scale.set(w * 1.8, 5, 4); rock.position.set(x, y + 7, z - 1); scene.add(rock);
  }

  // --- Light shaft from the cave opening ------------------------------------------------
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { t: { value: 0 }, a: { value: 0.06 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform float t; uniform float a;
      void main(){ float v=vUv.y; float rays=0.6+0.4*sin(vUv.x*60.0+t*0.4)*sin(vUv.x*23.0-t*0.3);
        gl_FragColor=vec4(vec3(0.75,0.88,1.0), a*rays*smoothstep(0.0,0.35,v)*smoothstep(1.0,0.6,v)); }`,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 9.5, 46, 32, 1, true), shaftMat);
  shaft.position.set(0, 23, -2); scene.add(shaft);
  world.shaft = shaft; world.shaftMat = shaftMat;
  upd.push((t) => { shaftMat.uniforms.t.value = t; });

  // --- Ground mist + drifting motes ------------------------------------------------------
  const fogSprites = [];
  for (let i = 0; i < 18; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mist, color: 0x6d7fa0, transparent: true, opacity: 0.13, depthWrite: false }));
    const a = rr(0, Math.PI * 2), r = rr(RAIL_R + 1, RAIL_R + 14);
    sp.position.set(Math.cos(a) * r, rr(0, 2.5), Math.sin(a) * r); sp.scale.set(rr(10, 18), rr(4, 7), 1);
    sp.userData = { a, r, s: rr(0.01, 0.03) }; scene.add(sp); fogSprites.push(sp);
  }
  upd.push((t, dt) => { for (const s of fogSprites) { s.userData.a += s.userData.s * dt; s.position.x = Math.cos(s.userData.a) * s.userData.r; s.position.z = Math.sin(s.userData.a) * s.userData.r; } });

  const N = 420;
  const mg = new THREE.BufferGeometry();
  const mp = new Float32Array(N * 3), mc = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    mp[i * 3] = rr(-40, 40); mp[i * 3 + 1] = rr(0, 26); mp[i * 3 + 2] = rr(-50, 30); seeds[i] = R() * 100;
    const c = R() < 0.65 ? [0.3, 1.0, 0.9] : [0.75, 0.5, 1.0]; mc.set(c, i * 3);
  }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('color', new THREE.BufferAttribute(mc, 3));
  const dotTex = softTex();
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.28, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);
  upd.push((t, dt) => {
    for (let i = 0; i < N; i++) {
      mp[i * 3 + 1] += dt * (0.25 + (seeds[i] % 1) * 0.4);
      mp[i * 3] += Math.sin(t * 0.5 + seeds[i]) * dt * 0.3;
      if (mp[i * 3 + 1] > 26) mp[i * 3 + 1] = 0;
    }
    mg.attributes.position.needsUpdate = true;
  });

  world.dotTex = dotTex; world.mistTex = mist;
  world.drawGroups = mergeStatic(scene, startIdx);
  return world;
}
