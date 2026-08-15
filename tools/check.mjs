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
const { MVS, RADIO, DRIVE } = await import(pathToFileURL(path.join(HERE, '.tmp', 'data.js')).href);
const MVS_NAME = Object.fromEntries(MVS.map((m) => [m.id, m.song]));
console.log('✅ 모듈 실행 통과 — body.is-ready:', globalThis.document.body.classList.contains('is-ready'),
            '· DOM id', byId.size, '· 핸들러', handlers.length);

const step = (n = 1, ms = 50) => { for (let i = 0; i < n; i++) { fakeClock.t += ms; const f = frames.shift(); if (f) f(fakeClock.t); } };
let errs = 0;
const fire = (label, pred, ev = {}) => {
  const hit = handlers.filter(pred);
  if (!hit.length) { console.log(`   ⚠ ${label}: 핸들러 없음`); return; }
  for (const h of hit) {
    try { h.fn({ stopPropagation() {}, preventDefault() {}, button: 0, clientX: 10, clientY: 10, target: h.el, ...ev }); }
    catch (e) { errs++; console.log(`   ❌ ${label}: ${e.message}`); }
  }
  try { step(2); } catch (e) { errs++; console.log(`   ❌ ${label} 이후 루프: ${e.message}`); }
};
const byIdEl = (id) => byId.get(id);
const clickOn = (id) => fire(`click #${id}`, (h) => h.el === byIdEl(id) && h.type === 'click');

// 1) 3D 라벨 클릭 — selectEvent / selectRadio / openMv 경로
const labels = handlers.filter((h) => h.type === 'click' && !byId.has(h.el.id) && h.el !== window && h.el !== document);
console.log(`\n▸ 3D 라벨/칩 클릭 ${labels.length}개`);
for (const h of labels) {
  try { h.fn({ stopPropagation() {}, preventDefault() {}, target: h.el }); step(1); }
  catch (e) { errs++; console.log(`   ❌ ${e.message}`); }
}

// 2) HUD 버튼
console.log('▸ HUD 버튼');
for (const id of ['btn-mv', 'mvgal-close', 'btn-era-past', 'btn-era-2024', 'btn-era-2025',
                  'btn-era-2026', 'btn-reset', 'btn-next', 'btn-prev', 'panel-close', 'player-close']) clickOn(id);

