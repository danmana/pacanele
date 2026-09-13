import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, value) => THREE.MathUtils.smoothstep(value, a, b);
const number = new Intl.NumberFormat('ro-RO');

export function celebrationFor(result) {
  const multiplier = result.payout / result.bet;
  const level = !result.payout ? 0 : result.jackpot || multiplier >= 100 ? 5 : multiplier >= 25 ? 4 : multiplier >= 10 ? 3 : multiplier >= 5 ? 2 : 1;
  const special = result.bonus > 0;
  return { multiplier, level, special, tier: special ? 'speciala' : ['loss', 'spark', 'shower', 'rays', 'super', 'jackpot'][level], duration: special ? 5000 : [1700, 2400, 3000, 3700, 4400, 5400][level] };
}

// One reusable pool per effect. Celebrations never allocate WebGL resources per spin.
export class WinEffects {
  constructor(scene, camera, overlay, reducedMotion) {
    this.camera = camera; this.overlay = overlay; this.reducedMotion = reducedMotion;
    this.label = overlay.querySelector('.payout-label'); this.amount = overlay.querySelector('.payout-amount');
    this.card = overlay.querySelector('.payout-card');
    this.group = new THREE.Group(); scene.add(this.group);
    this.dummy = new THREE.Object3D(); this.anchor = new THREE.Vector3();
    this.createRays(); this.createParticles(); this.createGold(); this.createRings();
    // Keep the light in the scene at zero intensity while idle, so the room's
    // PBR shaders do not recompile when the number of active lights changes.
    this.light = new THREE.PointLight('#ffcb76', 0, 7, 1.5); this.light.position.set(0, 3.7, 1.3); scene.add(this.light);
    this.clear();
  }
  createRays() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.rays = Array.from({ length: 7 }, (_, index) => {
      const material = new THREE.ShaderMaterial({
        uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color(1.8, 1.15, .45) } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'varying vec2 vUv; uniform float opacity; uniform vec3 tint; void main(){float spread=.025+(1.0-vUv.y)*.43;float beam=exp(-pow((vUv.x-.5)/spread,2.0)*2.0);float ends=pow(sin(vUv.y*3.14159),.45);gl_FragColor=vec4(tint,beam*ends*opacity);}',
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
      });
      const ray = new THREE.Mesh(geometry, material); ray.position.set((index - 3) * .54, 4.2, -.35 - index * .05);
      ray.scale.set(.85, 7.6, 1); this.group.add(ray); return ray;
    });
  }
  createParticles() {
    this.particleData = Array.from({ length: 420 }, () => ({}));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(420 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(420), 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(420 * 3), 3));
    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 }, pixelScale: { value: 800 } },
      vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vColor; uniform float pixelScale; void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(size*pixelScale/-p.z,1.0,24.0);gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying vec3 vColor; uniform float opacity; void main(){float d=length(gl_PointCoord-.5)*2.0;float glow=pow(max(0.0,1.0-d),2.0);gl_FragColor=vec4(vColor,glow*opacity);}',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.particles = new THREE.Points(geometry, this.particleMaterial); this.particles.frustumCulled = false; this.group.add(this.particles);
  }
  createGold() {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf71', metalness: .72, roughness: .22, emissive: '#b77b1a', emissiveIntensity: .65, transparent: true });
    const star = new THREE.Shape();
    for (let index = 0; index < 10; index++) {
      const angle = index / 10 * TAU + Math.PI / 2, radius = index % 2 ? .43 : 1;
      if (index === 0) star.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else star.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    star.closePath();
    const geometry = new THREE.ExtrudeGeometry(star, { depth: .12, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .045, bevelThickness: .035 });
    geometry.translate(0, 0, -.06);
    this.stars = new THREE.InstancedMesh(geometry, gold, 20);
    this.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(.065, .065, .015, 12), gold.clone(), 100);
    for (const object of [this.stars, this.coins]) {
      object.instanceMatrix.setUsage(THREE.DynamicDrawUsage); object.frustumCulled = false; this.group.add(object);
    }
    this.goldData = Array.from({ length: 100 }, () => ({}));
  }
  createRings() {
    const geometry = new THREE.RingGeometry(.98, 1, 96);
    this.rings = Array.from({ length: 3 }, (_, index) => {
      const ring = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.35, .55), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, .07 + index * .01, .25); this.group.add(ring); return ring;
    });
  }
  play(result, now, mobile) {
    this.clear(); this.config = celebrationFor(result); this.started = now;
    const { level, special, tier, multiplier } = this.config;
    this.duration = this.reducedMotion ? 2100 : this.config.duration;
    this.overlay.hidden = false; this.overlay.dataset.tier = tier;
    this.overlay.dataset.level = level; this.overlay.dataset.outcome = result.payout ? 'win' : 'loss';
    this.label.textContent = result.payout ? `${special ? 'SPECIALA · ' : level === 5 ? 'AI SPART BANCA · ' : ''}${number.format(multiplier)}× MIZA` : 'MIZĂ PIERDUTĂ';
    this.amount.textContent = `${result.payout ? '+' : '−'}${number.format(result.payout || result.bet)}`;
    this.overlay.style.opacity = '0';
    this.group.visible = level > 0 && !this.reducedMotion;
    this.rayCount = this.group.visible ? special ? 5 : [0, 0, 0, 3, 5, 7][level] : 0;
    this.stars.count = this.group.visible && special ? mobile ? 12 : 20 : 0;
    this.coins.count = this.group.visible && level >= 2 ? Math.round((special ? 25 : level * 18) * (mobile ? .6 : 1)) : 0;
    this.particleCount = this.group.visible ? Math.round((special ? 320 : [0, 55, 120, 200, 300, 420][level]) * (mobile ? .6 : 1)) : 0;
    this.particles.geometry.setDrawRange(0, this.particleCount);
    const sizes = this.particles.geometry.attributes.size, colors = this.particles.geometry.attributes.color;
    for (let index = 0; index < this.particleCount; index++) {
      const data = this.particleData[index];
      data.angle = Math.random() * TAU; data.radius = Math.random(); data.speed = .5 + Math.random() * 1.8;
      data.height = Math.random() * 2.7; data.phase = Math.random() * TAU;
      sizes.setX(index, .016 + Math.random() * .047);
      const white = index % 5 === 0; colors.setXYZ(index, white ? 2.2 : 1.9, white ? 2.0 : 1.1, white ? 1.4 : .26);
    }
    sizes.needsUpdate = true; colors.needsUpdate = true;
    for (const data of this.goldData) {
      data.angle = Math.random() * TAU; data.radius = .7 + Math.random() * 1.1;
      data.speed = .7 + Math.random(); data.phase = Math.random() * TAU; data.size = .7 + Math.random();
    }
    this.rays.forEach((ray, index) => { ray.visible = index < this.rayCount; });
  }
  clear() {
    this.config = null; this.group.visible = false; this.overlay.hidden = true;
    this.overlay.style.opacity = '0'; this.light.intensity = 0; this.energy = 0;
    this.stars.count = 0; this.coins.count = 0; this.rayCount = 0; this.particleCount = 0;
  }
  get state() {
    return { active: !!this.config, tier: this.config?.tier ?? null, stars: this.stars.count, rays: this.rayCount, particles: this.particleCount, coins: this.coins.count };
  }
  update(now, width, height) {
    if (!this.config) return;
    const elapsed = now - this.started, progress = elapsed / this.duration, time = elapsed / 1000;
    if (progress >= 1) { this.clear(); return; }
    const { level, special } = this.config;
    const fade = smooth(0, .10, progress) * (1 - smooth(.65, 1, progress));
    this.energy = level > 0 && !this.reducedMotion ? fade * (special ? .9 : level / 5) : 0;
    this.anchor.set(0, 2.15, .8).project(this.camera);
    const x = clamp((this.anchor.x + 1) * width / 2, Math.min(155, width / 2), width - Math.min(155, width / 2));
    const y = clamp((1 - this.anchor.y) * height / 2, height * .27, height * .63);
    this.overlay.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    this.overlay.style.opacity = this.reducedMotion ? String(1 - smooth(.75, 1, progress)) : String(fade);
    const rise = this.reducedMotion ? 0 : (level ? 15 : 5) - progress * (level ? 85 : 55);
    const scale = this.reducedMotion ? 1 : 1 - .14 * Math.exp(-time * 9) + (level > 2 ? .05 * Math.sin(Math.min(time * 5, Math.PI)) : 0);
    this.card.style.transform = `translate(-50%, -50%) translateY(${rise}px) scale(${scale})`;
    if (!this.group.visible) return;
    this.light.intensity = this.energy * 13;
    this.rays.forEach((ray, index) => {
      if (!ray.visible) return;
      const centered = index - (this.rayCount - 1) / 2;
      ray.position.x = centered * .5 + Math.sin(time * .45 + index) * .16;
      ray.quaternion.copy(this.camera.quaternion); ray.rotateZ(centered * -.105 + Math.sin(time * .35 + index) * .035);
      ray.material.uniforms.opacity.value = fade * (special ? .14 : .10 + level * .022);
    });
    this.rings.forEach((ring, index) => {
      const phase = clamp((time - index * .3) / (special ? 3.5 : 2), 0, 1);
      ring.visible = level >= 2 || index === 0;
      ring.scale.setScalar(.6 + phase * (level >= 4 ? 3.8 : 2.5));
      ring.material.opacity = Math.sin(phase * Math.PI) * fade * .45;
    });
    const positions = this.particles.geometry.attributes.position;
    this.particleMaterial.uniforms.opacity.value = fade;
    this.particleMaterial.uniforms.pixelScale.value = height * Math.min(devicePixelRatio, 1.5);
    for (let index = 0; index < this.particleCount; index++) {
      const data = this.particleData[index];
      if (special) {
        const angle = data.angle + time * data.speed * .65, radius = .9 + data.radius * 1.2;
        positions.setXYZ(index, Math.cos(angle) * radius, .8 + (data.height + time * .65) % 3.5, Math.sin(angle) * radius + .15);
      } else {
        const t = Math.max(0, time - data.radius * .45), spread = (1 - Math.exp(-t * 2)) * (.45 + level * .3) * data.speed;
        positions.setXYZ(index, Math.cos(data.angle) * spread, 2.1 + Math.sin(data.angle) * spread * .7 + t * .8 - t * t * .32, .55 + Math.sin(data.phase) * spread * .55);
      }
    }
    positions.needsUpdate = true;
    this.stars.material.opacity = fade; this.coins.material.opacity = fade;
    for (let index = 0; index < this.stars.count; index++) {
      const data = this.goldData[index], reveal = smooth(index * .025, .8 + index * .025, time);
      const angle = index / this.stars.count * TAU + time * .7;
      const radius = (1.1 + Math.sin(index * 4) * .3) * reveal;
      this.dummy.position.set(Math.cos(angle) * radius, 1.35 + index % 4 * .53 + Math.sin(time * 1.4 + index) * .17, .3 + Math.sin(angle) * radius);
      this.dummy.rotation.set(Math.sin(time + index) * .4, time * data.speed + index, Math.sin(time * .7 + index) * .3);
      this.dummy.scale.setScalar((.12 + data.size * .045) * reveal * (1 - smooth(.8, 1, progress)));
      this.dummy.updateMatrix(); this.stars.setMatrixAt(index, this.dummy.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < this.coins.count; index++) {
      const data = this.goldData[index], t = Math.max(0, time - index / this.coins.count * .65);
      const radius = data.radius * Math.min(1, t * 1.7);
      this.dummy.position.set(Math.cos(data.angle) * radius, 2.15 + t * (2.5 + data.speed) - t * t * 1.35, .65 + Math.sin(data.angle) * radius * .6);
      this.dummy.rotation.set(time * 3 + data.phase, time * data.speed * 2, data.angle);
      this.dummy.scale.setScalar(data.size * smooth(0, .15, t)); this.dummy.updateMatrix(); this.coins.setMatrixAt(index, this.dummy.matrix);
    }
    this.coins.instanceMatrix.needsUpdate = true;
  }
}
