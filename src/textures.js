import * as THREE from 'three';

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); draw?.(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}
export function rounded(ctx, x, y, w, h, radius, fill, stroke, lineWidth = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}
function text(ctx, value, x, y, size, color, font = 'Arial', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y);
}
function gradient(ctx, x, y, radius, stops) {
  const grad = ctx.createRadialGradient(x - radius * .28, y - radius * .38, radius * .03, x, y, radius);
  stops.forEach(([offset, color]) => grad.addColorStop(offset, color)); return grad;
}
function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 2) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -.12, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function leaf(ctx, x, y, size, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const grad = ctx.createLinearGradient(0, 0, size, size); grad.addColorStop(0, '#b3ec54'); grad.addColorStop(.5, '#3d8e21'); grad.addColorStop(1, '#124119');
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(size * .2, -size * .7, size, -size * .6, size, 0); ctx.bezierCurveTo(size * .7, size * .35, size * .1, size * .3, 0, 0); ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = '#b6d862'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * .85, -size * .06); ctx.stroke(); ctx.restore();
}
export function createSymbols() {
  return Array.from({ length: 6 }, (_, type) => canvasTexture(256, 256, ctx => {
    ctx.save(); ctx.shadowColor = '#26130980'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 6;
    if (type === 0) {
      ctx.strokeStyle = '#435523'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(83, 147); ctx.bezierCurveTo(99, 88, 139, 96, 149, 43); ctx.moveTo(167, 162); ctx.bezierCurveTo(166, 112, 155, 89, 149, 43); ctx.stroke();
      leaf(ctx, 145, 49, 58, 2.8);
      [[83, 163, 46], [164, 177, 43]].forEach(([x, y, r]) => {
        ellipse(ctx, x, y, r, r * .94, gradient(ctx, x, y, r, [[0, '#ff8c87'], [.2, '#f94043'], [.56, '#cc0f29'], [1, '#650320']]), '#ffdcc3', 3);
        ellipse(ctx, x - 13, y - 16, 10, 5, '#fff2dba0');
      });
    } else if (type === 1) {
      ctx.save(); ctx.translate(128, 143); ctx.rotate(-.45);
      ctx.beginPath(); ctx.moveTo(-85, 0); ctx.bezierCurveTo(-60, -12, -65, -59, 0, -58); ctx.bezierCurveTo(58, -61, 68, -10, 85, 0); ctx.bezierCurveTo(65, 15, 60, 58, 0, 58); ctx.bezierCurveTo(-59, 60, -65, 14, -85, 0);
      ctx.fillStyle = gradient(ctx, 0, 0, 80, [[0, '#ffffc4'], [.25, '#fff45c'], [.6, '#f6c823'], [1, '#bf7612']]); ctx.fill(); ctx.strokeStyle = '#fffbd2'; ctx.lineWidth = 3; ctx.stroke();
      ctx.shadowBlur = 0; for (let i = 0; i < 60; i++) { ctx.fillStyle = '#bb8f2020'; ctx.fillRect(Math.sin(i * 13) * 58, Math.cos(i * 9) * 35, 2, 2); }
      ctx.restore(); leaf(ctx, 162, 90, 52, -.35);
    } else if (type === 2) {
      leaf(ctx, 117, 62, 67, -.1); leaf(ctx, 130, 58, 56, 2.7);
      [[101, 94], [145, 95], [79, 127], [124, 132], [170, 129], [101, 167], [145, 169], [124, 203]].forEach(([x, y]) => {
        ellipse(ctx, x, y, 27, 29, gradient(ctx, x, y, 29, [[0, '#e5b7fd'], [.27, '#a153ce'], [.6, '#6b268e'], [1, '#301051']]), '#f3d9fa', 1.5);
        ellipse(ctx, x - 7, y - 12, 5, 3, '#ffeaff99');
      });
    } else if (type === 3) {
      ctx.save(); ctx.translate(128, 104); ctx.rotate(-.18);
      ctx.beginPath(); ctx.arc(0, 0, 91, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#1c6731'; ctx.fill(); ctx.strokeStyle = '#faffc7'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 79, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#ddf291'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 69, 0, Math.PI); ctx.closePath(); ctx.fillStyle = gradient(ctx, 0, 20, 95, [[0, '#ffada0'], [.35, '#fa514b'], [1, '#c30e35']]); ctx.fill();
      for (let i = 0; i < 7; i++) { const a = (i + 1) / 8 * Math.PI; ellipse(ctx, Math.cos(a) * 48, Math.sin(a) * 48, 3, 6, '#501828'); }
      ctx.restore();
    } else if (type === 4) {
      ctx.font = 'italic bold 204px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 15; ctx.strokeStyle = '#734214'; ctx.strokeText('7', 124, 136);
      ctx.lineWidth = 10; ctx.strokeStyle = '#f4df96'; ctx.strokeText('7', 124, 132);
      ctx.lineWidth = 4; ctx.strokeStyle = '#7a1224'; ctx.strokeText('7', 124, 132);
      const grad = ctx.createLinearGradient(0, 40, 0, 220); grad.addColorStop(0, '#ffbe9c'); grad.addColorStop(.3, '#f44b4c'); grad.addColorStop(.55, '#b71026'); grad.addColorStop(.75, '#fb3d3e'); grad.addColorStop(1, '#780c23');
      ctx.fillStyle = grad; ctx.fillText('7', 124, 132);
      ctx.shadowBlur = 0; ctx.globalAlpha = .5; ctx.font = 'italic bold 197px Georgia'; ctx.lineWidth = 1; ctx.strokeStyle = '#ffcfac'; ctx.strokeText('7', 123, 127);
    } else {
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2; const r = i % 2 ? 42 : 94; ctx.lineTo(128 + Math.cos(a) * r, 132 + Math.sin(a) * r); } ctx.closePath();
      ctx.fillStyle = gradient(ctx, 128, 125, 110, [[0, '#ffffda'], [.25, '#ffe990'], [.55, '#eeb330'], [.8, '#b66f14'], [1, '#fde89b']]); ctx.fill(); ctx.strokeStyle = '#fff1b3'; ctx.lineWidth = 4; ctx.stroke();
      text(ctx, '★', 129, 134, 81, '#93641e', 'Georgia');
    }
    ctx.restore();
  }).canvas);
}