// 재생 연출 — 켜고 길게 돌린 뒤 끈다
console.log('▸ 재생 연출');
// 배경음은 mp3 가 아니라 공식 MV 다 (저작권 · 유튜브 약관 둘 다 지키는 길)
const bgm = globalThis.window.__rescene.bgm;
const ytBgm = /youtube\.com\/watch\?v=/.test(bgm.src || '');
console.log(`   배경음: ${bgm.src} · loop=${bgm.loop} ${ytBgm && bgm.loop ? '✅ 공식 MV' : '❌'}`);
if (!ytBgm || !bgm.loop) errs++;
{
  // 기본은 한 곡 고정 — 곡이 도중에 안 바뀌어야 한다.
  // 그 아래 곡 순서 검사는 「시간선」 쪽 길을 재는 것이므로, 여기서 한 번 넘겨 놓는다.
  const bm = globalThis.window.__rescene.bgmMode;
  const def = bm.one === true && (bm.el.textContent || '').trim() === '한 곡';
  console.log(`   배경음 기본 모드: ${(bm.el.textContent || '').trim()} ${def ? '✅ 곡 안 바뀜' : '❌ 한 곡 이어야 함'}`);
  if (!def) errs++;
  clickOn('bgm-mode');                 // → 시간선 (아래 순서 검사용)
}
const CSS = fs.readFileSync(path.join(HERE, '..', 'css', 'style.css'), 'utf8');
{
  // 광고를 지나는 동안 뜨는 창 — 화면 한가운데에, 약관 최소치 200×200 이상으로.
  // 곡이 시작되면 이 창은 통째로 사라지고 영상만 아래 소개 패널의 바탕으로 내려앉는다.
  const css = CSS;
  const html0 = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const slot = /\.bgmp-slot \{([^}]*)\}/.exec(css);
  const minW = slot && /min-width:\s*(\d+)px/.exec(slot[1]);
  const minH = slot && /min-height:\s*(\d+)px/.exec(slot[1]);
  const okSize = !!(minW && minH) && +minW[1] >= 200 && +minH[1] >= 200;
  const card = /\.bgm-player \{([^}]*)\}/.exec(css);
  const mid = !!card && /left:\s*50%/.test(card[1]) && /top:\s*50%/.test(card[1])
    && /transform:\s*translate\(-50%,\s*-50%\)/.test(card[1]);
  // 늘 숨기면 약관 위반이다 — 사라지는 건 「바탕으로 내려앉은 뒤」뿐이어야 한다
  const alwaysHidden = !!card && /display:\s*none/.test(card[1]);
  const goneOnBg = /\.bgm-player\.is-space \{[^}]*display:\s*none/.test(css);
  // 창이 사라져도 「한 곡 / 시간선」은 만질 수 있어야 한다 (재생 HUD 로 옮겼다)
  const hud = /<div id="play-hud"[\s\S]*?<\/div>/.exec(html0);
  const modeOut = !!hud && /id="bgm-mode"/.test(hud[0]);
  const ok = okSize && mid && !alwaysHidden && goneOnBg && modeOut;
  console.log(`   광고 창: 최소 ${minW ? minW[1] : '?'}×${minH ? minH[1] : '?'} ${okSize ? '✅' : '❌'}`
    + ` · 화면 한가운데 ${mid ? '✅' : '❌'} · 늘 숨기지는 않음 ${alwaysHidden ? '❌' : '✅'}`
    + ` · 바탕으로 내려가면 사라짐 ${goneOnBg ? '✅' : '❌'}`
    + ` · 「한 곡/시간선」은 재생 HUD 에 ${modeOut ? '✅' : '❌'} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 1) 재생을 열기 전 물음 → 광고 대기 → 시작
{
  const api = globalThis.window.__rescene;
  const g = api.askGate;
  clickOn('btn-play');
  const asked = g.el._classes.has('is-on') && g.choice === null && !api.play.active;
  // 「소리와 함께」 — 유튜브는 물리되 시간선은 아직 안 자란다
  clickOn('ask-yes');
  step(12);
  const waiting = g.waiting && !api.play.active && g.el._classes.has('is-wait') && bgm.plays > 0;
  // 유튜브가 아예 안 뜨는 환경에서도 갇히면 안 된다 — 기다리지 않고 시작
  clickOn('ask-skip');
  const started = api.play.active && !g.waiting && !g.el._classes.has('is-on') && g.done;
  console.log(`   재생 전 물음: ▶ → 물음 ${asked ? '✅' : '❌'} · 「소리와 함께」 → 광고 대기 ${waiting ? '✅ 시간선 멈춤' : '❌'} · 건너뛰기 → 시작 ${started ? '✅' : '❌'}`);
  if (!asked || !waiting || !started) errs++;
}
{
  const card = byIdEl('play-card');
  for (let k = 0; k < 400 && !card._classes.has('is-on'); k++) step(1);
  const before = byIdEl('play-cue').dataset.cue;
  const shownAt = frames.length;
  if (!card._classes.has('is-on')) { errs++; console.log('   ❌ 카드가 안 뜸'); }
  else {
    const canvas = byIdEl('scene');
    handlers.filter((h) => h.el === canvas && h.type === 'pointerdown')
      .forEach((h) => h.fn({ button: 0, clientX: 5, clientY: 5, stopPropagation() {}, preventDefault() {} }));
    let n = 0;
    for (; n < 400; n++) { step(1); if (byIdEl('play-cue').dataset.cue !== before) break; }
    const secs = (n * 0.05).toFixed(1);
    console.log(`   클릭 후 ${secs}초 만에 다음 사건으로 (기다렸으면 5초) ${n * 0.05 < 4 ? '✅' : '❌ 안 넘어감'}`);
    if (n * 0.05 >= 4) errs++;
  }
}
// 좌우 키로 사건 건너뛰기
{
  const key = (k) => {
    handlers.filter((h) => h.el === window && h.type === 'keydown')
      .forEach((h) => h.fn({ key: k, preventDefault() {}, stopPropagation() {} }));
    step(2);
  };
  const seq = [];
  for (let i = 0; i < 5; i++) { key('ArrowRight'); seq.push(byIdEl('play-cue').dataset.cue); }
  const fwd = new Set(seq).size;
  const backFrom = seq[seq.length - 1];
  key('ArrowLeft'); key('ArrowLeft');
  const backTo = byIdEl('play-cue').dataset.cue;
  console.log(`   좌우 건너뛰기: → 5번에 서로 다른 사건 ${fwd}개 · ← 2번에 ${backFrom === backTo ? '❌ 그대로' : `${backTo} 로 되돌아감 ✅`}`);
  if (fwd < 4 || backFrom === backTo) errs++;
}

// 재생 중 UI 자동 숨김
{
  const b = document.body;
  const hidden = !b._classes.has('show-ui');
  handlers.filter((h) => h.type === 'pointermove').forEach((h) => h.fn({ clientX: 40, clientY: 40 }));
  step(1);
  const back = b._classes.has('show-ui');
  console.log(`   UI 자동 숨김: 기본 ${hidden ? '숨김 ✅' : '❌ 보임'} · 마우스 움직이면 ${back ? '복귀 ✅' : '❌ 안 나옴'}`);
  if (!hidden || !back) errs++;
}

clickOn('btn-play');          // 정지
step(4);
clickOn('btn-play');          // 처음부터 다시 — 속도 곡선은 손대지 않은 재생으로 잰다
step(2);
const cue = byIdEl('play-cue');
let shown = 0, prev = '', frames0 = 0, focusSeen = false, fadedSeen = 0; const cueIds = []; let lastVidCue = '';
const years = new Set(); const mds = new Set(); let clockOn = false;
let headSeen = 0; const headTexts = new Set(); const headXs = []; let fanEarly = 0;
let phaseEarly = 0; let phaseAhead = 0; let phaseSeen = 0;
let gasBefore = 0; let gasAfter = 0;
let lastBgmSrc = ''; const bgmSeq = []; let bgmSoft = 0;
// 자리마다 따로 구르므로 자리별로 들어오는 쪽 글자를 모아 붙인다
const rolled = (el) => {
  const re = /class="rl-(?:cur|in)">([^<]*)</g;
  const out = [];
  let m;
  while ((m = re.exec(el.innerHTML || ''))) out.push(m[1]);
  return out.length ? out.join('') : el.textContent;
};
const prog = []; let bgmPeak = 0; let bangPeak = 0; let bangAt = -1; let nexusAt = -1;
const cueCenter = new Map();   // 사건 → 화면 한가운데에 가장 가까웠던 거리
let lastTgtX = null, backSum = 0, backMax = 0;   // 카메라 목표가 뒤로 물러난 양
// 하네스의 OrbitControls 는 껍데기라 update() 가 카메라를 target 쪽으로 돌려 주지 않는다.
// 화면 좌표를 재려면 같은 자리에 세운 사본을 직접 target 쪽으로 돌려서 본다.
const probeCam = globalThis.window.__rescene.camera.clone();
let vidCues = 0, maxThumbs = 0;
try {
  for (let k = 0; k < 9000 && document.body.classList.contains('is-playing'); k++) {
    step(1); frames0++;
    if (cue.dataset.cue && cue.dataset.cue !== prev) { prev = cue.dataset.cue; shown++; cueIds.push(prev); }
    if (!focusSeen) {
      focusSeen = handlers.some((h) => h.el._classes && h.el._classes.has('is-focus'));
      if (focusSeen) fadedSeen = handlers.filter((h) => h.el._classes && h.el._classes.has('is-faded')).length;
    }
    prog.push(parseFloat(byIdEl('play-bar').style.width) || 0);
    bgmPeak = Math.max(bgmPeak, bgm.volume);
    const fo = parseFloat(byIdEl('bang-flash').style.opacity) || 0;
    if (fo > bangPeak) { bangPeak = fo; bangAt = frames0; }
    if (nexusAt < 0 && cue.dataset.cue === 'geoje-nexus') nexusAt = frames0;
    // 시간선 끝에도 같은 날짜가 붙어 따라오는지
    {
      const api = globalThis.window.__rescene;
      // 끝에 닿기 전에 「무수한 가능성」 갈래가 보이면 안 된다
      if (api.play.active && api.futureFan.grp.visible) fanEarly++;
      // 배경음이 지나온 MV 를 따라 바뀌는지
      if (api.play.active) {
        const src = api.bgm.src;
        if (src !== lastBgmSrc) { lastBgmSrc = src; bgmSeq.push({ src, x: api.play.front }); }
        if (api.bgm.volume > 0.001 && api.bgm.volume < 0.02) bgmSoft++;
      }
      // 가스는 빅뱅 전에는 안 보이고, 터진 뒤 서서히 차오른다
      if (api.play.active) {
        const gk = Math.max(...api.gasBlobs.map((b) => b.material.opacity));
        if (bangAt >= 0) gasAfter = Math.max(gasAfter, gk);
        else gasBefore = Math.max(gasBefore, gk);
      }
      // PHASE 이름표는 진행선이 그 자리에 닿기 전에 뜨면 안 된다
      for (const r of api.revealables) {
        for (const o of r.objs) {
          const cls = (o.element && o.element.className) || '';
          if (!/period-label/.test(cls) || !o.visible) continue;
          phaseSeen++;
          const d = o.position.x - api.play.front;
          if (d > 2) { phaseEarly++; phaseAhead = Math.max(phaseAhead, d); }
        }
      }
      if (api.headAnchor.visible) {
        headSeen++;
        headTexts.add(api.headDate.textContent);
        headXs.push(api.headAnchor.position.x);
      }
      // 카메라가 앞뒤로 튀지 않는가 — 목표점이 뒤로 물러난 양을 모은다
      if (api.play.active) {
        const tx = api.controls.target.x;
        if (lastTgtX !== null) {
          const d = tx - lastTgtX;
          if (d < 0) { backSum += -d; backMax = Math.max(backMax, -d); }
        }
        lastTgtX = tx;
      }
      // 사건을 소개하는 동안에는 그 사건이 화면 한가운데로 와야 한다.
      // 사건마다 「가운데에 가장 가까웠던 순간」을 화면 좌표(NDC, 0=정중앙 1=가장자리)로 잰다.
      if (api.play.active && api.play.hold > 0 && (api.play.focus >= 0 || api.play.focusMv >= 0)) {
        const key = cue.dataset.cue || '?';
        probeCam.position.copy(api.camera.position);
        probeCam.lookAt(api.controls.target);
        probeCam.updateMatrixWorld(true);
        const p = api.focusPos.clone().project(probeCam);
        const d = Math.hypot(p.x, p.y);
        const was = cueCenter.get(key);
        if (!was || d < was.d) cueCenter.set(key, { d, y: was ? was.y : p.y });
        // 세로 자리는 소개가 한창일 때만 잰다 — 들어오는 중·나가는 중에는
        // 카메라가 본류와 사건 사이 어딘가라 값이 흐른다
        if (api.play.holdMax - api.play.hold > 2 && api.play.hold > 2) cueCenter.get(key).y = p.y;
      }
    }
    // 구르는 동안엔 옛 숫자와 새 숫자가 잠깐 겹쳐 있다. 들어오는 쪽만 읽는다.
    years.add(rolled(byIdEl('pclk-year')));
    mds.add(rolled(byIdEl('pclk-month')) + rolled(byIdEl('pclk-day')));
    if (byIdEl('play-strip')._classes.has('is-on')) clockOn = true;
    const pv = byIdEl('pcard-videos');
    if (!pv.hidden && pv.children.length) {
      maxThumbs = Math.max(maxThumbs, pv.children.length);
      if (cue.dataset.cue !== lastVidCue) { lastVidCue = cue.dataset.cue; vidCues++; }
    }
  }
} catch (e) { errs++; console.log(`   ❌ 재생 루프: ${e.stack.split('\n').slice(0, 2).join(' | ')}`); }
const lastDateShown = byIdEl('play-date').textContent;
console.log(`   소개된 사건 ${shown}개 · 총 ${(frames0 * 0.05).toFixed(0)}초 · 마지막 날짜 ${lastDateShown}`);
// 소개하는 동안 사건이 화면 한가운데로 오는가 (0 = 정중앙, 1 = 화면 가장자리)
{
  const all = [...cueCenter.values()];
  const ds = all.map((v) => v.d).sort((a, b) => a - b);
  const ys = all.map((v) => v.y).sort((a, b) => a - b);
  const mid = ds.length ? ds[Math.floor(ds.length / 2)] : 9;
  const worst = ds.length ? ds[ds.length - 1] : 9;
  const midY = ys.length ? ys[Math.floor(ys.length / 2)] : 0;
  const off = ds.filter((d) => d > 0.5).length;    // 반쯤 밀려난 사건
  // 사건은 화면 한가운데에서 **조금 아래**여야 한다 — 위쪽은 이름표 자리다
  const aboveN = ys.filter((y) => y >= 0).length;   // 중앙보다 위에 선 사건
  const below = midY < -0.04 && midY > -0.3 && aboveN === 0;
  const ok = ds.length >= 20 && mid < 0.3 && off === 0 && below;
  console.log(`   사건 화면 중앙: ${ds.length}건 · 중앙에서 ${mid.toFixed(2)} · 가장 먼 것 ${worst.toFixed(2)}`
    + ` · 세로 ${midY.toFixed(2)} (위로 넘어간 사건 ${aboveN}개, 최고 ${ys[ys.length - 1].toFixed(2)}) ${below ? '✅ 한가운데 조금 아래' : '❌'}`
    + ` · 절반 넘게 밀린 사건 ${off}개 ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}
