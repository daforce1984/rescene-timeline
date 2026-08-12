/**
 * 브라우저 없이 js/main.js 를 통째로 실행해 런타임 오류를 잡는 검사기.
 *
 *   node tools/check.mjs
 *
 * 실제 three.js 로 씬을 다 만들고, 3D 라벨·HUD 버튼·키보드·포인터 이벤트를
 * 전부 눌러 본 뒤 렌더 루프를 60프레임 돌린다. GL 컨텍스트가 필요한
 * WebGLRenderer / EffectComposer / CSS2DRenderer 만 스텁으로 가린다.
 *
 * 최초 실행 시 three.module.js 를 CDN 에서 tools/ 아래로 내려받는다.
 */
import './dom.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || path.join(HERE, '..', 'js');
const THREE_FILE = path.join(HERE, 'three.module.js');

if (!fs.existsSync(THREE_FILE)) {
  const url = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
  process.stdout.write(`three.module.js 내려받는 중… `);
  const res = await fetch(url);
  if (!res.ok) { console.error('실패:', res.status); process.exit(1); }
  fs.writeFileSync(THREE_FILE, Buffer.from(await res.arrayBuffer()));
  console.log('완료');
}

// import 지정자만 하네스 쪽으로 바꿔 임시 복사본을 만든다
fs.mkdirSync(path.join(HERE, '.tmp'), { recursive: true });
for (const f of ['data.js', 'main.js']) {
  let src = fs.readFileSync(path.join(SRC, f), 'utf8');
  src = src.replace(/from ['"]three['"]/g, `from '${pathToFileURL(path.join(HERE, 'three-shim.mjs')).href}'`);
  src = src.replace(/from ['"]three\/addons\/[^'"]+['"]/g, `from '${pathToFileURL(path.join(HERE, 'addons.mjs')).href}'`);
  fs.writeFileSync(path.join(HERE, '.tmp', f), src);
}

let failed = false;
process.on('uncaughtException', (e) => { console.error('❌ 런타임 오류:', e.stack); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error('❌ 미처리 거부:', e); process.exit(1); });

try {
  await import(pathToFileURL(path.join(HERE, '.tmp', 'main.js')).href);
} catch (e) {
  console.error('❌ 모듈 실행 실패:');
  console.error(e.stack);
  failed = true;
}
if (failed) process.exit(1);

const { byId, handlers, frames, fakeClock, audios } = await import('./dom.mjs');
console.log('✅ 모듈 실행 통과 — body.is-ready:', globalThis.document.body.classList.contains('is-ready'),
            '· DOM id', byId.size, '· 핸들러', handlers.length);

const step = (n = 1, ms = 50) => { for (let i = 0; i < n; i++) { fakeClock.t += ms; const f = frames.shift(); if (f) f(fakeClock.t); } };

const api = globalThis.window.__rescene;
const reset = globalThis.document.getElementById('btn-reset');
handlers.filter(h => h.el === reset && h.type === 'click').forEach(h => h.fn({ stopPropagation() {} }));
step(140);   // 전체 보기로 안착

const V = api.THREE.Vector3;
const cam = api.camera;
cam.updateMatrixWorld();
const W = 1280, H = 720;
const boxes = [];
const walk = (o) => {
  if (o.isCSS2DObject && o.element) {
    const el = o.element;
    const cls = (el.className || '') + ' ' + [...(el._classes || [])].join('.');
    let vis = true;
    for (let p = o; p; p = p.parent) if (p.visible === false) { vis = false; break; }
    const hidden = /\bis-minor\b|\bis-far\b/.test(cls);
    const v = o.getWorldPosition(new V()).project(cam);
    if (vis && !hidden && v.z <= 1) boxes.push({
      cls, txt: (el.textContent || '').slice(0, 30).replace(/\s+/g, ' '),
      x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H,
    });
  }
  for (const c of o.children || []) walk(c);
};
walk(api.declutter[0].obj.parent ? rootOf(api.declutter[0].obj) : {children: []});
function rootOf(o) { let r = o; while (r.parent) r = r.parent; return r; }
console.log('보이는 라벨', boxes.length);
const sizeOf = (c) => c.includes('tick-label') ? [32, 16]
  : c.includes('ghostline-label') ? [90, 22]
  : c.includes('fork-label') ? [72, 24]
  : c.includes('era-label') && c.includes('is-compact') ? [80, 26]
  : c.includes('era-label') ? [130, 66]
  : c.includes('period-label') ? [150, 34]
  : c.includes('mv-card') ? [126, 98]
  : c.includes('node-label') ? [176, 58]
  : c.includes('channel-mark') ? [150, 44]
  : c.includes('chip') ? [96, 24] : [120, 34];
let pairs = 0;
for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
  const a = boxes[i], b = boxes[j];
  const [aw, ah] = sizeOf(a.cls), [bw, bh] = sizeOf(b.cls);
  if (Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.y - b.y) < (ah + bh) / 2) {
    pairs++;
    console.log(`  겹침 · ${a.cls} "${a.txt}" (${a.x|0},${a.y|0})\n         ${b.cls} "${b.txt}" (${b.x|0},${b.y|0})`);
  }
}
console.log('겹치는 쌍', pairs);
for (const b of boxes) console.log(`   ${String(b.x|0).padStart(5)},${String(b.y|0).padStart(4)}  ${b.cls.trim()}  |  ${b.txt}`);
process.exit(0);