export function createMarquee() {
  return canvasTexture(1536, 704, (ctx, w, h) => {
    const bg = ctx.createRadialGradient(w / 2, h * .56, 10, w / 2, h / 2, 780); bg.addColorStop(0, '#583119'); bg.addColorStop(.45, '#23150e'); bg.addColorStop(1, '#080807'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b89a5360'; ctx.lineWidth = 2;
    for (let i = 0; i < 45; i++) { const a = i / 45 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a) * 220, h * .55 + Math.sin(a) * 130); ctx.lineTo(w / 2 + Math.cos(a) * 950, h * .55 + Math.sin(a) * 680); ctx.stroke(); }
    for (let i = 0; i < 3; i++) rounded(ctx, 24 + i * 11, 22 + i * 9, w - 48 - i * 22, h - 44 - i * 18, 18, null, i === 1 ? '#d5ad63' : '#7d542d', i === 1 ? 3 : 1);
    text(ctx, 'U L T I M A   G H E A R Ă', w / 2, 105, 49, '#f8dfac', 'Georgia');
    const gold = ctx.createLinearGradient(0, 190, 0, 510); gold.addColorStop(0, '#ffffd4'); gold.addColorStop(.3, '#f6d489'); gold.addColorStop(.49, '#d89a45'); gold.addColorStop(.52, '#845021'); gold.addColorStop(.75, '#f9df99'); gold.addColorStop(1, '#aa7131');
    ctx.font = 'italic bold 352px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160b06'; ctx.lineWidth = 19; ctx.strokeText('777', w / 2, 369); ctx.strokeStyle = '#cf9b51'; ctx.lineWidth = 4; ctx.strokeText('777', w / 2, 365); ctx.fillStyle = gold; ctx.fillText('777', w / 2, 365);
    rounded(ctx, 378, 557, 780, 80, 5, '#100d09', '#8d693a', 2);
    text(ctx, 'N O R O C U L   N U   S E   M U T Ă   O N L I N E', w / 2, 599, 24, '#dcbd82');
    text(ctx, '★', 197, 595, 37, '#ddb774', 'Georgia'); text(ctx, '★', w - 197, 595, 37, '#ddb774', 'Georgia');
  });
}