// 카메라가 앞뒤로 튀면 안 된다. 앞서 보는 양을 고정값(150)으로 두던 동안엔
// 사건마다 그만큼 물러났다 나와서 되돌아간 거리가 6500 을 넘었다.
{
  const ok = backSum < 1200 && backMax < 40;
  console.log(`   카메라 되돌아감(가로): 총 ${backSum.toFixed(0)} · 한 번에 최대 ${backMax.toFixed(1)} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}
// 피날레 — 갈래가 뻗고 나서 전체 보기로 돌아오는지
{
  const api = globalThis.window.__rescene;
  const V = api.THREE.Vector3;
  const home = new V(1090, 420, 3200);
  // 갈래가 한꺼번에 터지지 않고 하나씩 돋는지 — 자란 갈래 수를 프레임마다 센다
  const fan = api.futureFan;
  console.log(`   갈래 미리보임: 재생 중 ${fanEarly}프레임 ${fanEarly === 0 ? '✅ 끝에 닿아야 나온다' : '❌ 미리 보임'}`);
  if (fanEarly) errs++;
  // 평소엔 uFlicker 0.28 로 옅게 깔려 있고, 돋아나는 갈래만 밝게 타오른다
  const grown = () => fan.arms.filter((a) => a.mats[0].uniforms.uFlicker.value > 0.9).length;
  const g0 = grown();
  step(20);
  const d0 = api.camera.position.distanceTo(home);
  const seq = [];
  for (let k = 0; k < 34; k++) { step(4); seq.push(grown()); }   // 0.2초 간격 6.8초
  const peak = Math.max(...seq);
  const rise = seq.filter((v, i) => i && v > seq[i - 1]).length;  // 새 갈래가 돋은 구간 수
  const ok = g0 === 0 && peak === fan.arms.length && rise >= 8;
  console.log(`   갈래: 평소 ${g0}개 밝음 → ${rise}번에 걸쳐 하나씩 최대 ${peak}/${fan.arms.length}개 ${ok ? '✅' : '❌'}`);
  console.log(`          0.2초마다 밝은 갈래 수: ${seq.slice(0, 26).join(' ')}`);
  if (!ok) errs++;
  step(200);                       // 복귀 비행
  const d1 = api.camera.position.distanceTo(home);
  console.log(`   피날레 후 전체 보기 복귀: 거리 ${d0.toFixed(0)} → ${d1.toFixed(0)} ${d1 < d0 && d1 < 260 ? '✅' : '❌'}`);
  if (!(d1 < d0 && d1 < 260)) errs++;
}
console.log(`   현재 사건 강조: ${focusSeen ? `동작 (동시에 ${fadedSeen}개 라벨 물러남)` : '❌ 안 걸림'}`);
if (!focusSeen) errs++;
const mvCues = cueIds.filter((c) => c.startsWith('mv:')).length;
const digCues = cueIds.filter((c) => c === 'may-school' || c === 'zena-halmae').length;
console.log(`   MV 소개 ${mvCues}개 · 파묘 소개 ${digCues}개 ${digCues === 0 ? '(정상 — 재생에서 제외)' : '❌ 나오면 안 됨'}`);
if (digCues > 0 || mvCues === 0) errs++;
console.log(`   영상 썸네일: ${vidCues}개 소개에서 표시 (한 화면 최대 ${maxThumbs}장)`);
if (vidCues === 0) errs++;
// 진행 막대로 속도·가속을 재서 급변이 없는지 본다 (부드러운 완급 확인)
{
  const v = [];
  for (let i = 1; i < prog.length; i++) v.push(Math.max(0, prog[i] - prog[i - 1]));
  const vmax = Math.max(...v) || 1;
  let jumps = 0, amax = 0; const where = [];
  for (let i = 1; i < v.length; i++) {
    const a = Math.abs(v[i] - v[i - 1]) / vmax;   // 정규화 가속
    amax = Math.max(amax, a);
    if (a > 0.34) { jumps++; where.push(`${prog[i].toFixed(1)}%(v ${(v[i-1]/vmax*100).toFixed(0)}→${(v[i]/vmax*100).toFixed(0)})`); }
  }
  console.log(`   속도 곡선: 프레임당 최대 변화 ${(amax * 100).toFixed(1)}% · 급변 ${jumps}회 ${jumps === 0 ? '✅ 부드러움' : '❌ 튐'}`);
  if (jumps > 0) { errs++; console.log('     위치: ' + where.slice(0, 6).join('  ')); }
}
{
  const back = headXs.filter((x, i) => i && x < headXs[i - 1] - 0.01).length;
  const grew = headXs.length > 1 && headXs[headXs.length - 1] > headXs[0] + 1000;
  const ok = headSeen > 100 && headTexts.size > 50 && grew && back === 0;
  console.log(`   시간선 끝 날짜: ${headSeen}프레임 표시 · ${headTexts.size}단계 · x ${(headXs[0]||0).toFixed(0)} → ${(headXs[headXs.length-1]||0).toFixed(0)} · 뒤로 감 ${back}회 ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
  const api = globalThis.window.__rescene;
  console.log(`   재생 끝나면 감춤: ${api.headAnchor.visible ? '❌ 남아 있음' : '✅'}`);
  if (api.headAnchor.visible) errs++;
}
const ys = [...years].filter(Boolean).sort().join(' → ');
console.log(`   하단 날짜: ${clockOn ? '표시됨' : '❌ 안 뜸'} · 연도 ${ys} · 날짜 ${mds.size}단계`);
if (!clockOn || years.size < 3 || mds.size < 50) errs++;
{
  // 곡이 MV 순서대로 바뀌었는지 (x 가 뒤로 가면 안 된다)
  const api = globalThis.window.__rescene;
  const order = api.MV_BY_X.map((t) => t.mv.id);
  const ids = bgmSeq.map((b) => (b.src.match(/v=([\w-]+)/) || [])[1]);
  const idx = ids.map((id) => order.indexOf(id));
  const mono = idx.every((v, i) => i === 0 || v > idx[i - 1]);
  // 여는 곡은 기준곡(data.js 의 BGM)이어야 한다 — 반쪽으로 끊긴 선공개 MV 로 열면 안 된다
  const { BGM } = await import(pathToFileURL(path.join(HERE, '.tmp', 'data.js')).href);
  const first = ids[0] === BGM.id;
  const okSeq = bgmSeq.length >= 8 && mono && idx.every((v) => v >= 0) && first;
  console.log(`   배경음 곡 바뀜 ${bgmSeq.length}회 · MV 순서대로 ${mono ? '✅' : '❌ 뒤섞임'} · 여는 곡 ${MVS_NAME[ids[0]] || ids[0]} ${first ? '✅' : `❌ ${BGM.title} 여야 함`}`);
  console.log(`      ${ids.map((id, i) => (MVS_NAME[id] || id)).join(' → ')}`);
  console.log(`   전환 부드러움: 아주 작은 볼륨 구간 ${bgmSoft}프레임 ${bgmSoft > 20 ? '✅ 서서히 오르내림' : '❌ 툭 끊김'}`);
  if (!okSeq || bgmSoft <= 20) errs++;
}
{
  const ok = gasBefore < 0.005 && gasAfter > 0.03;
  console.log(`   배경 가스: 빅뱅 전 ${gasBefore.toFixed(3)} → 터진 뒤 ${gasAfter.toFixed(3)} ${ok ? '✅ 터지고 나서 차오른다' : '❌'}`);
  if (!ok) errs++;
}
console.log(`   빅뱅: 섬광 최대 ${bangPeak.toFixed(2)} · 터진 뒤 ${((nexusAt - bangAt) * 0.05).toFixed(1)}초 만에 분기점 소개 ${bangPeak > 0.5 && nexusAt > bangAt ? '✅' : '❌'}`);
if (bangPeak < 0.4 || nexusAt <= bangAt) errs++;

// 페이드아웃(1.4초)이 끝날 시간을 준 뒤 확인한다
step(60);
console.log(`   배경음: 재생 ${bgm.plays || 0}회 · 최고 볼륨 ${bgmPeak.toFixed(2)} · 페이드아웃 후 볼륨 ${bgm.volume.toFixed(3)} · ${bgm.paused ? '정지됨 ✅' : '❌ 계속 재생'}`);
if (!bgm.plays || bgmPeak < 0.3 || !bgm.paused) errs++;

// 영상 보는 동안 배경음 일시정지
clickOn('btn-play');
step(30);
const volPlay = bgm.volume;
handlers.filter((h) => h.el && h.el._classes && h.el._classes.has('mv-card')).slice(0, 1)
  .forEach((h) => h.type === 'click' && h.fn({ stopPropagation() {} }));
byIdEl('btn-mv') && clickOn('btn-mv');
step(4);
// 갤러리 항목을 눌러 플레이어를 연다
const gal = byIdEl('mvgal-list');
if (gal.children.length) {
  const item = gal.children[0];
  handlers.filter((h) => h.el === item && h.type === 'click').forEach((h) => h.fn({ stopPropagation() {} }));
}
step(6);
const volMid = bgm.volume;          // 0.3초 — 접히는 중이어야 한다 (뚝 끊기면 이미 0)
step(20);
const volWatch = bgm.volume;        // 1.3초 — 다 접혔다
clickOn('player-close');
step(6);
const volBackMid = bgm.volume;      // 0.3초 — 펴지는 중
step(40);
const volBack = bgm.volume;
const fadeOk = volMid > 0.02 && volMid < volPlay && volWatch === 0 && volBackMid > 0.02 && volBackMid < volBack && volBack > 0.1;
console.log(`   영상 보는 중 배경음: ${volPlay.toFixed(2)} →(0.3초) ${volMid.toFixed(2)} →(1.3초) ${volWatch.toFixed(2)} · 닫으면 →(0.3초) ${volBackMid.toFixed(2)} → ${volBack.toFixed(2)} ${fadeOk ? '✅ 접었다 폄' : '❌'}`);
if (!fadeOk) errs++;
clickOn('btn-play');
step(40);

// 음소거 토글
clickOn('btn-play');
step(30);
const volOn = bgm.volume;
clickOn('play-mute');
step(6);
console.log(`   음소거 토글: ${volOn.toFixed(2)} → ${bgm.volume.toFixed(2)} ${bgm.volume === 0 ? '✅' : '❌'}`);
if (bgm.volume !== 0) errs++;
clickOn('play-mute');
clickOn('btn-play');
step(60);
console.log('   재생 상태:', document.body.classList.contains('is-playing') ? '아직 재생 중' : '끝까지 돌고 정지됨');

try { step(20); } catch (e) { errs++; console.log(`   ❌ 정지 후: ${e.message}`); }

// 3) 키보드
// 광고 · 사주 곁줄기
{
  const api = globalThis.window.__rescene;
  const names = api.sideLines.map((s) => `${s.data.label} ${s.items.length}편`).join(' · ');
  const okCount = api.sideLines.length === 2 && api.sideLines.every((s) => s.items.length >= 8);
  // 옆 레인(메라디오·대표·연수·굴욕)과 붙지 않아야 한다
  const others = api.radios.concat(api.drives, api.staffs, api.shames.flatMap((m) => m.items || []));
  let near = 0;
  for (const sl of api.sideLines)
    for (const t of sl.items)
      if (others.some((o) => o.pos && Math.abs(o.pos.x - t.pos.x) < 30 && Math.abs(o.pos.y - t.pos.y) < 40)) near++;
  // 두 줄끼리도 붙으면 안 된다
  const [a, b] = api.sideLines;
  let cross = 0;
  for (const t of a.items)
    if (b.items.some((o) => Math.abs(o.pos.x - t.pos.x) < 30 && Math.abs(o.pos.y - t.pos.y) < 40)) cross++;
  const ys = api.sideLines.map((s) => (Math.min(...s.items.map((t) => t.pos.y))).toFixed(0));
  const ok = okCount && near === 0 && cross === 0;
  console.log(`   곁줄기: ${names} · 최저 y ${ys.join(' / ')} · 옆 레인과 붙음 ${near} · 서로 붙음 ${cross} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 배경 가스 — 어느 방향에서 봐도 덩어리로 보이는지 (카메라를 향해 서는지)
{
  const api = globalThis.window.__rescene;
  const V = api.THREE.Vector3;
  const blobs = api.gasBlobs;
  // 화면에 나란히 서는 방식(screen-aligned)이라 판의 법선이 카메라 정면축과 같아야 한다.
  // (덩어리마다 카메라 쪽으로 각각 트는 게 아니라 전부 화면과 평행하게 선다)
  const faceAt = () => {
    let worst = 1;
    const n = new V();
    const fwd = new V(0, 0, 1).applyQuaternion(api.camera.quaternion).normalize();
    for (const b of blobs) {
      n.set(0, 0, 1).applyQuaternion(b.quaternion).normalize();
      worst = Math.min(worst, n.dot(fwd));
    }
    return worst;
  };
  step(2);
  const before = faceAt();
  // 카메라를 완전히 다른 데서 보게 옮겨도 여전히 정면을 봐야 한다.
  // 끝나면 원래 자리로 되돌려 놓는다 — 여기서 흐트러뜨리면 뒤의 겹침 측정이 다 어긋난다.
  const keepP = api.camera.position.clone();
  const keepQ = api.camera.quaternion.clone();
  const keepT = api.controls.target.clone();
  api.camera.position.set(2600, -900, -2200);
  api.camera.lookAt(2600, 0, 0);
  step(2);
  const after = faceAt();
  api.camera.position.copy(keepP);
  api.camera.quaternion.copy(keepQ);
  api.controls.target.copy(keepT);
  api.camera.updateMatrixWorld(true);
  step(2);
  const zs = blobs.map((b) => b.position.z);
  const depth = Math.max(...zs) - Math.min(...zs);
  const ok = before > 0.999 && after > 0.999 && blobs.length >= 30 && depth > 900;
  console.log(`   배경 가스: 덩어리 ${blobs.length}개 · 앞뒤 깊이 ${depth.toFixed(0)} · 정면도 ${before.toFixed(3)} → 뒤에서 봐도 ${after.toFixed(3)} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
  const dens = blobs.reduce((a, b) => a + b.material.opacity, 0);
  console.log(`   가스 짙기(불투명도 합) ${dens.toFixed(2)}`);
}

// 재생 중 지나간 사건 라벨이 날짜 대신 제목을 다는지 (CSS 규칙 존재 확인)
{
  const css = fs.readFileSync(path.join(HERE, '..', 'css', 'style.css'), 'utf8');
  const hideDate = /body\.is-playing[^{]*\.nl-date\s*\{[^}]*display:\s*none/.test(css);
  const showTitle = /body\.is-playing[^{]*\.nl-title\s*\{[^}]*display:\s*block/.test(css);
  const ok = hideDate && showTitle;
  console.log(`   재생 중 라벨: 날짜 숨김 ${hideDate ? '✅' : '❌'} · 제목 표시 ${showTitle ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 재생은 오늘에서 끝나고, 오늘을 넘는 순간 갈래가 뻗는다
{
  const today = new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split('-');
  const want = `${y}. ${m}. ${d}`;
  const last = lastDateShown;
  console.log(`   재생 끝 날짜: ${last} (오늘 ${want}) ${last === want ? '✅' : '❌'}`);
  if (last !== want) errs++;
}

// 서체 — 실제로 불러오는지, 변수와 짝이 맞는지
{
  const css = fs.readFileSync(path.join(HERE, '..', 'css', 'style.css'), 'utf8');
  const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const link = /fonts\.googleapis\.com\/css2\?family=([^"']+)/.exec(html);
  const fams = link ? [...link[1].matchAll(/family=([A-Za-z+]+)|^([A-Za-z+]+)/g)]
    .map((m) => (m[1] || m[2] || '').replace(/\+/g, ' ')).filter(Boolean) : [];
  const wanted = [...new Set([...(css.match(/--sans:\s*"([^"]+)"/) || []).slice(1),
                              ...(css.match(/--mono:\s*"([^"]+)"/) || []).slice(1)])];
  const loaded = wanted.every((w) => link && link[1].replace(/\+/g, ' ').includes(w));
  const preconnect = /fonts\.gstatic\.com/.test(html);
  const ok = !!link && loaded && preconnect;
  console.log(`   서체: ${wanted.join(' + ')} · 링크 ${link ? '있음' : '❌ 없음'} · 짝 ${loaded ? '맞음' : '❌ 안 맞음'} · preconnect ${preconnect ? '✅' : '❌'}`);
  if (!ok) errs++;
  const tiny = (css.match(/font-size:\s*[0-8](\.\d)?px/g) || []);
  // 남은 것들은 아이콘·배지·라틴 미세 표식(▶ ★ 최초 kbd PHASE)이라 읽는 글자가 아니다
  console.log(`   9px 미만 글자: ${tiny.length}곳 (아이콘·배지·라틴 표식) ${tiny.length <= 16 ? '✅' : '⚠ 너무 많다'}`);
  if (tiny.length > 16) errs++;
}

// 조작 안내 · 범례 접기 (C · B)
{
  const body = globalThis.document.body;
  const press = (key) => handlers
    .filter((h) => h.el === globalThis.window && h.type === 'keydown')
    .forEach((h) => h.fn({ key, preventDefault() {}, stopPropagation() {} }));
  const st = () => `${body.classList.contains('show-help') ? 'C' : '-'}${body.classList.contains('show-legend') ? 'B' : '-'}`;
  const start = st();
  press('c'); press('b');
  const both = st();
  press('c'); press('b');
  const off = st();
  // 힌트 칩을 눌러도 열린다
  handlers.filter((h) => h.el === byIdEl('help-hint') && h.type === 'click').forEach((h) => h.fn({ stopPropagation() {} }));
  handlers.filter((h) => h.el === byIdEl('legend-hint') && h.type === 'click').forEach((h) => h.fn({ stopPropagation() {} }));
  const byChip = st();
  press('c'); press('b');
  const ok = start === '--' && both === 'CB' && off === '--' && byChip === 'CB';
  console.log(`   안내·범례 접기: 기본 ${start} · C/B ${both} · 다시 ${off} · 칩 클릭 ${byChip} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 제철 종료 표식 — 구간 끝 좌표에 서 있는지
{
  const api = globalThis.window.__rescene;
  const ends = api.revealables.flatMap((r) => r.objs)
    .filter((o) => o.element && /period-end/.test(o.element.className || ''));
  const txt = ends.map((o) => (o.element.textContent || '').replace(/\s+/g, ' ').trim());
  const ok = ends.length === 1 && /제철 종료/.test(txt[0]) && /2024/.test(txt[0]);
  console.log(`   구간 종료 표식 ${ends.length}개 · "${txt.join(', ')}" ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 한 곡 고정 — 켜면 곡을 한 번도 안 갈아 끼워야 한다 (프리롤이 붙을 기회를 줄이는 게 목적)
{
  const api = globalThis.window.__rescene;
  const bm = api.bgmMode;
  const probes = api.MV_BY_X.map((t) => t.x + 5);   // 모든 MV 를 하나씩 지나가 본다
  // 진행선이 모든 MV 를 하나씩 지나가는 동안 "갈아 끼울 곡"이 몇 번 바뀌는지 센다.
  // 켜는 순간의 1회 전환은 목표가 아니므로 그 값을 기준선으로 잡고 그 뒤 변화만 본다.
  const sweep = () => {
    let last = bm.pending;
    let n = 0;
    for (const x of probes) { bm.want(x); if (bm.pending !== last) { n++; last = bm.pending; } }
    return n;
  };
  const before = bm.one;

  clickOn('bgm-mode');
  const onTxt = (bm.el.textContent || '').trim();
  const onOk = bm.one === true && onTxt === '한 곡' && bm.el.getAttribute('aria-pressed') === 'true';
  const swapsOne = sweep();

  clickOn('bgm-mode');
  const offTxt = (bm.el.textContent || '').trim();
  const offOk = bm.one === false && offTxt === '시간선';
  const swapsLine = sweep();

  // 고정한 곡은 배경음으로 정해 둔 그 곡이어야 한다
  const song = api.MV_BY_X.find((t) => t.i === bm.ONE_I);
  const ok = onOk && offOk && swapsOne === 0 && swapsLine >= 5 && !!song;
  console.log(
    `   한 곡 고정: "${onTxt}" 곡 바뀜 ${swapsOne}회 · "${offTxt}" 곡 바뀜 ${swapsLine}회 · ` +
    `고정곡 ${song ? song.mv.song : '?'} ${ok ? '✅' : '❌'}`
  );
  if (!ok) errs++;
  if (bm.one !== before) clickOn('bgm-mode');
}

// YoYo(미완성) → UhUh(완성) — 실이 두 노드를 잇고, 완성 지점에 닿아야 보이는지
{
  const api = globalThis.window.__rescene;
  const arcs = api.arcThreads || [];
  const a = arcs[0];
  const yo = api.mvScreens.find((s) => s.mv.song === 'YoYo');
  const uh = api.mvScreens.find((s) => s.mv.song === 'UhUh');
  // 카드에 사연이 붙었는지 (반쪽 MV 는 점선 테두리)
  const noteOk =
    /예산/.test(yo.el.textContent) && /1:47/.test(yo.el.textContent) &&
    /완성/.test(uh.el.textContent) && /3:34/.test(uh.el.textContent) &&
    /is-cut/.test(yo.el.className) && !/is-cut/.test(uh.el.className);
  // 실이 UhUh 에 닿을 때 드러나는지 (YoYo 지점에서 미리 뜨면 안 된다)
  const rv = api.revealables.find((r) => r.objs.some((o) => o.element && /arc-chip/.test(o.element.className || '')));
  const revealOk = !!rv && Math.abs(rv.x - uh.anchor.x) < 1 && rv.x > yo.anchor.x;
  const chipTxt = a ? (a.el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  const linkOk = arcs.length === 1 && a.src.mv.song === 'YoYo' && a.dst.mv.song === 'UhUh' &&
    /1:47 → 3:34/.test(chipTxt) && /미완성 → 완성/.test(chipTxt);
  const ok = noteOk && revealOk && linkOk;
  console.log(
    `   미완성→완성 실 ${arcs.length}개 · "${chipTxt}" · 카드 사연 ${noteOk ? '✅' : '❌'} · ` +
    `완성 지점(x ${rv ? rv.x.toFixed(0) : '?'})에서 등장 ${revealOk ? '✅' : '❌'} ${ok ? '✅' : '❌'}`
  );
  if (!ok) errs++;
}

// 재생 중 PHASE 이름표가 진행선보다 앞서 뜨지 않는지
{
  const api = globalThis.window.__rescene;
  const ok = phaseEarly === 0 && phaseSeen > 200;
  console.log(`   PHASE 이름표: 뜬 프레임 ${phaseSeen} · 진행선보다 앞서 뜸 ${phaseEarly}프레임 (최대 ${phaseAhead.toFixed(0)}) ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 재생 중에 소개 카드의 영상 썸네일을 눌러 바로 보기
{
  const api = globalThis.window.__rescene;
  const play = api.play;
  clickOn('btn-play');
  // 영상이 붙은 소개가 나올 때까지 돌린다
  let vids = null;
  for (let k = 0; k < 4000 && !vids; k++) {
    step(1);
    const list = byIdEl('pcard-videos');
    // 소개 카드가 실제로 떠 있는 동안에만 누를 수 있다
    if (!list.hidden && list.children.length && byIdEl('play-card')._classes.has('is-on')) vids = list.children[0];
  }
  if (!vids) { errs++; console.log('   ❌ 영상 붙은 소개를 못 만남'); }
  else {
    const volBefore = bgm.volume;
    const frontBefore = play.front;
    const holdBefore = play.hold;
    handlers.filter((h) => h.el === vids && h.type === 'click').forEach((h) => h.fn({ stopPropagation() {} }));
    step(30);
    const open = byIdEl('player')._classes.has('is-on') || byIdEl('player')._classes.has('is-open');
    const frontFrozen = Math.abs(play.front - frontBefore) < 0.01;
    const volWatch = bgm.volume;
    const cardStill = byIdEl('play-card')._classes.has('is-on');
    const holdWatch = play.hold;
    clickOn('player-close');
    step(40);
    const volBack = bgm.volume;
    // 소개 시간이 다시 흐르거나(hold 감소), 이미 다 흘렀으면 진행선이 움직인다
    const before = { h: play.hold, f: play.front };
    step(60);
    const resumed = play.hold < before.h - 0.01 || play.front > before.f + 0.01;
    const held = Math.abs(holdWatch - holdBefore) < 0.01;   // 보는 동안 소개 시간도 멈춰 있었나
    const ok = open && frontFrozen && held && cardStill && volWatch === 0 && volBack > 0.1 && resumed;
    console.log(`   재생 중 영상 보기: 창 ${open ? '열림' : '❌'} · 진행선 ${frontFrozen ? '멈춤' : '❌'} · 소개시간 ${held ? '멈춤' : '❌ 계속 감'} · 카드 ${cardStill ? '유지' : '❌ 사라짐'} · 배경음 ${volBefore.toFixed(2)}→${volWatch.toFixed(2)}→${volBack.toFixed(2)} · 닫으면 ${resumed ? '이어서 진행' : '❌ 안 이어짐'} ${ok ? '✅' : '❌'}`);
    if (!ok) errs++;
  }
  clickOn('btn-play');
  step(40);
}

// 멤버 소개 — 다섯 장 · 별명과 가족이 다 실렸는지
{
  const open = globalThis.document.getElementById('btn-members');
  handlers.filter((h) => h.el === open && h.type === 'click').forEach((h) => h.fn({ stopPropagation() {} }));
  step(4);
  const list = byIdEl('memgal-list');
  const cards = list.children.length;
  const html = list.children.map((c) => c.innerHTML || '').join('');
  const nicks = (html.match(/<b><\/b>/g) || []).length;   // 이름 노드 수 (텍스트는 별도로 넣는다)
  const openNow = byIdEl('memgal')._classes.has('is-open');
  console.log(`   멤버 소개: 카드 ${cards}장 · 열림 ${openNow ? '✅' : '❌'}`);
  if (!(cards === 5 && openNow)) errs++;
  // 별명·가족 항목 수는 데이터에서 직접 센다
  const { MEMBERS } = await import(pathToFileURL(path.join(HERE, '.tmp', 'data.js')).href);
  const nick = MEMBERS.reduce((a, m) => a + m.nick.length, 0);
  const fam = MEMBERS.reduce((a, m) => a + m.family.length, 0);
  const noWhy = MEMBERS.flatMap((m) => m.nick).filter((n) => !n.why).length;
  console.log(`   별명 ${nick}개 (유래 없는 것 ${noWhy}개) · 가족 ${fam}명 · 본명 ${MEMBERS.filter((m) => m.real).length}/5`);
  // 가족은 공인이 아니다 — 성함·생년이 다시 새어 들어가면 잡는다 (반려견은 예외)
  const named = MEMBERS.flatMap((m) => m.family).filter((f) => f.name && f.rel !== '반려견');
  const born = MEMBERS.flatMap((m) => m.family).filter((f) => /\d{4}년생/.test(f.note || ''));
  const clean = named.length === 0 && born.length === 0;
  console.log(`   가족 신원 정보: 성함 ${named.length}건 · 생년 ${born.length}건 ${clean ? '✅ 없음' : '❌ 들어 있음'}`);
  if (!clean) errs++;
  if (!(nick >= 20 && fam >= 4 && MEMBERS.every((m) => m.real))) errs++;
  handlers.filter((h) => h.el === byIdEl('memgal-close') && h.type === 'click').forEach((h) => h.fn({ stopPropagation() {} }));
  step(2);
  if (byIdEl('memgal')._classes.has('is-open')) { errs++; console.log('   ❌ 닫히지 않음'); }
}

// 대표와 이사 시간선
{
  const api = globalThis.window.__rescene;
  const xs = api.staffs.map((t) => t.pos.x);
  const ys = api.staffs.map((t) => t.pos.y);
  const mono = xs.every((x, i) => !i || x > xs[i - 1]);
  const ok = api.staffs.length >= 10 && mono && Math.min(...ys) < -150 && Math.max(...ys) > -320;
  console.log(`   대표·이사 회차 ${api.staffs.length}개 · x ${xs[0].toFixed(0)}~${xs[xs.length-1].toFixed(0)} · y ${Math.min(...ys).toFixed(0)}~${Math.max(...ys).toFixed(0)} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
  // 메라디오(-152) / 연수아저씨(-308) 레인과 겹치지 않아야 한다
  const near = api.staffs.filter((t) =>
    api.radios.concat(api.drives).some((o) => Math.abs(o.pos.x - t.pos.x) < 30 && Math.abs(o.pos.y - t.pos.y) < 40)).length;
  console.log(`   옆 레인과 붙은 회차: ${near}개 ${near === 0 ? '✅' : '❌'}`);
  if (near) errs++;
}

// 전체 조망에서 「거제편」·「사투리편」 꼬리표가 접히는지
{
  const api = globalThis.window.__rescene;
  const nx = api.branches.find((b) => b.ev.nexus);
  const forks = (nx && nx.forks) || [];
  const folded = forks.filter((f) => f.el.classList.contains('is-minor')).length;
  console.log(`   전체 조망 · 분기 꼬리표 ${forks.length}개 중 ${folded}개 접힘 ${forks.length > 0 && folded === forks.length ? '✅' : '❌'}`);
  if (!(forks.length > 0 && folded === forks.length)) errs++;
}

// 멤버 사진 — 영상 화면(maxresdefault) 이 아니라 프로필 사진이어야 한다
{
  const html = [...byId.values()].map((e) => e.innerHTML || '').join('') +
    globalThis.document.body.innerHTML;
  const labels = handlers.map((h) => (h.el && h.el.innerHTML) || '').join('');
  const all = html + labels;
  const srcs = all.match(/\.\/assets\/members\/[^"']+/g) || [];
  const frames = (all.match(/maxresdefault/g) || []).length;
  // 실제로 파일이 있는지까지 본다 (한글 파일명 인코딩 사고를 여기서 잡는다)
  const fsx = await import('node:fs');
  const missing = [...new Set(srcs)].filter(
    (u) => !fsx.existsSync(new URL('../' + decodeURIComponent(u.slice(2)), import.meta.url)));
  const ok = srcs.length >= 10 && frames === 0 && missing.length === 0;
  console.log(`   멤버 사진: 프로필 ${srcs.length}장 · 영상 화면 ${frames}장 · 없는 파일 ${missing.length}개 ${ok ? '✅' : '❌'}`);
  if (missing.length) console.log(`      ${missing.join(', ')}`);
  if (!ok) errs++;

  // 파일이 없는 곳(GitHub Pages)에서도 얼굴이 뜨도록 유튜브 트레일러 프레임으로 떨어지는지.
  // 사진 한 장마다 data-yt 가 붙어 있어야 하고, onerror 가 그 주소로 한 번만 되돌아야 한다.
  const imgs = all.match(/<img[^>]*data-yt=[^>]*>/g) || [];
  const withYt = imgs.filter((t) => /data-yt="[\w-]{6,}"/.test(t)).length;
  const fbOk = imgs.every((t) => /i\.ytimg\.com/.test(t) && /dataset\.fb=1/.test(t) && /is-gone/.test(t));
  // 대표 썸네일(mqdefault)은 흰 바탕에 이름만 적힌 카드라 얼굴이 없다 — 1/4 지점 프레임을 써야 한다
  const face = imgs.every((t) => /hq1\.jpg/.test(t)) && !/mqdefault/.test(imgs.join(''));
  // 파일이 있으면 언제나 파일이 먼저다 — 유튜브 프레임에서 시작하는 사진이 있으면 안 된다
  const straight = imgs.filter((t) => /src="https:\/\/i\.ytimg\.com/.test(t));
  const straightOk = straight.length === 0;
  // & 를 그대로 쓰면 HTML 속성에서 깨진다 — && 가 남아 있으면 실패
  const amp = imgs.some((t) => /&&/.test(t));
  const ok2 = imgs.length >= 18 && withYt === imgs.length && fbOk && face && straightOk && !amp;
  console.log(
    `   사진 대체: ${withYt}/${imgs.length}장에 유튜브 예비 · 얼굴 프레임 ${face ? '✅' : '❌ mqdefault'} · ` +
    `파일 우선 ${straightOk ? '✅' : `❌ ${straight.length}장이 유튜브부터`} · 3단 하강 ${fbOk ? '✅' : '❌'} · ` +
    `속성 escape ${amp ? '❌' : '✅'} ${ok2 ? '✅' : '❌'}`
  );
  if (!ok2) errs++;
}

// 사진이 동그라미 한가운데 놓이는가.
// 크기를 사진 쪽에 따로 적어 두면 슬롯과 어긋나 한쪽으로 쏠린다 —
// 좁은 화면에서 사진만 62px 로 줄이고 슬롯은 74px 로 둬서 실제로 그랬다.
{
  const fills = /\.mp-slot img \{[^}]*width:\s*100%[^}]*\}/.test(CSS)
    && /\.mp-slot img \{[^}]*height:\s*100%[^}]*\}/.test(CSS)
    && /\.mp-slot img \{[^}]*object-fit:\s*cover/.test(CSS);
  const centered = /\.mp-slot \{[^}]*align-items:\s*center[^}]*justify-content:\s*center/.test(CSS);
  // 사진 쪽에 크기를 적어 둔 규칙이 남아 있으면 안 된다
  const stray = [];
  const re = /(\.(?:nl-photo|pcard-photo-in|mem-photo)[^{}]*\bimg\b[^{}]*)\{([^}]*)\}/g;
  for (let m; (m = re.exec(CSS)); ) if (/(?:^|;)\s*(?:width|height)\s*:/.test(m[2])) stray.push(m[1].trim());
  // 슬롯 크기는 좁은 화면에서도 가로세로가 같아야 원이 된다
  const slots = [];
  for (let m, r = /\.mp-slot[^{}]*\{([^}]*)\}/g; (m = r.exec(CSS)); ) {
    const w = /(?:^|;)\s*width:\s*([^;]+)/.exec(m[1]);
    const h = /(?:^|;)\s*height:\s*([^;]+)/.exec(m[1]);
    if (w && h && w[1].trim() !== h[1].trim()) slots.push(`${w[1].trim()}≠${h[1].trim()}`);
  }
  const ok = fills && centered && !stray.length && !slots.length;
  console.log(`   사진 정렬: 슬롯을 꽉 채움 ${fills ? '✅' : '❌'} · 가운데 ${centered ? '✅' : '❌'}`
    + ` · 사진에 따로 적은 크기 ${stray.length ? `❌ ${stray.join(', ')}` : '✅ 없음'}`
    + ` · 슬롯 정사각 ${slots.length ? `❌ ${slots.join(', ')}` : '✅'} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 구간 이름표 — 높이가 맞는지, 누르면 그 구간으로 날아가는지
{
  const api = globalThis.window.__rescene;
  const eras = api.declutter.filter((d) => d.kind === 'era');
  const ys = eras.map((d) => d.base.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  console.log(`   구간 이름표 ${eras.length}개 · 높이 편차 ${spread.toFixed(1)} ${eras.length === 5 && spread < 0.01 ? '✅' : '❌'}`);
  if (!(eras.length === 5 && spread < 0.01)) errs++;

  const target = eras.find((d) => (d.el.className || '').includes('era-2025'));
  const before = api.camera.position.clone();
  handlers.filter((h) => h.el === target.el && h.type === 'click')
    .forEach((h) => h.fn({ stopPropagation() {} }));
  step(60);
  const want = new api.THREE.Vector3(1190, 66, 1000);   // ERAS 2025 의 cam.pos
  const moved = before.distanceTo(api.camera.position);
  const near = api.camera.position.distanceTo(want);
  console.log(`   이름표 클릭 → 2025 구간으로 이동: ${moved.toFixed(0)} 만큼 움직여 목표까지 ${near.toFixed(0)} ${moved > 200 && near < 60 ? '✅' : '❌'}`);
  if (!(moved > 200 && near < 60)) errs++;
}

// 라벨 겹침 해소 — 전체 조망에서 화면 좌표 겹침을 잰다
{
  const api = globalThis.window.__rescene;
  if (!api) { errs++; console.log('   ❌ 상태 핸들 없음'); }
  else {
    const V = api.THREE.Vector3;
    const measure = (useOffset) => {
      const cam = api.camera;
      const W = 1280, H = 720;
      const pts = [];
      for (const d of api.declutter) {
        if (!d.base) continue;
        if (d.baseFn) d.baseFn(d.base);
        const src = useOffset ? d.obj.getWorldPosition(new V()) : d.base;
        const v = new V().copy(src).project(cam);
        if (v.z > 1) continue;
        if (d.el._classes && (d.el._classes.has('is-minor') || d.el._classes.has('is-far'))) continue;
        pts.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, w: d.w || 150, h: d.h || 44 });
      }
      let n = 0;
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) n++;
        }
      return [n, pts.length];
    };
    const shot = (label, id) => {
      clickOn(id);
      step(150);                   // 카메라 이동 + 해소 수렴
      const [b, n] = measure(false);
      const [a] = measure(true);
      const ok = a <= b;
      console.log(`   ${label.padEnd(6)} 라벨 ${String(n).padStart(2)}개 · 겹침 ${String(b).padStart(2)}쌍 → ${String(a).padStart(2)}쌍 ${ok ? '✅' : '❌'}`);
      if (!ok) errs++;
      return [b, a];
    };
    console.log('   겹침 해소 (해소 전 → 후)');
    shot('파묘', 'btn-era-past');
    shot('연습생', 'btn-era-trainee');
    shot('2024', 'btn-era-2024');
    shot('2025', 'btn-era-2025');
    shot('2026', 'btn-era-2026');
    clickOn('btn-reset');
    step(150);
    const [before, total] = measure(false);
    const [after] = measure(true);
    {
      }
    console.log(`   전체    라벨 ${String(total).padStart(2)}개 · 겹침 ${String(before).padStart(2)}쌍 → ${String(after).padStart(2)}쌍 ${after <= before ? '✅' : '❌'}`);
    if (after > before) errs++;
  }
}


// 광고가 끝나면 화면이 아래 소개 패널의 바탕으로 내려앉는다 — 「영상만」, 옅게
{
  const api = globalThis.window.__rescene;
  const st = api.bgmStage;
  const card = byIdEl('bgm-player');
  const frame = byIdEl('bgm-frame');
  const mainSrc = fs.readFileSync(path.join(HERE, '..', 'js', 'main.js'), 'utf8');
  // 실제 화면처럼 자리를 정해 준다 — 패널은 화면 아래 260px, 그 중 위 148px 은
  // 배경으로 스며드는 그러데이션 구간이고 가로 선(ps-rule) 아래부터가 짙은 바탕이다.
  const W0 = globalThis.window.innerWidth;
  const H0 = globalThis.window.innerHeight;
  byIdEl('play-strip')._rect = { left: 0, top: H0 - 260, width: W0, height: 260, right: W0, bottom: H0 };
  byIdEl('ps-rule')._rect = { left: 0, top: H0 - 112, width: W0, height: 1, right: W0, bottom: H0 - 111 };
  const band = st.band();

  st.set(true);
  st.layout();
  const box = st.box();
  const r = st.rect();
  // 영상이 깔리는 칸은 「가로 선 아래」다 — 패널 위쪽 그러데이션 구간까지 깔면
  // 거기는 바탕이 투명해서 영상만 패널 밖으로 삐져나온 것처럼 보인다
  const ruleTop = Math.abs(box.h - 112) < 1 && box.h < band.h;
  const covers = r.w >= box.w - 0.5 && r.h >= box.h - 0.5;
  const ratio = Math.abs(r.w / r.h - 16 / 9) < 0.01;
  const onBand = Math.abs((r.x + r.w / 2) - box.w / 2) < 1
    && Math.abs((r.y + r.h / 2) - box.h / 2) < 1;
  // 자르는 건 화면 좌표 계산이 아니라 **배치**가 한다 — 패널과 똑같이 아래에 붙이고 키만 준다.
  // (iOS 는 window.innerHeight 와 fixed 요소의 기준 높이가 어긋나서 좌표로 자르면 틀어진다)
  const clipped = st.el.style.bottom === '0px' && st.el.style.top === 'auto'
    && Math.abs(parseFloat(st.el.style.height) - box.h) < 1
    && !(st.el.style.clipPath || '');
  const marked = st.el._classes.has('is-space') && card._classes.has('is-space');
  const moved = frame.style.width === `${Math.round(r.w)}px` && frame.style.height === `${Math.round(r.h)}px`;
  st.set(false);
  const back = !st.space && !st.el._classes.has('is-space') && !card._classes.has('is-space')
    && !st.el.style.height && !st.el.style.bottom;

  // 투명도 · 겹치는 순서
  const sp = /\.bgm-stage\.is-space \{([^}]*)\}/.exec(CSS);
  const op = sp && /opacity:\s*([\d.]+)/.exec(sp[1]);
  const seeThru = op && +op[1] > 0 && +op[1] <= 0.2;
  // 섞임은 모니터일 때부터 걸어 둔다 — 내려앉는 순간에만 켜면 그 한 프레임이 번쩍인다
  const base = /\.bgm-stage \{([^}]*)\}/.exec(CSS);
  const blend = !!(base && /mix-blend-mode:\s*screen/.test(base[1]))
    && !(sp && /mix-blend-mode:/.test(sp[1]));
  // 「바탕으로」 — 패널 바탕(.play-bg) 위, 패널 글자(.play-strip) 아래에 끼어야 한다.
  // 바탕 아래로 가면 바탕이 거의 불투명해서 아예 안 보이고,
  // 글자 위로 가면 바탕이 아니라 글자를 덮는 막이 된다.
  const bgz = /\.play-bg \{[^}]*z-index:\s*(\d+)/.exec(CSS);
  const stz = /\.play-strip \{[^}]*z-index:\s*(\d+)/.exec(CSS);
  const zi = sp && /z-index:\s*(\d+)/.exec(sp[1]);
  const between = zi && stz && bgz && +zi[1] > +bgz[1] && +zi[1] < +stz[1];
  // 바탕은 패널을 재서 높이를 맞춘다 (CSS 에 또 적으면 어긋난다)
  const bgFit = Math.abs(parseFloat(byIdEl('play-bg').style.height) - band.h) < 1.5;
  // 곡이 멈추면(일시정지·광고) 이 자리를 떠나 우상단 작은 창으로 돌아간다
  const poll = /ytPoll <= 0[\s\S]*?\n  \}/.exec(mainSrc);
  const leaves = !!poll && /setBgmStage\(false\)/.test(poll[0]) && /'pause'/.test(mainSrc);
  // 「영상만」 — 화면(#bgm-frame)은 카드 밖(#bgm-stage) 에 있어야 테두리·글자가 안 따라온다.
  // 겸사겸사 DOM 에서 iframe 을 옮겨 붙일 일도 없어진다 (옮기면 유튜브가 다시 문다).
  const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const stageHtml = /<div id="bgm-stage"[\s\S]*?<\/div>\s*<\/div>/.exec(html);
  const onlyVideo = /<div id="bgm-stage"[\s\S]{0,300}?id="bgm-frame"/.test(html)
    && !/<div id="bgm-player"[\s\S]*?id="bgm-frame"/.test(html);
  // 유튜브 API 는 넘겨준 칸을 iframe 으로 통째로 갈아 끼운다.
  // 자리를 계산해 넣는 칸(#bgm-frame)을 넘기면 그게 떨어져 나가 화면이 안 커진다 —
  // 실제로 그 버그로 영상이 우상단 모니터 크기에 머물렀다.
  const mount = /function bgmMount\(\)[\s\S]*?\n\}/.exec(mainSrc);
  const hostOk = !!mount && /getElementById\('bgm-yt'\)/.test(mount[0]) && !/'bgm-frame'/.test(mount[0]);
  const nested = /<div id="bgm-frame"[^>]*>[\s\S]{0,400}?<div id="bgm-yt">/.test(html);
  byIdEl('play-strip')._rect = null;    // 뒤 검사들이 원래 자리로 보게 되돌린다
  byIdEl('ps-rule')._rect = null;

  console.log(`   소개 패널 바탕 영상: ${Math.round(r.w)}×${Math.round(r.h)} 로 칸(${Math.round(box.w)}×${Math.round(box.h)}) 덮음 ${covers && ratio && onBand ? '✅' : '❌'}`
    + ` · 가로 선 아래부터 ${ruleTop ? '✅' : '❌'} · 패널에 붙여 잘라냄 ${clipped ? '✅' : '❌'}`
    + ` · 투명도 ${op ? op[1] : '?'} ${seeThru && blend ? '✅ 옅게 비침' : '❌'}`
    + ` · 바탕(${bgz ? bgz[1] : '?'}) < 영상(${zi ? zi[1] : '?'}) < 글자(${stz ? stz[1] : '?'}) ${between ? '✅' : '❌'}`
    + ` · 바탕 높이 맞음 ${bgFit ? '✅' : '❌'} · 멈추면 작은 창 ${leaves ? '✅' : '❌'}`
    + ` · 영상만 ${onlyVideo ? '✅' : '❌'}`
    + ` · 자리 옮김 ${marked && moved ? '✅' : '❌'} · 되돌아옴 ${back ? '✅' : '❌'}`
    + ` · 유튜브가 갈아 끼울 칸 따로 ${hostOk && nested ? '✅' : '❌ 자리 잡는 칸이 떨어져 나감'}`);
  if (!covers || !ratio || !onBand || !clipped || !ruleTop || !seeThru || !blend || !between || !bgFit || !leaves
    || !onlyVideo || !marked || !moved || !back || !stageHtml || !hostOk || !nested) errs++;
}

// 모바일에서 번쩍이던 것들 — 다시 들어오지 않게 막아 둔다
{
  const api = globalThis.window.__rescene;
  const src = fs.readFileSync(path.join(HERE, '..', 'js', 'main.js'), 'utf8');
  // 1) resize 마다 렌더타깃을 통째로 다시 잡으면 안 된다 (주소창이 접힐 때마다 날아온다)
  const rz = /function onResize\(\)\s*\{[\s\S]*?\n\}/.exec(src);
  const heavy = rz ? /(renderer|composer|bloom)\.setSize/.test(rz[0]) : true;
  const debounced = rz ? /setTimeout\(/.test(rz[0]) : false;
  // 2) 손가락 화면에서는 픽셀 배율과 MSAA 를 낮춘다
  const dpr = /setPixelRatio\([^)]*LOW_GPU[^)]*\)/.test(src);
  const msaa = /AA_SAMPLES\s*=\s*LOW_GPU/.test(src);
  const notLow = api.LOW_GPU === false;      // 1280×720 데스크톱을 모바일로 몰면 안 된다
  // 3) 매 프레임 옮겨 다니는 라벨의 backdrop-filter 를 끈다
  const coarse = /@media \(pointer: coarse\) \{[\s\S]*?\n\}/.exec(CSS);
  const noBlur = coarse ? /\.node-label[\s\S]{0,200}?backdrop-filter:\s*none/.test(coarse[0]) : false;
  const noGrain = coarse ? /\.grain \{[^}]*display:\s*none/.test(coarse[0]) : false;
  console.log(`   모바일 번쩍임: 리사이즈 ${!heavy && debounced ? '✅ 미룸' : '❌ 그 자리에서 재할당'}`
    + ` · 픽셀·MSAA ${dpr && msaa ? '✅ 낮춤' : '❌'} · 데스크톱 오판 ${notLow ? '✅ 없음' : '❌'}`
    + ` · 라벨 흐림 ${noBlur ? '✅ 끔' : '❌'} · 필름그레인 ${noGrain ? '✅ 끔' : '❌'}`);
  if (heavy || !debounced || !dpr || !msaa || !notLow || !noBlur || !noGrain) errs++;
}

// 회차 목록 — 메라디오 · 나의 연수아저씨.
// 시간선 위에 점으로 흩어져 있는 회차를 한자리에 모아 놓은 목록이다.
{
  const list = byIdEl('eplist-list');
  const gal = byIdEl('eplist');
  const shows = [
    { key: 'btn-radio', show: RADIO },
    { key: 'btn-drive', show: DRIVE },
  ];
  const lines = [];
  let ok = true;
  for (const { key, show } of shows) {
    clickOn(key);
    const opened = gal._classes.has('is-open');
    const n = list.children.length;
    const name = (byIdEl('ep-name').textContent || '').trim();
    const count = (byIdEl('ep-count').textContent || '').trim();
    // 회차마다 썸네일이 그 영상 것이어야 한다 (아무거나 붙여 놓으면 안 된다)
    const thumbs = list.children.filter((c, i) =>
      new RegExp(`i\\.ytimg\\.com/vi/${show.episodes[i].id}/`).test(c.innerHTML || '')).length;
    clickOn(key);                                    // 같은 걸 다시 누르면 닫힌다
    const toggled = !gal._classes.has('is-open');
    // 누르면 그 회차가 바로 열린다
    clickOn(key);
    const first = list.children[0];
    fire(`click ${show.id} 1회`, (h) => h.el === first && h.type === 'click');
    const playing = byIdEl('player')._classes.has('is-open')
      && (byIdEl('player-link').href || '').includes(show.episodes[0].id);
    clickOn('player-close');
    const good = opened && n === show.episodes.length && thumbs === n && playing && toggled
      && name === show.label && count === String(n);
    if (!good) ok = false;
    lines.push(`${show.label} ${n}회 · 썸네일 ${thumbs}/${n} · 열림 ${opened ? '✅' : '❌'}`
      + ` · 눌러서 재생 ${playing ? '✅' : '❌'} · 다시 눌러 닫힘 ${toggled ? '✅' : '❌'}`);
  }
  // 좁은 화면에서는 카드 격자가 아니라 한 줄짜리 목록이어야 한다 (제목이 대여섯 줄로 접히면
  // 카드 키가 제각각이 돼 들쭉날쭉해진다). 그리고 닫기 단추는 셋 다 모양이 잡혀 있어야 한다.
  const nar640 = /@media \(max-width: 640px\) \{[\s\S]*?\n\}\n/.exec(CSS);
  const listCol = nar640 ? /\.mvgal-list \{[^}]*flex-direction:\s*column/.test(nar640[0]) : false;
  const itemRow = nar640 ? /\.mvg-item \{[^}]*flex-direction:\s*row/.test(nar640[0]) : false;
  const clamp2 = nar640 ? /-webkit-line-clamp:\s*2/.test(nar640[0]) : false;
  const scrolls = nar640 ? /min-height:\s*0/.test(nar640[0]) : false;
  // 닫기 단추 — id 하나만 잡아 두면 나머지 둘이 맨 버튼으로 나온다
  const closeAll = /\.mvgal-inner header > button \{/.test(CSS);
  const mobileOk = listCol && itemRow && clamp2 && scrolls && closeAll;
  if (!mobileOk) ok = false;
  lines.push(`좁은 화면 목록 ${listCol && itemRow ? '✅ 한 줄씩' : '❌ 격자 그대로'}`
    + ` · 제목 두 줄까지 ${clamp2 ? '✅' : '❌'} · 스스로 구름 ${scrolls ? '✅' : '❌'}`
    + ` · 닫기 단추 셋 다 ${closeAll ? '✅' : '❌'}`);

  // 다른 목록을 누르면 앞의 것은 닫힌다 (겹쳐 뜨면 안 된다)
  clickOn('btn-radio');
  clickOn('btn-mv');
  const swap = !gal._classes.has('is-open') && byIdEl('mvgal')._classes.has('is-open');
  clickOn('mvgal-close');
  if (!swap) ok = false;
  console.log(`   회차 목록: ${lines.join(' | ')} · MV 갤러리와 겹치지 않음 ${swap ? '✅' : '❌'} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 좁은 화면 정리 — 버튼 줄이 화면 밖으로 밀려 나가면 안 된다
{
  const nar = /@media \(max-width: 640px\) \{[\s\S]*?\n\}\n/.exec(CSS);
  const navWrap = nar ? /\.hud-nav[\s\S]{0,240}?flex-wrap:\s*wrap/.test(nar[0]) : false;
  const navFit = nar ? /body\.is-ready \.hud-nav[\s\S]{0,240}?transform:\s*none/.test(nar[0]) : false;
  const safe = nar ? /env\(safe-area-inset-bottom\)/.test(nar[0]) : false;
  const askCol = nar ? /\.ask-btns \{[^}]*flex-direction:\s*column/.test(nar[0]) : false;
  const tap = /\.ask-btn \{[^}]*min-height:\s*44px/.test(CSS);
  // 아래 소개 패널 — 가로로 나란히 두면 폭이 모자라 제목이 잘렸다. 세로로 쌓는다.
  // 다만 키는 고정이어야 한다 (사건마다 늘었다 줄었다 하면 글자가 위아래로 튄다).
  const bodyCol = nar ? /\.ps-body \{[^}]*flex-direction:\s*column/.test(nar[0]) : false;
  const bodyFix = nar ? /\.ps-body \{[^}]*height:\s*\d+px/.test(nar[0]) : false;
  const clockRow = nar ? /\.ps-clock \{[^}]*flex-direction:\s*row/.test(nar[0]) : false;
  const photoCol = nar ? /\.play-card\.has-photo \{[^}]*flex-direction:\s*column/.test(nar[0]) : false;
  const panel = bodyCol && bodyFix && clockRow && photoCol;
  console.log(`   좁은 화면: 버튼 줄 접힘 ${navWrap && navFit ? '✅' : '❌'} · 노치 여백 ${safe ? '✅' : '❌'}`
    + ` · 물음 버튼 세로 ${askCol ? '✅' : '❌'} · 손가락 크기 44px ${tap ? '✅' : '❌'}`
    + ` · 소개 패널 세로쌓기 ${panel ? '✅ (날짜 한 줄 · 키 고정)' : '❌'}`);
  if (!navWrap || !navFit || !safe || !askCol || !tap || !panel) errs++;
}

// 세로로 긴 손전화에서 카메라 — 앞서 보는 양이 화면 폭에 맞게 줄고, 앞뒤로 안 튀어야 한다.
// 고정된 world 값(150)을 쓰던 동안엔 화면 반폭(≈210)의 71% 를 앞서 봐서,
// 진행선이 오른쪽으로 밀려났다 사건마다 되돌아오는 것처럼 보였다.
{
  const api = globalThis.window.__rescene;
  const cam = api.camera;
  const W0 = globalThis.window.innerWidth;
  const H0 = globalThis.window.innerHeight;
  const resize = () => fire('resize', (h) => h.el === globalThis.window && h.type === 'resize');
  if (api.play.active) { clickOn('btn-play'); step(4); }
  globalThis.window.innerWidth = 390;           // 세로로 긴 손전화
  globalThis.window.innerHeight = 844;
  resize();
  const halfW = Math.hypot(120, 235, 940) * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect;
  clickOn('btn-play');
  step(8);
  let last = null, back = 0, backOne = 0, lead = 0, n = 0, headSeen2 = 0;
  let soloSeen = 0, soloOthers = 0;
  const soloAt = new Set();          // 남는 이름표가 선 자리 (같아야 「표준화」다)
  for (let k = 0; k < 1200 && api.play.active; k++) {
    step(1);
    // 첫 150프레임은 전체 보기에서 재생 자리로 날아오는 구간이라 뺀다
    if (k < 150) continue;
    n++;
    // 좁은 화면에서는 시간선 위 날짜 이름표를 띄우지 않는다 (아래 큰 시계와 겹친다)
    if (api.headAnchor.visible) headSeen2++;
    // 그리고 3D 위에는 지금 비추는 것 하나만 남는다 — 그 하나는 밀려나지 않아야
    // 사건마다 같은 자리에 선다(밀어내기에서 빼지 않으면 안 보이는 것들이 계속 민다)
    // 자리가 다 잡힌 뒤(소개가 무르익은 뒤)에만 잰다 — 그 전에는 직전 이름표가
    // 제자리로 돌아오는 중이라 값이 흐른다
    const settled = api.play.hold > 0 && api.play.holdMax - api.play.hold > 2;
    if (settled) {
      const movable = api.declutter.filter((d) => !d.fixed && d.el && d.el.classList && d.el.classList.contains);
      const now = movable.find((d) => d.el.classList.contains('is-focus'));
      // 지금 비추는 이름표가 아직 안 정해진 프레임(빅뱅이 잦아들기를 기다리는 중)은 건너뛴다
      if (now) {
        soloSeen++;
        soloAt.add(`${Math.round(now.cur.x)},${Math.round(now.cur.y)}`);
        for (const d of movable) {
          if (d === now) continue;
          if (d.cur && Math.hypot(d.cur.x, d.cur.y) > 1) soloOthers++;
        }
      }
    }
    const tx = api.controls.target.x;
    if (last !== null) { const d = tx - last; if (d < 0) { back += -d; backOne = Math.max(backOne, -d); } }
    last = tx;
    // 앞서 보는 폭은 사건을 비추지 않는 동안에만 잰다 (비출 땐 사건 자리로 옮겨 가므로)
    if (api.play.hold <= 0) lead = Math.max(lead, tx - api.play.front);
  }
  if (api.play.active) { clickOn('btn-play'); step(4); }
  globalThis.window.innerWidth = W0;
  globalThis.window.innerHeight = H0;
  resize();
  const leadPct = lead / halfW;
  // 남기는 건 지금 사건 · 지금 MV · 안내 칩뿐 (CSS 로 감춘다)
  const soloCss = /body\.is-playing #labels > \*:not\(\.is-focus\):not\(\.is-hot\)\s*\{/.test(CSS);
  // 이름표는 늘 같은 자리 하나 — 가로는 사건에 맞춰 가운데(0), 세로는 사건 위(음수)
  const spots = [...soloAt];
  const one = spots.length === 1;
  const above = one && (() => { const [x, y] = spots[0].split(',').map(Number); return x === 0 && y <= -30; })();
  const soloOk = soloSeen > 0 && soloOthers === 0 && soloCss && one && above;
  const ok = n > 400 && leadPct < 0.25 && back < 60 && backOne < halfW * 0.1 && headSeen2 === 0 && soloOk;
  console.log(`   세로 화면 카메라: ${n}프레임 · 앞서 보는 폭 ${lead.toFixed(0)} / 화면 반폭 ${halfW.toFixed(0)}`
    + ` = ${(leadPct * 100).toFixed(0)}% · 뒤로 물러남 총 ${back.toFixed(0)} · 한 번에 최대 ${backOne.toFixed(1)}`
    + ` · 시간선 위 날짜 ${headSeen2 === 0 ? '✅ 안 뜸' : `❌ ${headSeen2}프레임`}`
    + ` · 이름표는 지금 것 하나만 ${soloCss ? '✅' : '❌'}`
    + ` · 선 자리 ${spots.length}가지 [${spots.join(' ')}] ${one && above ? '✅ 늘 사건 위 가운데' : '❌'}`
    + `${soloOthers ? ` · ❌ 나머지 ${soloOthers}번 밀림` : ''} ${ok ? '✅' : '❌'}`);
  if (!ok) errs++;
}

// 「소리 없이」 길 — 유튜브를 아예 안 문다. 나중에 🔊 를 누르면 그때 문다.
{
  const api = globalThis.window.__rescene;
  const g = api.askGate;
  if (api.play.active) { clickOn('btn-play'); step(4); }
  g.reset();
  const plays0 = bgm.plays;
  clickOn('btn-play');
  const asked = g.el._classes.has('is-on') && !api.play.active;
  clickOn('ask-no');
  step(8);
  const quiet = api.play.active && bgm.plays === plays0 && g.choice === false;
  clickOn('play-mute');            // 🔊 — 이제야 유튜브를 문다
  step(4);
  const late = bgm.plays > plays0 && g.choice === true;
  console.log(`   소리 없이: 물음 ${asked ? '✅' : '❌'} · 유튜브 안 뭄 ${quiet ? '✅' : '❌'} · 나중에 켜면 뭄 ${late ? '✅' : '❌'}`);
  if (!asked || !quiet || !late) errs++;
  if (api.play.active) { clickOn('btn-play'); step(4); }
}

console.log('▸ 키보드');
for (const key of ['m', 'Escape', 'ArrowRight', 'ArrowLeft', '0', 'Home', 'm', 'M', 'Escape'])
  fire(`key ${key}`, (h) => h.el === window && h.type === 'keydown', { key });

// 4) 캔버스 포인터 + 리사이즈 + 스크러버 호버
console.log('▸ 포인터 · 리사이즈');
for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointerleave', 'wheel'])
  fire(t, (h) => h.type === t);
fire('resize', (h) => h.el === window && h.type === 'resize');
fire('scrub hover', (h) => h.type === 'pointerenter' || h.type === 'pointerleave');

// 5) 루프를 길게 돌린다 (선택/호버 상태가 섞인 채로)
console.log('▸ 렌더 루프 60프레임');
try { step(60); } catch (e) { errs++; console.log(`   ❌ 루프: ${e.stack.split('\n').slice(0,2).join(' | ')}`); }

console.log(errs ? `\n❌ 상호작용 오류 ${errs}건` : '\n✅ 상호작용 경로 전부 통과');
process.exit(errs ? 1 : 0);
