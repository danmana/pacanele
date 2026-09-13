import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CachedBokehPass } from './cached-bokeh.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, createMarquee, noiseTexture, carpetTexture, rounded } from './textures.js';
import { WinEffects } from './celebration.js';

const PI = Math.PI;
function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z);
  object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function box(parent, w, h, d, material, x, y, z, radius = .02) {
  return mesh(parent, new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), material, x, y, z);
}
function tube(parent, points, radius, material, smooth = false) {
  const vectors = points.map(p => new THREE.Vector3(...p));
  const curve = smooth ? new THREE.CatmullRomCurve3(vectors) : new THREE.CurvePath();
  if (!smooth) for (let i = 1; i < vectors.length; i++) curve.add(new THREE.LineCurve3(vectors[i - 1], vectors[i]));
  return mesh(parent, new THREE.TubeGeometry(curve, smooth ? 60 : points.length * 3, radius, 6, false), material);
}
function border(parent, w, h, r, x, y, z, material, thickness = .009) {
  const path = new THREE.Shape();
  path.moveTo(-w / 2 + r, -h / 2); path.lineTo(w / 2 - r, -h / 2); path.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  path.lineTo(w / 2, h / 2 - r); path.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); path.lineTo(-w / 2 + r, h / 2); path.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); path.lineTo(-w / 2, -h / 2 + r); path.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const points = path.getPoints(12).map(p => new THREE.Vector3(p.x + x, p.y + y, z)); const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', .1);
  return mesh(parent, new THREE.TubeGeometry(curve, 100, thickness, 6, true), material);
}
function label(parent, value, w, h, x, y, z, color = '#cbbd9e', size = 44, bg = '#111317') {
  const { texture } = canvasTexture(512, Math.max(64, Math.round(512 * h / w)), (ctx, cw, ch) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = color; ctx.font = `500 ${size}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, cw / 2, ch / 2);
  });
  return mesh(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .15, roughness: .3, metalness: .15 }), x, y, z);
}

// Collapse the many machined parts into a few material batches while preserving
// the physical buttons as separate meshes for animation and raycasting.
function batchStatic(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(); const buckets = new Map(), originals = [];
  group.traverse(object => {
    if (!object.isMesh || object.userData.interactive || object.userData.keep || Array.isArray(object.material)) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material: object.material, geometries: [], castShadow: object.castShadow, receiveShadow: object.receiveShadow });
    const geometry = object.geometry.clone(); geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
    if (geometry.index) { const nonIndexed = geometry.toNonIndexed(); geometry.dispose(); buckets.get(key).geometries.push(nonIndexed); } else buckets.get(key).geometries.push(geometry);
    originals.push(object);
  });
  originals.forEach(object => object.removeFromParent());
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometries, false); bucket.geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const object = mesh(group, geometry, bucket.material); object.castShadow = bucket.castShadow; object.receiveShadow = bucket.receiveShadow;
  }
}

export class CabinetScene {
  constructor(container, screen, { onAction, onInvalidate, reducedMotion = false } = {}) {
    this.container = container; this.screen = screen; this.onAction = onAction; this.onInvalidate = onInvalidate;
    this.dirty = true; this.renderSerial = 0; this.stats = { renders: 0, reflections: 0, depths: 0, shadows: 0 };
    this.cameraOffset = new THREE.Vector3(); this.upAxis = new THREE.Vector3(0, 1, 0);
    this.reducedMotion = reducedMotion; this.mobile = innerWidth <= 900;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#090b11'); this.scene.fog = new THREE.FogExp2('#0a0b10', .065);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .95;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(34, 1, .1, 45);
    this.buttons = []; this.presses = []; this.yaw = 0; this.targetYaw = 0; this.pointer = new THREE.Vector2(); this.raycaster = new THREE.Raycaster();
    this.env(); this.materials(); this.room(); this.cabinet(); this.lights(); this.post(); this.events(); this.resize();
    this.effects = new WinEffects(this.scene, this.camera, document.getElementById('payout-float'), reducedMotion);
    this.grain();
    this.frameCount = 0; this.lastFrame = 0; this.frameTotal = 0; this.qualityAdjusted = false;
  }
  grain() {
    // A small, cached noise tile moves on the compositor. It does not require
    // rendering the room, reflections, depth of field and bloom at every idle tick.
    const tile = document.createElement('canvas'); tile.width = tile.height = 256;
    const ctx = tile.getContext('2d'), data = ctx.createImageData(256, 256);
    let seed = 7351;
    for (let i = 0; i < data.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = seed >>> 24;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    this.grainLayer = document.createElement('div'); this.grainLayer.className = 'film-grain';
    this.grainLayer.setAttribute('aria-hidden', 'true');
    this.grainLayer.style.backgroundImage = `url(${tile.toDataURL()})`;
    this.container.appendChild(this.grainLayer);
  }
  invalidate({ depth = false, shadows = false } = {}) {
    this.dirty = true;
    if (depth) this.bokeh.depthNeedsUpdate = true;
    if (shadows) this.renderer.shadowMap.needsUpdate = true;
    this.onInvalidate?.();
  }
  get animating() { return Math.abs(this.targetYaw - this.yaw) > .00001 || this.presses.length > 0 || !!this.effects.config; }
  rest() { this.lastFrame = 0; this.lastAnimationTime = null; }
  env() {
    const environment = new RoomEnvironment();
    // Half-float PMREM captures an HDR room locally; no fragile external HDR file.
    const warmBox = new THREE.Mesh(new THREE.BoxGeometry(8, 6, .1), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 4.6, 2.4) })); warmBox.position.set(-8, 6, 8); environment.add(warmBox);
    const coolBox = new THREE.Mesh(new THREE.BoxGeometry(3, 7, .1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 3.2, 6) })); coolBox.position.set(7, 4, 4); environment.add(coolBox);
    const pmrem = new THREE.PMREMGenerator(this.renderer); this.environmentTarget = pmrem.fromScene(environment, .04);
    this.scene.environment = this.environmentTarget.texture; this.scene.environmentIntensity = .38;
    environment.dispose(); pmrem.dispose();
  }
  materials() {
    const brushed = noiseTexture('metal'), leather = noiseTexture('leather');
    this.m = {
      body: new THREE.MeshPhysicalMaterial({ color: '#12141b', metalness: .72, roughness: .27, clearcoat: .7, clearcoatRoughness: .22, bumpMap: brushed, bumpScale: .0008 }),
      side: new THREE.MeshPhysicalMaterial({ color: '#17141a', metalness: .42, roughness: .3, clearcoat: 1, clearcoatRoughness: .14 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#a4aab3', metalness: 1, roughness: .2, roughnessMap: brushed }),
      gold: new THREE.MeshStandardMaterial({ color: '#ac8552', metalness: .88, roughness: .28, bumpMap: brushed, bumpScale: .0004 }),
      black: new THREE.MeshStandardMaterial({ color: '#05070b', metalness: .2, roughness: .45 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#060608', roughness: .93 }),
      leather: new THREE.MeshPhysicalMaterial({ color: '#1f141b', roughness: .5, metalness: .08, clearcoat: .3, bumpMap: leather, bumpScale: .007 }),
      orange: new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffab45', emissiveIntensity: 2.3, roughness: .3 }),
      white: new THREE.MeshPhysicalMaterial({ color: '#e3ddcb', emissive: '#fae8c3', emissiveIntensity: .45, roughness: .2, clearcoat: 1 }),
      red: new THREE.MeshStandardMaterial({ color: '#ad3049', emissive: '#ff213b', emissiveIntensity: 2.2 }),
      teal: new THREE.MeshStandardMaterial({ color: '#448da0', emissive: '#20baba', emissiveIntensity: 1.4 }),
    };
  }
  cabinet() {
    this.machine = new THREE.Group(); this.scene.add(this.machine);
    const { body, chrome, black, gold, orange, rubber } = this.m, g = this.machine;
    box(g, 1.93, .13, 1.32, rubber, 0, .085, .12, .04);
    box(g, 1.84, .12, 1.23, chrome, 0, .16, .1, .04);
    box(g, 1.79, .84, .89, body, 0, .59, -.025, .055);
    box(g, 1.78, .35, 1.08, body, 0, 1.09, .08, .045);
    box(g, 1.79, 2.0, .73, body, 0, 2.3, -.035, .09);
    box(g, 1.85, .14, .8, chrome, 0, 3.33, -.04, .05);
    box(g, 1.77, .12, .74, black, 0, 3.4, -.035, .04);
    // Separate sculpted side cheeks enclose the screen and protruding button deck.
    const side = new THREE.Shape(); side.moveTo(-.5, .17); side.lineTo(.47, .17); side.lineTo(.49, 1.02); side.quadraticCurveTo(.48, 1.15, .8, 1.25); side.quadraticCurveTo(.91, 1.34, .77, 1.48); side.lineTo(.42, 1.69); side.lineTo(.35, 3.29); side.quadraticCurveTo(.32, 3.4, .17, 3.4); side.lineTo(-.49, 3.4); side.closePath();
    const geometry = new THREE.ExtrudeGeometry(side, { depth: .075, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .024, bevelThickness: .015, curveSegments: 8 });
    for (const sign of [-1, 1]) {
      const cheek = mesh(g, geometry, this.m.side, sign * .88, 0, 0); cheek.rotation.y = -PI / 2;
      const xx = sign * .905;
      tube(g, [[xx,.21,.5],[xx,1.0,.5],[xx,1.22,.77],[xx,1.4,.84],[xx,1.56,.53],[xx,1.74,.405],[xx,3.24,.405],[xx,3.36,.32]], .022, chrome, true);
      tube(g, [[xx,.25,.525],[xx,1.0,.525],[xx,1.22,.795],[xx,1.39,.865],[xx,1.57,.55],[xx,1.74,.43],[xx,3.23,.43],[xx,3.33,.35]], .008, orange, true);
    }
    // Main screen: a lit LCD below a PBR glass face, inset in a rubber gasket.
    box(g, 1.69, 1.30, .10, chrome, 0, 2.02, .371, .055);
    box(g, 1.62, 1.26, .075, black, 0, 2.02, .429, .05);
    const displayMaterial = new THREE.MeshPhysicalMaterial({ map: this.screen.texture, emissiveMap: this.screen.texture, emissive: 0xffffff, emissiveIntensity: .8, color: '#363636', metalness: 0, roughness: .23, specularIntensity: .08, clearcoat: .1, clearcoatRoughness: .3, envMapIntensity: .06 });
    const display = mesh(g, new THREE.PlaneGeometry(1.50, 1.125), displayMaterial, 0, 2.035, .473); display.userData.keep = true;
    border(g, 1.66, 1.28, .08, 0, 2.02, .475, orange, .007);
    label(g, 'ULTIMA GHEARĂ  ·  SERIA 007', 1.03, .047, 0, 1.408, .48, '#bead8d', 24);
    // Top glass and printed metallic marquee.
    box(g, 1.7, .75, .12, chrome, 0, 3.03, .349, .055);
    box(g, 1.64, .70, .075, black, 0, 3.03, .416, .04);
    const marquee = createMarquee();
    mesh(g, new THREE.PlaneGeometry(1.55, .65), new THREE.MeshPhysicalMaterial({ map: marquee.texture, emissiveMap: marquee.texture, emissive: 0xffffff, emissiveIntensity: .67, roughness: .2, clearcoat: .6, clearcoatRoughness: .16, envMapIntensity: .12 }), 0, 3.03, .46);
    border(g, 1.65, .71, .065, 0, 3.03, .465, orange, .009);
    // A continuous smoked-glass layer creates edge highlights over the two panels.
    const glass = new THREE.MeshPhysicalMaterial({ color: '#d5e8ee', transmission: .96, thickness: .008, roughness: .18, specularIntensity: .05, ior: 1.5, transparent: true, opacity: .055, envMapIntensity: .03, depthWrite: false });
    const pane = box(g, 1.57, 1.17, .006, glass, 0, 2.035, .481, .004); pane.castShadow = false;
    // Sloped control deck, a soft wrist rest, card reader and raised arcade buttons.
    const deck = box(g, 1.76, .13, .57, chrome, 0, 1.317, .574, .055); deck.rotation.x = -.19;
    const deckTop = box(g, 1.7, .065, .52, body, 0, 1.377, .577, .045); deckTop.rotation.x = -.19;
    const rest = box(g, 1.71, .12, .16, this.m.leather, 0, 1.298, .863, .048); rest.rotation.x = -.10;
    box(g, .30, .012, .20, black, -.62, 1.427, .51, .01);
    for (let i = 0; i < 4; i++) box(g, .22, .002, .006, chrome, -.62, 1.436, .46 + i * .025, .001);
    const actions = ['bet', 'bet', 'cashout', 'spin'];
    const labels = ['MIZĂ', 'MARE', 'PLEC', 'GHEARĂ'];
    for (let i = 0; i < 4; i++) {
      const xx = -.27 + i * .275, width = i === 3 ? .25 : .22;
      const socket = box(g, width + .025, .035, .225, black, xx, 1.413, .665, .03); socket.rotation.x = -.19;
      const rim = box(g, width + .008, .027, .209, chrome, xx, 1.434, .665, .035); rim.rotation.x = -.19;
      const cap = box(g, width, .048, .193, i === 3 ? new THREE.MeshPhysicalMaterial({ color: '#ffc557', emissive: '#ffae23', emissiveIntensity: .65, clearcoat: 1, roughness: .2, transmission: .08, thickness: .025 }) : this.m.white, xx, 1.464, .665, .035); cap.rotation.x = -.19;
      cap.userData.interactive = true; cap.userData.action = actions[i]; cap.userData.restY = cap.position.y; this.buttons.push(cap);
      const print = label(g, labels[i], width * .81, .075, xx, 1.492, .665, '#30281c', i === 3 ? 72 : 100, i === 3 ? '#f1bd58' : '#d9d4c7'); print.rotation.x = -PI / 2 - .19; print.userData.keep = true; cap.userData.print = print; cap.userData.printY = print.position.y;
    }
    // Bill acceptor: brushed faceplate, recessed mouth, status LED.
    box(g, .45, .19, .055, chrome, .46, 1.081, .631, .018);
    box(g, .365, .10, .022, black, .46, 1.093, .664, .012);
    box(g, .325, .015, .012, rubber, .46, 1.091, .68, .003);
    box(g, .3, .008, .018, this.m.teal, .46, 1.058, .678, .002);
    label(g, 'DOAR BANI IMAGINARI', .44, .046, .46, .951, .639, '#b7ad94', 28);
    label(g, '200 LEI DIN PARTEA CASEI', .77, .085, -.31, 1.102, .643, '#dbc69b', 28);
    // Lower door with decorative inset, speaker slots, lock, coin tray and feet.
    box(g, 1.53, .77, .04, black, 0, .666, .444, .025);
    border(g, 1.5, .76, .055, 0, .668, .471, gold, .006);
    const lower = canvasTexture(1024, 510, (ctx, w, h) => {
      ctx.fillStyle = '#090c0d'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8c68333f'; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(0, h * i / 11); ctx.lineTo(w * .5, h * .5); ctx.lineTo(w, h * i / 11); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#d5b16a'; ctx.font = 'italic 118px Georgia'; ctx.fillText('Ultima gheară', w / 2, 216); ctx.font = '21px Arial'; ctx.fillStyle = '#8c8169'; ctx.fillText('A I C I   P I E R Z I   D O A R   V R E M E A .', w / 2, 321);
    });
    mesh(g, new THREE.PlaneGeometry(1.39, .69), new THREE.MeshPhysicalMaterial({ map: lower.texture, emissiveMap: lower.texture, emissive: 0xffffff, emissiveIntensity: .2, roughness: .21, clearcoat: 1, metalness: .3 }), 0, .67, .473);
    const lock = mesh(g, new THREE.CylinderGeometry(.027, .027, .018, 16), chrome, .682, .873, .488); lock.rotation.x = PI / 2;
    box(g, .004, .024, .003, black, .682, .873, .5, .001);
    box(g, 1.16, .125, .18, chrome, 0, .265, .5, .03);
    box(g, 1.02, .069, .115, black, 0, .292, .567, .02);
    for (let i = 0; i < 17; i++) box(g, .031, .003, .096, rubber, -.46 + i * .057, .325, .562, .001);
    border(g, 1.71, .041, .015, 0, .194, .718, orange, .005);
    for (const xx of [-.80, .80]) for (const yy of [.41, 1.0, 1.58, 2.53, 3.22]) {
      const screw = mesh(g, new THREE.CylinderGeometry(.012, .012, .005, 10), chrome, xx, yy, .49); screw.rotation.x = PI / 2;
      box(g, .014, .002, .002, black, xx, yy, .494, .0004);
    }
    for (let i = 0; i < 13; i++) box(g, .006, .08, .055, black, -.31 + i * .052, 3.397, .297, .001);
    label(g, '007', .11, .048, .69, 3.399, .363, '#9a9587', 150);
    batchStatic(g);
    // Other cabinets are complete but sit beyond the focal plane.
    const backgroundScreen = canvasTexture(768, 576, (ctx, w, h) => ctx.drawImage(this.screen.canvas, 0, 0, w, h));
    const backgroundDisplayMaterial = displayMaterial.clone(); backgroundDisplayMaterial.map = backgroundScreen.texture; backgroundDisplayMaterial.emissiveMap = backgroundScreen.texture;
    for (const [x, z, rotation, color] of [[-3.05,-2.7,.13,'red'],[3.3,-3.3,-.14,'teal'],[5.25,-4.1,-.15,'red']]) {
      const other = g.clone(true); other.position.set(x, 0, z); other.rotation.y = rotation; other.scale.setScalar(.95);
      other.traverse(object => { if (object.isMesh) { object.userData = {}; if (object.material === orange) object.material = this.m[color]; if (object.material === displayMaterial) object.material = backgroundDisplayMaterial; } });
      this.scene.add(other);
    }
  }
  room() {
    const room = new THREE.Group(); this.scene.add(room); const { gold, chrome, black, rubber } = this.m;
    const carpet = new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: .94, bumpMap: noiseTexture('leather'), bumpScale: .004 });
    const floor = mesh(room, new THREE.PlaneGeometry(40, 40), carpet, 0, -.015, 0); floor.rotation.x = -PI / 2;
    // Polished stone under the cabinets catches their actual planar reflections.
    const stone = new THREE.MeshPhysicalMaterial({ color: '#14151c', roughness: .22, metalness: .35, clearcoat: .55 });
    box(room, 15, .035, 4.8, stone, 0, .005, -1.4, .008);
    this.reflector = new Reflector(new THREE.PlaneGeometry(15, 4.8), { clipBias: .003, textureWidth: this.mobile ? 384 : 768, textureHeight: this.mobile ? 384 : 768, color: 0x393039, multisample: 0 });
    this.reflector.rotation.x = -PI / 2; this.reflector.position.set(0, .026, -1.4); this.scene.add(this.reflector);
    const reflect = this.reflector.onBeforeRender;
    let reflectedFrame = -1;
    this.reflector.onBeforeRender = (renderer, scene, camera, ...args) => {
      // Glass transmission and the depth pass revisit this mesh. Only the
      // first color visit needs a fresh reflection of the same scene/camera.
      if (scene.overrideMaterial || reflectedFrame === this.renderSerial) return;
      reflectedFrame = this.renderSerial; this.stats.reflections++;
      reflect.call(this.reflector, renderer, scene, camera, ...args);
    };
    this.reflector.material.fragmentShader = this.reflector.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( blendOverlay( base.rgb, color ) * 0.36, 1.0 );');
    for (let x = -7; x < 8; x += 1.2) box(room, .009, .002, 4.8, black, x, .029, -1.4, .001);
    for (let z = -3.8; z <= 1; z += 1.2) box(room, 15, .002, .009, black, 0, .03, z, .001);
    // Paneled back wall, brass reveals and a low illuminated skirting.
    const wallMat = new THREE.MeshStandardMaterial({ color: '#1d1720', roughness: .82, bumpMap: noiseTexture('leather'), bumpScale: .012 });
    box(room, 22, 7, .12, wallMat, 0, 3.5, -5.7, .01);
    for (let x = -10; x <= 10; x += 1.2) {
      box(room, .025, 4.5, .03, gold, x, 2.25, -5.61, .003);
      border(room, .99, 3.5, .05, x + .6, 2.4, -5.6, gold, .006);
    }
    box(room, 22, .18, .11, black, 0, .13, -5.57, .005);
    box(room, 22, .012, .023, this.m.orange, 0, .245, -5.50, .003);
    box(room, 22, .022, .06, gold, 0, 4.4, -5.57, .003);
    // Ribbed wall fixtures produce warm pools of light.
    for (const x of [-4.7, 0, 4.7]) {
      box(room, .18, .8, .13, gold, x, 3.15, -5.44, .035);
      for (let i = 0; i < 5; i++) box(room, .018, .7, .13, this.m.orange, x - .063 + i * .031, 3.15, -5.345, .005);
    }
    const notice = canvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#111717'; ctx.fillRect(0, 0, w, h); rounded(ctx, 20, 20, w - 40, h - 40, 10, null, '#8b8661', 3); ctx.textAlign = 'center'; ctx.fillStyle = '#c9ba8b'; ctx.font = '60px Georgia'; ctx.fillText('NE VEDEM AFARĂ.', w / 2, 212); ctx.font = '25px Arial'; ctx.fillStyle = '#8b886c'; ctx.fillText('PROGRAM: ULTIMA DATĂ', w / 2, 302);
    });
    mesh(room, new THREE.PlaneGeometry(1.65, .825), new THREE.MeshStandardMaterial({ map: notice.texture, emissiveMap: notice.texture, emissive: '#cbd4a1', emissiveIntensity: .22, roughness: .5 }), -2.15, 3.52, -5.59);
    // A leather pedestal stool, pulled aside so the entire cabinet stays visible.
    const stool = new THREE.Group(); room.add(stool); stool.position.set(1.37, 0, 1.15); stool.rotation.y = -.28;
    const base = mesh(stool, new THREE.CylinderGeometry(.43, .46, .065, 48), chrome, 0, .058, 0);
    mesh(stool, new THREE.CylinderGeometry(.42, .44, .025, 48), rubber, 0, .022, 0);
    mesh(stool, new THREE.CylinderGeometry(.073, .095, .72, 24), chrome, 0, .43, 0);
    mesh(stool, new THREE.CylinderGeometry(.11, .12, .17, 24), black, 0, .2, 0);
    const footRing = mesh(stool, new THREE.TorusGeometry(.31, .023, 10, 48), chrome, 0, .31, 0); footRing.rotation.x = PI / 2;
    for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; tube(stool, [[0,.31,0],[Math.cos(a)*.31,.31,Math.sin(a)*.31]], .012, chrome); }
    mesh(stool, new THREE.CylinderGeometry(.39, .35, .13, 48), black, 0, .84, 0);
    box(stool, .84, .19, .71, this.m.leather, 0, .955, 0, .095);
    box(stool, .81, .025, .70, gold, 0, .867, 0, .012);
    for (const xx of [-.3, .3]) tube(stool, [[xx,.82,-.22],[xx,1.04,-.38],[xx,1.50,-.40]], .027, chrome, true);
    const back = box(stool, .81, .60, .13, this.m.leather, 0, 1.41, -.39, .064); back.rotation.x = -.09;
    border(stool, .73, .51, .08, 0, 1.41, -.308, gold, .0035);
    for (const xx of [-.21, 0, .21]) for (const yy of [1.30,1.49]) { const stud = mesh(stool, new THREE.SphereGeometry(.016, 8, 6), black, xx, yy, -.305); stud.scale.z = .25; }
    // Contact shadows remain soft and grounded on mobile, too.
    const shadowTex = canvasTexture(128, 128, ctx => { const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64); grad.addColorStop(0, '#000000dc'); grad.addColorStop(.5, '#00000080'); grad.addColorStop(1, '#00000000'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128); }).texture;
    for (const [x,z,w,h] of [[0,.03,2.7,2.0],[1.37,1.15,1.25,1.25]]) {
      const shadow = mesh(room, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }), x, .037, z); shadow.rotation.x = -PI / 2; shadow.castShadow = false;
    }
    tube(room, [[-.55,.045,-.4],[-.9,.045,-.7],[-1.25,.045,-.6],[-1.4,.045,-1.3],[-1.2,.045,-2.4],[-1.3,.045,-5.5]], .018, rubber, true);
    batchStatic(room);
  }
  lights() {
    this.scene.add(new THREE.HemisphereLight('#919bbd', '#26151a', .55));
    const key = new THREE.SpotLight('#ffdfb3', 45, 18, .59, .65, 1.4); key.position.set(-3.4, 6.3, 4.2); key.target.position.set(0, 1.5, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0002; key.shadow.normalBias = .02; key.shadow.radius = 4; this.scene.add(key, key.target);
    const rim = new THREE.SpotLight('#8fb6ff', 48, 15, .62, .8, 1.5); rim.position.set(3.8, 4.8, -1.3); rim.target.position.set(0, 1.7, 0); this.scene.add(rim, rim.target);
    this.faceLight = new THREE.PointLight('#ffc378', 4.5, 4, 2); this.faceLight.position.set(0, 2.0, 1.0); this.scene.add(this.faceLight);
    const floorGlow = new THREE.PointLight('#fbaa44', 1.8, 2.8, 2); floorGlow.position.set(0, .23, .94); this.scene.add(floorGlow);
    for (const [x,y,z,color,power] of [[-3,2,-1.5,'#ff234d',13],[3.3,2.5,-2.3,'#24bcdb',10],[-4.7,3.2,-5,'#ffbc67',15],[0,3.2,-5,'#ffbc67',12],[4.7,3.2,-5,'#ffbc67',12]]) { const light = new THREE.PointLight(color, power, 5, 2); light.position.set(x,y,z); this.scene.add(light); }
  }
  post() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new CachedBokehPass(this.scene, this.camera, { focus: 8.1, aperture: .00125, maxblur: .009 }); this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .23, .45, 1.3); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new FXAAPass());
    this.film = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){vec3 c=texture2D(tDiffuse,vUv).rgb; float vig=1.0-0.25*pow(length((vUv-0.5)*1.25),2.0); gl_FragColor=vec4(c*vig,1.0);}' });
    this.composer.addPass(this.film);
  }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight; this.mobile = w <= 900;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h); this.composer.setSize(w, h); this.camera.aspect = w / h;
    this.camera.fov = this.mobile ? 38 : 33;
    this.baseCamera = this.mobile ? new THREE.Vector3(1.9, 2.7, 8.35) : new THREE.Vector3(3.1, 2.9, 7.5);
    this.lookAt = this.mobile ? new THREE.Vector3(0, 1.79, 0) : new THREE.Vector3(-1.04, 1.66, 0);
    if (this.mobile) {
      // Keep the whole cabinet between the title and the controls on narrow phones.
      const aspectFit = Math.max(1, .49 / this.camera.aspect); this.baseCamera.multiplyScalar(aspectFit); this.baseCamera.y = 2.65;
      this.camera.setViewOffset(w, h, 0, -h * .015, w, h);
    } else this.camera.clearViewOffset();
    if (w / h > 1.5 && h < 530) {
      this.camera.fov = 39;
      this.baseCamera.set(3.1, 2.9, 8.1);
      this.lookAt.set(-1.45, 1.66, 0);
      this.camera.clearViewOffset();
    }
    this.camera.position.copy(this.baseCamera); this.camera.lookAt(this.lookAt); this.camera.updateProjectionMatrix();
    this.bokeh.uniforms.aspect.value = w / h;
    this.bokeh.uniforms.focus.value = this.camera.position.distanceTo(new THREE.Vector3(0, 1.9, .5));
    this.invalidate({ depth: true });
  }
  events() {
    window.addEventListener('resize', () => this.resize());
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', event => { this.drag = { x: event.clientX, y: event.clientY, yaw: this.targetYaw, moved: false, id: event.pointerId }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (this.drag) { const delta = event.clientX - this.drag.x; if (Math.abs(delta) + Math.abs(event.clientY - this.drag.y) > 6) this.drag.moved = true; this.targetYaw = THREE.MathUtils.clamp(this.drag.yaw - delta * .0025, -.4, .32); this.onInvalidate?.(); }
      else { const hit = this.hit(event); canvas.style.cursor = hit ? 'pointer' : 'grab'; }
    });
    canvas.addEventListener('pointerup', event => {
      if (this.drag && !this.drag.moved) { const hit = this.hit(event); if (hit) { this.press(hit); this.onAction?.(hit.userData.action); } }
      this.drag = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; document.getElementById('webgl-error').hidden = false; });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }
  hit(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect(); this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera); return this.raycaster.intersectObjects(this.buttons, false)[0]?.object;
  }
  press(button = this.buttons.at(-1)) { this.presses.push({ button, start: performance.now() }); this.onInvalidate?.(); }
  render(now) {
    if (this.lost) return;
    const cameraMoving = Math.abs(this.targetYaw - this.yaw) > .00001;
    const elapsed = this.lastAnimationTime == null ? 1000 / 60 : Math.min(100, now - this.lastAnimationTime);
    this.lastAnimationTime = now;
    if (cameraMoving) {
      this.yaw += (this.targetYaw - this.yaw) * (1 - Math.pow(.92, elapsed / (1000 / 60)));
      if (Math.abs(this.targetYaw - this.yaw) <= .00001) this.yaw = this.targetYaw;
      this.dirty = true; this.bokeh.depthNeedsUpdate = true;
    }
    const position = this.cameraOffset.copy(this.baseCamera).sub(this.lookAt).applyAxisAngle(this.upAxis, this.yaw).add(this.lookAt);
    this.camera.position.copy(position); this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld();
    const animatedGeometry = this.effects.group.visible;
    this.effects.update(now, this.width, this.height);
    if (animatedGeometry || this.effects.group.visible) { this.dirty = true; this.bokeh.depthNeedsUpdate = true; }
    if (this.presses.length) { this.dirty = true; this.bokeh.depthNeedsUpdate = true; this.renderer.shadowMap.needsUpdate = true; }
    for (const press of this.presses) {
      const t = (now - press.start) / 220, amount = Math.sin(Math.min(t, 1) * PI) * .024;
      press.button.position.y = press.button.userData.restY - amount;
      press.button.userData.print.position.y = press.button.userData.printY - amount;
    }
    this.presses = this.presses.filter(press => now - press.start < 220);
    this.m.orange.emissiveIntensity = 2.3 + this.effects.energy * 1.2;
    this.faceLight.intensity = 4.5 + this.effects.energy * 6;
    this.bloom.strength = .23 + this.effects.energy * .2;
    if (this.screen.texture.version !== this.screenVersion) { this.dirty = true; this.screenVersion = this.screen.texture.version; }
    if (!this.dirty) return false;
    this.renderSerial++; this.stats.renders++;
    if (this.bokeh.depthNeedsUpdate) this.stats.depths++;
    if (this.renderer.shadowMap.needsUpdate) this.stats.shadows++;
    this.renderer.info.reset();
    this.composer.render();
    this.dirty = false;
    if (this.lastFrame && now - this.lastFrame < 100 && this.frameCount < 90) { this.frameTotal += now - this.lastFrame; this.frameCount++; }
    this.lastFrame = now;
    if (this.frameCount === 90 && !this.qualityAdjusted) {
      this.qualityAdjusted = true;
      if (this.frameTotal / 90 > 40) { this.renderer.setPixelRatio(1); this.composer.setPixelRatio(1); this.resize(); }
    }
    return true;
  }
}
