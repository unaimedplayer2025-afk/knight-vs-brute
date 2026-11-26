// Particles, sword trails, shockwaves, telegraphs, smoke, sword-wave and the green roar aura.
import * as THREE from 'three';
import { softTex, cloudTex, ribbonMaterial } from './world.js';

export function buildFX(scene) {
  const dot = softTex();
  const cloud = cloudTex();
  const fx = {};

  // ---- sparks (additive points with velocity + gravity) ----
  const MAX = 900;
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX), grav = new Float32Array(MAX), baseCol = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.frustumCulled = false; scene.add(pts);
  let next = 0;
  for (let i = 0; i < MAX; i++) pos[i * 3 + 1] = -999;
  fx.burst = (p, n, color, speed = 7, g = 9, lifeS = 0.5, dir = null, spread = 1) => {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = next; next = (next + 1) % MAX;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
      const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l;
      if (dir) { vx = dir.x + vx * spread; vy = dir.y + vy * spread; vz = dir.z + vz * spread; }
      const sp = speed * (0.35 + Math.random() * 0.9);
      vel[i * 3] = vx * sp; vel[i * 3 + 1] = vy * sp + speed * 0.25; vel[i * 3 + 2] = vz * sp;
      life[i] = maxLife[i] = lifeS * (0.5 + Math.random() * 0.8); grav[i] = g;
      const hdr = 1.6 + Math.random() * 1.6;
      baseCol[i * 3] = c.r * hdr; baseCol[i * 3 + 1] = c.g * hdr; baseCol[i * 3 + 2] = c.b * hdr;
    }
  };

  // ---- flash sprites ----
  const flashes = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.visible = false; scene.add(s); flashes.push({ s, t: 0, d: 0.2, size: 1 });
  }
  let fi = 0;
  fx.flash = (p, color, size = 2.5, d = 0.18) => {
    const f = flashes[fi]; fi = (fi + 1) % flashes.length;
    f.s.position.copy(p); f.s.material.color.set(color).multiplyScalar(3); f.t = 0; f.d = d; f.size = size; f.s.visible = true;
  };

  // ---- smoke puffs ----
  const smokes = [];
  for (let i = 0; i < 60; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloud, color: 0x9aa0b0, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; scene.add(s); smokes.push({ s, t: 0, d: 1, v: new THREE.Vector3(), g: 1, a: 0.6 });
  }
  let si = 0;
  fx.smoke = (p, n = 6, size = 3, spread = 1.5, color = 0x9aa0b0, d = 1.4, alpha = 0.7, up = 0.6) => {
    for (let k = 0; k < n; k++) {
      const o = smokes[si]; si = (si + 1) % smokes.length;
      o.s.position.set(p.x + (Math.random() - 0.5) * spread, p.y + Math.random() * 0.5, p.z + (Math.random() - 0.5) * spread);
      o.v.set((Math.random() - 0.5) * 2.5, up + Math.random() * up, (Math.random() - 0.5) * 2.5);
      o.s.material.color.set(color); o.t = 0; o.d = d * (0.7 + Math.random() * 0.6); o.g = size * (0.6 + Math.random() * 0.6); o.a = alpha; o.s.visible = true;
    }
  };

  // ---- ground rings: shockwaves + telegraphs ----
  const ringMat = (c) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { col: { value: new THREE.Color(c) }, a: { value: 1 }, fill: { value: 0 }, t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform vec3 col; uniform float a; uniform float fill; uniform float t;
      void main(){ float r=length(vUv-0.5)*2.0; if(r>1.0) discard;
        float ring=smoothstep(0.82,0.97,r)*smoothstep(1.0,0.97,r);
        float inner=step(r,fill)*0.35*(0.7+0.3*sin(t*20.0));
        float e=max(ring*1.6, inner);
        gl_FragColor=vec4(col*2.0*e, e*a); }`,
  });
  const ringGeo = new THREE.PlaneGeometry(1, 1); ringGeo.rotateX(-Math.PI / 2);
  const shocks = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(ringGeo, ringMat(0xffa040)); m.visible = false; m.position.y = 0.05; scene.add(m); shocks.push({ m, t: 0, d: 0.6, r0: 0.5, r1: 6 }); }
  let shi = 0;
  fx.shockwave = (p, r1 = 7, color = 0xffa040, d = 0.55) => {
    const s = shocks[shi]; shi = (shi + 1) % shocks.length;
    s.m.position.set(p.x, 0.06, p.z); s.m.material.uniforms.col.value.set(color); s.m.material.uniforms.fill.value = 0;
    s.t = 0; s.d = d; s.r1 = r1; s.m.visible = true;
    return s;
  };
  const tele = new THREE.Mesh(ringGeo, ringMat(0xff2a10)); tele.visible = false; tele.position.y = 0.07; scene.add(tele);
  fx.telegraph = (p, r, prog) => {
    if (!p) { tele.visible = false; return; }
    tele.visible = true; tele.position.set(p.x, 0.07, p.z); tele.scale.setScalar(r * 2);
    tele.material.uniforms.fill.value = prog; tele.material.uniforms.a.value = 0.9;
  };
  // charge lane telegraph
  const laneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.2, 0.1), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const laneGeo = new THREE.PlaneGeometry(1, 1); laneGeo.rotateX(-Math.PI / 2); laneGeo.translate(0, 0, 0.5);
  const lane = new THREE.Mesh(laneGeo, laneMat); lane.visible = false; lane.position.y = 0.06; scene.add(lane);
  fx.lane = (p, yaw, len, w, a) => {
    if (!p) { lane.visible = false; return; }
    lane.visible = true; lane.position.set(p.x, 0.06, p.z); lane.rotation.y = yaw; lane.scale.set(w, 1, len); laneMat.opacity = a;
  };

  // ---- sword trail (ribbon from blade base/tip history) ----
  fx.makeTrail = (color, segs = 18) => {
    const N = segs;
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(N * 2 * 3), A = new Float32Array(N * 2);
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(A, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      uniforms: { col: { value: new THREE.Color(color) }, k: { value: 1 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying float vA; uniform vec3 col; uniform float k; void main(){ float a=vA*k; gl_FragColor=vec4(col*(1.0+a*2.5)*a, a); }',
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
    const histA = [], histB = [];
    const tr = { mesh, on: false, fade: 0, width: 1 };
    tr.push = (a, b) => {
      histA.unshift(a.clone()); histB.unshift(b.clone());
      if (histA.length > N) { histA.pop(); histB.pop(); }
    };
    tr.update = (dt, emit, a, b) => {
      if (emit) { tr.fade = 1; tr.push(a, b); }
      else { tr.fade = Math.max(0, tr.fade - dt * 4); if (histA.length) { histA.pop(); histB.pop(); } }
      const n = histA.length;
      for (let i = 0; i < N; i++) {
        const j = Math.min(i, Math.max(0, n - 1));
        const pa = histA[j], pb = histB[j];
        if (!pa) { P.fill(0); A.fill(0); break; }
        const f = 1 - i / N;
        // inner edge pulled toward tip so the arc tapers like the clip's light arcs
        P[i * 6] = pb.x + (pa.x - pb.x) * (0.55 + 0.45 * f); P[i * 6 + 1] = pb.y + (pa.y - pb.y) * (0.55 + 0.45 * f); P[i * 6 + 2] = pb.z + (pa.z - pb.z) * (0.55 + 0.45 * f);
        P[i * 6 + 3] = pb.x; P[i * 6 + 4] = pb.y; P[i * 6 + 5] = pb.z;
        const al = i < n ? f * f * tr.fade : 0;
        A[i * 2] = al * 0.15; A[i * 2 + 1] = al;
      }
      g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true;
      mesh.visible = tr.fade > 0.01;
    };
    tr.clear = () => { histA.length = 0; histB.length = 0; tr.fade = 0; mesh.visible = false; };
    return tr;
  };

  // ---- sword wave projectile (blue crescent) ----
  const waveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 2.2, 4.0), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const waveGeo = new THREE.TorusGeometry(1.5, 0.14, 8, 36, Math.PI * 1.1); waveGeo.rotateZ(-Math.PI * 0.05); waveGeo.scale(1, 0.55, 1);
  const waveOuter = new THREE.TorusGeometry(1.5, 0.32, 8, 36, Math.PI * 1.1); waveOuter.rotateZ(-Math.PI * 0.05); waveOuter.scale(1, 0.55, 1);
  const wave = new THREE.Group();
  wave.add(new THREE.Mesh(waveGeo, waveMat));
  wave.add(new THREE.Mesh(waveOuter, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.7, 1.8), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  wave.visible = false; scene.add(wave);
  fx.wave = wave;

  // ---- green/teal roar aura (from the clip's ending) ----
  const aura = new THREE.Group(); aura.visible = false; scene.add(aura);
  const auraMats = [];
  for (let i = 0; i < 9; i++) {
    const pts = []; const turns = 1.0 + Math.random() * 0.8, r0 = 2.4 + Math.random() * 1.6, ph = Math.random() * 6.28, h = 9 + Math.random() * 6;
    for (let k = 0; k <= 24; k++) { const f = k / 24; const a = ph + f * turns * Math.PI * 2; const r = r0 + f * (2 + Math.random() * 0.3) + Math.sin(f * 7) * 0.4; pts.push(new THREE.Vector3(Math.cos(a) * r, f * h, Math.sin(a) * r)); }
    const mat = ribbonMaterial(i % 3 === 0 ? 0x3ddcb0 : (i % 3 === 1 ? 0x18b890 : 0x4fd8c8), 0.5 + Math.random() * 0.3, 0.5);
    auraMats.push(mat);
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.22 + Math.random() * 0.25, 6), mat);
    m.userData.spin = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
    aura.add(m);
  }
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 40, 32, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { t: { value: 0 }, a: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform float t; uniform float a; void main(){ float r=0.6+0.4*sin(vUv.x*40.0+t*3.0)*sin(vUv.y*8.0-t*4.0);
      gl_FragColor=vec4(vec3(0.3,1.6,1.3)*r, a*r*smoothstep(1.0,0.2,vUv.y)); }`,
  }));
  pillar.position.y = 20; aura.add(pillar);
  const auraLight = new THREE.PointLight(0x3dffc0, 0, 26, 1.4); auraLight.position.y = 3; aura.add(auraLight);
  fx.aura = { group: aura, k: 0, t: 0 };
  fx.setAura = (p, k) => { aura.visible = k > 0.01; if (p) aura.position.set(p.x, 0, p.z); fx.aura.k = k; };

  fx.update = (dt, realDt, cam) => {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { if (pos[i * 3 + 1] > -900) { pos[i * 3 + 1] = -999; } col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      life[i] -= dt;
      vel[i * 3 + 1] -= grav[i] * dt;
      const drag = Math.exp(-dt * 1.8);
      vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.35; }
      const f = Math.max(0, life[i] / maxLife[i]);
      col[i * 3] = baseCol[i * 3] * f; col[i * 3 + 1] = baseCol[i * 3 + 1] * f; col[i * 3 + 2] = baseCol[i * 3 + 2] * f;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    for (const f of flashes) {
      if (!f.s.visible) continue;
      f.t += realDt; const k = f.t / f.d;
      if (k >= 1) { f.s.visible = false; continue; }
      f.s.scale.setScalar(f.size * (0.6 + k * 0.8)); f.s.material.opacity = 1 - k;
    }
    for (const o of smokes) {
      if (!o.s.visible) continue;
      o.t += dt; const k = o.t / o.d;
      if (k >= 1) { o.s.visible = false; continue; }
      o.s.position.addScaledVector(o.v, dt); o.v.multiplyScalar(Math.exp(-dt * 1.5));
      o.s.scale.setScalar(o.g * (0.6 + k * 1.2)); o.s.material.opacity = o.a * Math.sin(k * Math.PI);
    }
    for (const s of shocks) {
      if (!s.m.visible) continue;
      s.t += dt; const k = s.t / s.d;
      if (k >= 1) { s.m.visible = false; continue; }
      const r = 0.5 + (s.r1 - 0.5) * (1 - Math.pow(1 - k, 2));
      s.m.scale.setScalar(r * 2); s.m.material.uniforms.a.value = 1 - k; s.r = r;
    }
    fx.aura.t += realDt;
    if (aura.visible) {
      const k = fx.aura.k;
      aura.children.forEach((m, i) => { if (m.userData.spin) { m.rotation.y += m.userData.spin * realDt; m.scale.set(0.6 + k * 0.5, 0.3 + k * 0.75, 0.6 + k * 0.5); } });
      auraMats.forEach((m) => { m.uniforms.t.value = fx.aura.t; m.uniforms.a.value = k * 0.42; });
      pillar.material.uniforms.t.value = fx.aura.t; pillar.material.uniforms.a.value = k * 0.14;
      auraLight.intensity = k * 45;
      if (Math.random() < k * 0.8) fx.burst(new THREE.Vector3(aura.position.x + (Math.random() - 0.5) * 4, 0.2, aura.position.z + (Math.random() - 0.5) * 4), 2, 0x4dffd0, 3, -4, 1.6, new THREE.Vector3(0, 1, 0), 0.4);
    }
    void cam;
  };
  fx.shocks = shocks;
  return fx;
}