export class Screen {
  constructor() {
    Object.assign(this, canvasTexture(1536, 1152));
    this.symbols = createSymbols();
    this.grid = [[0, 4, 1], [2, 4, 0], [1, 4, 3], [3, 4, 2], [0, 4, 1]];
    this.animation = null; this.result = null;
  }
  start(result, now, reducedMotion) {
    this.result = null;
    this.animation = { start: now, durations: [0, 1, 2, 3, 4].map(i => reducedMotion ? 380 + i * 110 : 1750 + i * 260), columns: result.grid.map((target, i) => {
      const filler = Array.from({ length: 22 + i * 4 }, (_, j) => (j * 7 + i * 3 + (j % 4)) % 6);
      return [...this.grid[i], ...filler, ...target];
    }), result, stopped: new Set() };
  }
  draw(now, game, onStop = () => {}) {
    const { ctx, canvas } = this; const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#061a17'; ctx.fillRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 1000); bg.addColorStop(0, '#13503a'); bg.addColorStop(1, '#040e0c'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    rounded(ctx, 20, 20, w - 40, h - 40, 18, null, '#b69a5e', 4);
    text(ctx, 'Ș E P T A R I I   D E   A D I O', w / 2, 85, 52, '#ffe1a1', 'Georgia');
    text(ctx, '3 LINII  •  5 ROLE  •  ZERO BANI REALI', w / 2, 145, 21, '#bfae7c');
    const x = 75, y = 210, gap = 13, cw = (w - 150 - gap * 4) / 5, ch = 239;
    for (let col = 0; col < 5; col++) {
      const left = x + col * (cw + gap);
      rounded(ctx, left - 4, y - 5, cw + 8, ch * 3 + 10, 12, '#c49b4d');
      ctx.save(); ctx.beginPath(); ctx.roundRect(left, y, cw, ch * 3, 8); ctx.clip();
      const paper = ctx.createLinearGradient(left, 0, left + cw, 0); paper.addColorStop(0, '#c3c1a1'); paper.addColorStop(.17, '#f2f0d6'); paper.addColorStop(.5, '#fffde4'); paper.addColorStop(.83, '#f2f0d6'); paper.addColorStop(1, '#c4c1a6'); ctx.fillStyle = paper; ctx.fillRect(left, y, cw, ch * 3);
      let strip = this.grid[col], position = 0;
      if (this.animation) {
        const a = this.animation, t = Math.min(1, Math.max(0, (now - a.start) / a.durations[col]));
        strip = a.columns[col];
        const ease = 1 - Math.pow(1 - t, 3);
        position = (strip.length - 3) * ease;
        if (t === 1 && !a.stopped.has(col)) { a.stopped.add(col); onStop(col); }
      }
      const first = Math.floor(position), fraction = position - first;
      for (let row = -1; row < 4; row++) {
        const index = first + row;
        if (index < 0 || index >= strip.length) continue;
        const yy = y + (row - fraction) * ch;
        ctx.drawImage(this.symbols[strip[index]], left + 13, yy + 3, cw - 26, ch - 6);
      }
      const shade = ctx.createLinearGradient(0, y, 0, y + ch * 3); shade.addColorStop(0, '#0a130f77'); shade.addColorStop(.12, '#182b1010'); shade.addColorStop(.44, '#ffffff00'); shade.addColorStop(.57, '#ffffff00'); shade.addColorStop(.86, '#182b1010'); shade.addColorStop(1, '#0a130f77'); ctx.fillStyle = shade; ctx.fillRect(left, y, cw, ch * 3);
      ctx.strokeStyle = '#4e603127'; ctx.lineWidth = 2; for (let row = 1; row <= 2; row++) { ctx.beginPath(); ctx.moveTo(left, y + row * ch); ctx.lineTo(left + cw, y + row * ch); ctx.stroke(); }
      ctx.restore();
    }
    if (this.result?.payout) {
      for (const line of this.result.lines) {
        ctx.strokeStyle = '#ffff94'; ctx.shadowColor = '#ffd12e'; ctx.shadowBlur = 15; ctx.lineWidth = 5;
        rounded(ctx, x - 4, y + line.row * ch + 3, (cw + gap) * line.count - gap + 8, ch - 6, 12, '#ffe26816', '#ffe879', 5);
      }
      ctx.shadowBlur = 0;
    }
    const banner = this.result?.jackpot ? 'AI SPART BANCA!' : this.result?.bonus ? 'MI-A DAT SPECIALA!' : this.result?.payout ? `MI-A DAT LINIE!  +${this.result.payout} LEI` : this.animation ? 'HAI CU ȘEPTARII!' : 'MAI DAU O GHEARĂ ȘI PLEC.';
    text(ctx, banner, w / 2, 982, 30, this.result?.payout ? '#ffe485' : '#c7b788');
    rounded(ctx, 75, 1020, w - 150, 91, 7, '#040a09', '#57714b');
    [['CREDIT', game.credit], ['MIZĂ', game.bet], ['CÂȘTIG', game.lastWin]].forEach(([label, value], i) => {
      const xx = 310 + i * 460; text(ctx, label, xx, 1044, 18, '#bfae82'); text(ctx, `${value}`, xx, 1081, 38, '#ffebc0');
    });
    this.texture.needsUpdate = true;
    if (this.animation?.stopped.size === 5) { const result = this.animation.result; this.grid = result.grid; this.animation = null; this.result = result; return result; }
    return null;
  }
}

export function noiseTexture(kind = 'metal') {
  const { ctx, texture } = canvasTexture(256, 256);
  let seed = 573; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const data = ctx.createImageData(256, 256);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = kind === 'leather' ? 100 + random() * 110 : 170 + random() * 60;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = n; data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  if (kind === 'metal') { ctx.strokeStyle = '#ffffff17'; ctx.lineWidth = .5; for (let i = 0; i < 180; i++) { ctx.beginPath(); const y = random() * 256; ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); } }
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3); texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  return texture;
}
export function carpetTexture() {
  const { texture } = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = '#29171c'; ctx.fillRect(0, 0, 512, 512);
    let seed = 218; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 50000; i++) { ctx.fillStyle = ['#72464720', '#00000030', '#ba8e6720'][i % 3]; ctx.fillRect(random() * 512, random() * 512, 1, 2); }
    ctx.strokeStyle = '#9a73582e'; ctx.lineWidth = 2;
    for (let x = 0; x < 600; x += 128) for (let y = 0; y < 600; y += 128) {
      ctx.beginPath(); ctx.moveTo(x, y - 52); ctx.lineTo(x + 52, y); ctx.lineTo(x, y + 52); ctx.lineTo(x - 52, y); ctx.closePath(); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(x, y); ctx.rotate(i * Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -11, 4, 12, 0, 0, Math.PI * 2); ctx.fillStyle = '#bb925938'; ctx.fill(); ctx.restore(); }
    }
  }); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(10, 10); return texture;
}
