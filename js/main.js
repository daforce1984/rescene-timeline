/**
 * RESCENE — SACRED TIMELINE (2024 활동기 → 2026 역주행)
 *
 * 우주 공간에 떠 있는 오렌지빛 타임라인. 로키의 성스러운 타임라인 톤.
 * 2026-03-20 대박 분기점에서 새 시간선이 갈라져 나와 이후를 이어받고,
 * 원래 본류는 가늘고 어둡게 계속 흐른다. 본류 아래에는 얇은 보조 시간선.
 *
 * URL 파라미터
 *   ?intro=0     : 진입 카메라 연출 생략
 *   ?era=2026    : 해당 연도 구간을 바로 보여줌
 *   ?e=<사건 id> : 해당 분기를 선택한 상태로 시작
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { EVENTS, KINDS, TIME, ERAS, PAST, PERIODS, RADIO, MVS, CHANNEL, BGM, DRIVE, STAFF, MEMBERS, SHAME, AD, BUY, GAS, GAS_CUT, HOME_CAM, GROUP } from './data.js';

/* ==================================================================
 * 0. 유틸
 * ================================================================== */

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** 재현 가능한 난수 — 새로고침해도 배치가 흔들리지 않게 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20240326);

const params = new URLSearchParams(location.search);

/** 연도별 축척이 다른 구간 선형 매핑 */
function dateToX(dateStr) {
  const t = Date.parse(dateStr + 'T00:00:00Z');
  // 데뷔 이전(파묘 구간)은 훨씬 압축된 별도 축척을 쓴다
  if (t < TIME.start) {
    const a = Date.parse(PAST.from + 'T00:00:00Z');
    return lerp(PAST.x0, PAST.x1, clamp((t - a) / (TIME.start - a), 0, 1));
  }
  for (let i = 0; i < ERAS.length; i++) {
    const e = ERAS[i];
    const a = Date.parse(e.from + 'T00:00:00Z');
    const b = Date.parse(e.to + 'T00:00:00Z');
    if (t < b || i === ERAS.length - 1) return lerp(e.x0, e.x1, clamp((t - a) / (b - a), 0, 1));
  }
  return TIME.xMin;
}
const formatDate = (s) => {
  const [y, m, d] = s.split('-');
  return `${y}. ${m}. ${d}`;
};

/* --- 절차적 텍스처 ------------------------------------------------- */

/**
 * 발광 텍스처.
 * 그라디언트 스톱 몇 개로 만들면 경계가 보여서 "캔버스에 원 하나 그린" 티가 난다.
 * 픽셀마다 폴오프를 직접 계산해 — 작고 뜨거운 심 + 아주 넓고 부드러운 자락 —
 * 경계 없이 사라지는 곡선을 쓴다.
 */
function makeRadialTexture(size, falloff) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const h = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - h + 0.5) / h;
      const dy = (y - h + 0.5) / h;
      const r = Math.sqrt(dx * dx + dy * dy);
      const a = r >= 1 ? 0 : clamp(falloff(r), 0, 1) * Math.pow(1 - r, 0.55); // 가장자리에서 정확히 0
      const i = (y * size + x) * 4;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** 부드러운 광원 — 뜨거운 심 + 넓은 자락 */
function makeGlowTexture(size = 512) {
  return makeRadialTexture(size, (r) => Math.exp(-r * r * 7.4) * 0.5 + Math.pow(1 - r, 3.1) * 0.55);
}

/** 아나모픽 스트릭 — 가로로 길고 위아래로 아주 부드럽게 사라지는 렌즈 플레어 */
function makeAnamorphTexture(w = 512, h = 128) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      const v = (y / (h - 1)) * 2 - 1;
      const along = Math.exp(-u * u * 5.5) * 0.75 + Math.exp(-u * u * 44) * 0.5;
      const across = Math.exp(-v * v * 26);
      const i = (y * w + x) * 4;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(clamp(along * across, 0, 1) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** 구름 같은 성운 텍스처 — 소프트 블롭을 겹쳐 쌓고 가장자리를 지운다 */
/**
 * 성운 텍스처.
 * 원형 블롭만 쌓으면 물감 얼룩처럼 보인다. 세 겹으로 쌓아 결을 만든다:
 *   1) 넓고 옅은 바탕  2) 중간 덩어리  3) 결을 만드는 가늘고 긴 필라멘트
 * 마지막에 값 잡음으로 갉아내 가장자리를 너덜너덜하게 만든다.
 */
function makeNebulaTexture(size, hue0, hue1, blobs = 420) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';
  const col = new THREE.Color();
  const rgbOf = (h, sat, lig) => {
    col.setHSL(h, sat, lig);
    return `${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0}`;
  };

  // 1~2) 크기가 다른 덩어리를 여러 층으로
  for (let layer = 0; layer < 3; layer++) {
    const n = Math.round(blobs * [0.22, 0.45, 0.33][layer]);
    const rMin = [0.12, 0.05, 0.018][layer];
    const rSpan = [0.26, 0.14, 0.055][layer];
    const aMul = [0.55, 1, 1.5][layer];
    for (let i = 0; i < n; i++) {
      const cx = size * (0.5 + (rng() - 0.5) * 0.9);
      const cy = size * (0.5 + (rng() - 0.5) * 0.9);
      const r = size * (rMin + Math.pow(rng(), 1.8) * rSpan);
      const rgb = rgbOf(lerp(hue0, hue1, rng()), 0.62 + rng() * 0.36, 0.36 + rng() * 0.3);
      const a = (0.012 + rng() * 0.04) * aMul;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(0.42, `rgba(${rgb},${a * 0.45})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3) 필라멘트 — 덩어리 사이를 잇는 가늘고 긴 결
  for (let i = 0; i < Math.round(blobs * 0.3); i++) {
    const cx = size * (0.5 + (rng() - 0.5) * 0.82);
    const cy = size * (0.5 + (rng() - 0.5) * 0.82);
    const len = size * (0.08 + Math.pow(rng(), 1.6) * 0.34);
    const wid = size * (0.004 + rng() * 0.016);
    const ang = rng() * Math.PI;
    const rgb = rgbOf(lerp(hue0, hue1, rng()), 0.5 + rng() * 0.4, 0.5 + rng() * 0.3);
    const a = 0.02 + rng() * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(0.5, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, wid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 값 잡음으로 갉아내 가장자리를 너덜너덜하게
  ctx.globalCompositeOperation = 'destination-out';
  const holes = Math.round(blobs * 0.5);
  for (let i = 0; i < holes; i++) {
    const cx = size * rng();
    const cy = size * rng();
    const r = size * (0.01 + Math.pow(rng(), 2) * 0.13);
    const a = 0.05 + rng() * 0.22;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 바깥으로 갈수록 사라진다
  const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.5);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.72, 'rgba(0,0,0,0.72)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function makeStreakTexture(w = 256, h = 32) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.94, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 곡선을 따라 반지름이 변하는 튜브.
 * TubeGeometry는 반지름 고정이라, 끝으로 갈수록 가늘어지는 필라멘트를 위해 직접 만든다.
 */
function taperedTube(curve, radiusFn, tubularSegments = 120, radialSegments = 8) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = radiusFn(u);
    for (let j = 0; j <= radialSegments; j++) {
      const th = (j / radialSegments) * Math.PI * 2;
      const s = Math.sin(th);
      const c = -Math.cos(th);
      v.set(N.x * c + B.x * s, N.y * c + B.y * s, N.z * c + B.z * s);
      normal.push(v.x, v.y, v.z);
      position.push(P.x + r * v.x, P.y + r * v.y, P.z + r * v.z);
      uv.push(u, j / radialSegments);
    }
  }
  const stride = radialSegments + 1;
  for (let i = 1; i <= tubularSegments; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = stride * (i - 1) + (j - 1);
      const b = stride * i + (j - 1);
      const c = stride * i + j;
      const d = stride * (i - 1) + j;
      index.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(index);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/* ==================================================================
 * 1. 필라멘트 셰이더
 * ================================================================== */

const FILAMENT_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNrm;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNrm  = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FILAMENT_FRAG = /* glsl */ `
  uniform vec3  uGlow;
  uniform vec3  uCore;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uFlowScale;
  uniform float uHeadFade;
  uniform float uTailFade;
  uniform float uSelected;
  uniform float uFlicker;
  uniform float uRimPower;
  uniform float uGrain;
  uniform float uBoostAt;   // 이 지점(0..1) 이후 밝기가 변한다. 2.0 이면 비활성
  uniform float uBoostAmt;  // 양수면 증폭, 음수면 감쇠
  uniform float uReveal;      // 이 지점(0..1)까지만 그린다. 2.0 이면 전체
  uniform float uRevealFrom;  // 이 지점(0..1) 이전은 아예 안 그린다. -1 이면 비활성
  uniform float uAppear;    // 등장 페이드 0..1
  uniform float uThinA;     // 이 구간(0..1)에 걸쳐 서서히 제 굵기가 된다. -1 이면 비활성
  uniform float uThinB;
  uniform float uThinAmt;   // 감쇠량(음수)
  uniform vec3  uSat;       // 채도 3단계 — 연습생 / 데뷔 후 / 대박 후
  uniform vec2  uSatU;      // 단계가 바뀌는 지점(0..1). 상수 채도면 둘 다 -1

  varying vec2 vUv;
  varying vec3 vNrm;
  varying vec3 vView;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }

  void main() {
    float ndv  = abs(dot(normalize(vNrm), normalize(vView)));
    float rim  = pow(1.0 - ndv, uRimPower);
    float body = mix(0.18, 1.0, rim);

    float f1 = fract(vUv.x * uFlowScale - uTime * uSpeed);
    float f2 = fract(vUv.x * uFlowScale * 2.7 - uTime * uSpeed * 1.9 + 0.37);
    float p1 = smoothstep(0.0, 0.04, f1) * smoothstep(0.26, 0.06, f1);
    float p2 = smoothstep(0.0, 0.03, f2) * smoothstep(0.14, 0.03, f2);

    float n = noise(vec2(vUv.x * 26.0, vUv.y * 3.0 - uTime * 0.55));
    float shimmer = mix(0.74, 1.16, n) * (0.92 + 0.08 * sin(vUv.x * 140.0 - uTime * 3.1));
    shimmer = mix(1.0, shimmer, uGrain);

    float fade = smoothstep(0.0, uHeadFade, vUv.x) * smoothstep(1.0, 1.0 - uTailFade, vUv.x);

    vec3 col = uGlow * body * shimmer;
    col += uCore * p1 * 1.55;
    col += uCore * p2 * 0.9;
    col += uCore * uSelected * 0.5;
    col *= uIntensity * fade * uFlicker;
    col *= 1.0 + uBoostAmt * smoothstep(uBoostAt - 0.015, uBoostAt + 0.05, vUv.x);
    // 아직 아무 일도 일어나지 않은 구간 → 관심이 붙는 구간으로 서서히 넘어간다
    if (uThinA > -0.5) col *= 1.0 + uThinAmt * (1.0 - smoothstep(uThinA, uThinB, vUv.x));

    // 시간이 흐를수록 색이 살아난다. 연습생 시절은 거의 흑백에 가깝다.
    float sat = uSat.x;
    sat = mix(sat, uSat.y, smoothstep(uSatU.x - 0.012, uSatU.x + 0.045, vUv.x));
    sat = mix(sat, uSat.z, smoothstep(uSatU.y - 0.012, uSatU.y + 0.045, vUv.x));
    col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, sat);

    // 재생 연출 — 진행선 앞쪽은 아직 그리지 않는다.
    // 경계를 넓게 풀고 앞머리를 달궈, 선이 뚝 잘리지 않고 자라 들어오게 한다.
    if (uReveal < 1.5) {
      float grow = smoothstep(uReveal, uReveal - 0.022, vUv.x);
      float tipHeat = exp(-abs(vUv.x - uReveal) * 260.0);
      col = col * grow + uCore * tipHeat * 1.7 * step(vUv.x, uReveal);
    }
    // 재생 중에는 이야기가 시작되는 지점 이전(파묘 구간·꼬리)을 통째로 지운다
    if (uRevealFrom > -0.5) col *= smoothstep(uRevealFrom, uRevealFrom + 0.02, vUv.x);
    col *= uAppear;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function filamentMaterial(o) {
  return new THREE.ShaderMaterial({
    vertexShader: FILAMENT_VERT,
    fragmentShader: FILAMENT_FRAG,
    uniforms: {
      uGlow: { value: new THREE.Color(o.glow) },
      uCore: { value: new THREE.Color(o.core) },
      uTime: { value: 0 },
      uIntensity: { value: o.intensity ?? 1 },
      uSpeed: { value: o.speed ?? 0.18 },
      uFlowScale: { value: o.flowScale ?? 2 },
      uHeadFade: { value: o.headFade ?? 0.02 },
      uTailFade: { value: o.tailFade ?? 0.02 },
      uSelected: { value: 0 },
      uFlicker: { value: 1 },
      uRimPower: { value: o.rimPower ?? 1.7 },
      uGrain: { value: o.grain ?? 1 },
      uBoostAt: { value: o.boostAt ?? 2 },
      uBoostAmt: { value: o.boostAmt ?? 0 },
      uReveal: { value: 2 },
      uRevealFrom: { value: -1 },
      uAppear: { value: 1 },
      uThinA: { value: o.thinA ?? -1 },
      uThinB: { value: o.thinB ?? 0 },
      uThinAmt: { value: o.thinAmt ?? 0 },
      uSat: { value: new THREE.Vector3(...(o.sat ?? [1, 1, 1])) },
      uSatU: { value: new THREE.Vector2(...(o.satU ?? [-1, -1])) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/* ==================================================================
 * 2. 렌더러 · 씬 · 카메라 · 컨트롤
 * ================================================================== */

const app = document.getElementById('app');
const canvas = document.getElementById('scene');

/**
 * 손가락 화면(휴대폰·태블릿)은 GPU 여유가 훨씬 적다.
 * 여기서 픽셀 배율과 MSAA 를 줄이지 않으면 프레임이 뚝뚝 끊기는 정도가 아니라,
 * 큰 버퍼를 잡다 놓치면서 **화면이 번쩍인다**. 눈에 보이는 그림은 거의 그대로다.
 */
const LOW_GPU = (() => {
  // 손가락으로 만지는 화면인지가 실제 신호다. 창 크기는 matchMedia 가 없는 데서만 쓴다
  // (1280×720 노트북까지 모바일로 몰아 버리면 안 되니 경계를 낮게 잡는다).
  try { if (window.matchMedia) return !!window.matchMedia('(pointer: coarse)').matches; } catch {}
  return Math.min(window.innerWidth, window.innerHeight) <= 560;
})();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_GPU ? 1.6 : 2.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

/* 모바일에서는 메모리가 모자라면 브라우저가 GL 컨텍스트를 통째로 회수해 간다.
   그때 화면이 한 번 까맣게 번쩍인다. 기본 동작대로 두면 그걸로 끝이지만,
   preventDefault 로 막아 두면 브라우저가 다시 물려 주고 three 가 알아서 복구한다. */
let glLost = 0;
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glLost++; }, false);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.id = 'labels';
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03040a);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 9000);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.screenSpacePanning = true;
controls.minDistance = 22;
controls.maxDistance = 3000;
controls.rotateSpeed = 0.4;
controls.zoomSpeed = 0.9;
controls.panSpeed = 1.15;
controls.minPolarAngle = Math.PI * 0.05;
controls.maxPolarAngle = Math.PI * 0.95;
// 요구사항: 패닝 = 마우스 가운데 버튼, 확대/축소 = 휠
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

canvas.addEventListener('pointerdown', (e) => { if (e.button === 1) e.preventDefault(); });
canvas.addEventListener('auxclick', (e) => e.preventDefault());
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/**
 * 후처리를 쓰면 캔버스의 antialias 는 무시된다 — 씬이 렌더타깃에 먼저 그려지기 때문.
 * 그래서 컴포저용 렌더타깃을 직접 만들어 MSAA(samples)를 켠다.
 * 얇은 발광 선이 많아 여기서 픽셀 튐이 확 줄어든다.
 */
// 모바일에서는 MSAA 를 끈다 — half-float 렌더타깃 + 멀티샘플 조합은 기기 드라이버마다
// 되고 안 되고가 갈려서, 안 되는 쪽에서 화면이 번쩍인다. 계단은 아래 SMAA 가 받는다.
const AA_SAMPLES = LOW_GPU ? 0 : 4;
const composerRT = new THREE.WebGLRenderTarget(
  Math.max(1, Math.floor(window.innerWidth * renderer.getPixelRatio())),
  Math.max(1, Math.floor(window.innerHeight * renderer.getPixelRatio())),
  { type: THREE.HalfFloatType, samples: AA_SAMPLES }
);
const composer = new EffectComposer(renderer, composerRT);
// 직접 만든 렌더타깃을 넘기면 내부 크기가 픽셀 단위로 잡히므로 CSS 크기로 다시 맞춘다
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.68, 0.27);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// MSAA 로도 남는 계단(특히 얇은 선과 블룸 경계)을 한 번 더 다듬는다
composer.addPass(new SMAAPass(window.innerWidth, window.innerHeight));

const GLOW_TEX = makeGlowTexture(512);
const SPARK_TEX = makeRadialTexture(128, (r) => Math.exp(-r * r * 15) * 0.85 + Math.pow(1 - r, 2.4) * 0.3);
const ANAMORPH_TEX = makeAnamorphTexture();

/** 꽃잎 — 한쪽이 뾰족하고 반대쪽이 둥근 타원 */
function makePetalTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / (size - 1)) * 2 - 1;   // 길이 방향
      const v = (y / (size - 1)) * 2 - 1;   // 폭 방향
      // 뾰족한 끝(u=-1) → 넓은 끝(u=+1)
      const wid = Math.sqrt(Math.max(0, 1 - u * u)) * (0.42 + 0.58 * (u * 0.5 + 0.5));
      const t = wid > 0 ? clamp(1 - Math.abs(v) / wid, 0, 1) : 0;
      // 가장자리는 부드럽게, 안쪽은 살짝 밝게
      const a = Math.pow(t, 0.75) * (0.72 + 0.28 * Math.pow(t, 3));
      const i = (y * size + x) * 4;
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      d[i + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}
const PETAL_TEX = makePetalTexture();
/** 별은 점으로 보여야 한다 — 심이 좁고 자락이 짧은 별도 텍스처 */
const STAR_TEX = makeRadialTexture(64, (r) => Math.exp(-r * r * 30) * 0.95 + Math.pow(1 - r, 3.6) * 0.22);
const STREAK_TEX = makeStreakTexture();
const NODE_GEO = new THREE.IcosahedronGeometry(1, 3);
const RING_GEO = new THREE.TorusGeometry(1, 0.045, 8, 64);
const HIT_GEO = new THREE.SphereGeometry(1, 12, 8);
const SHOCK_GEO = new THREE.RingGeometry(0.94, 1, 96);

/**
 * 노드에서 라벨로 이어지는 선.
 * 밋밋한 1px 선 대신 시간선과 같은 필라멘트 튜브로 그린다 —
 * 가는 분기가 뻗어 나온 것처럼 보이고, 에너지 펄스도 같이 흐른다.
 *
 * 라벨은 겹침 해소로 매 프레임 움직이므로 지오메트리를 다시 만들 수 없다.
 * +Y 방향 단위 튜브를 하나만 만들어 두고, 위치·회전·길이만 바꿔 늘려 쓴다.
 */
const LEADER_UP = new THREE.Vector3(0, 1, 0);
const LEADER_GEO = (() => {
  const c = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.34, 0),
    new THREE.Vector3(0, 0.67, 0),
    new THREE.Vector3(0, 1, 0),
  ]);
  c.arcLengthDivisions = 40;
  return taperedTube(c, (u) => lerp(0.72, 0.2, Math.pow(u, 0.7)), 26, 6);
})();
const leaderMats = [];
const ldDir = new THREE.Vector3();

function makeLeader(from, to, color) {
  const mat = filamentMaterial({
    glow: color, core: 0xfff2dc, intensity: 0.3, speed: 0.42, flowScale: 2.4,
    headFade: 0.07, tailFade: 0.14, rimPower: 1.9, grain: 0.5,
  });
  const mesh = new THREE.Mesh(LEADER_GEO, mat);
  mesh.frustumCulled = false;
  leaderMats.push(mat);

  // 노드와 라벨 양쪽에서 조금 떼어 놓아야 붙어 보이지 않는다
  mesh.userData.setEnds = (a, b) => {
    ldDir.copy(b).sub(a);
    const len = ldDir.length();
    if (len < 0.001) { mesh.visible = false; return; }
    ldDir.normalize();
    const gapA = Math.min(7, len * 0.14);
    const gapB = Math.min(14, len * 0.2);
    const span = Math.max(0.001, len - gapA - gapB);
    mesh.visible = true;
    mesh.position.copy(a).addScaledVector(ldDir, gapA);
    mesh.quaternion.setFromUnitVectors(LEADER_UP, ldDir);
    mesh.scale.set(1, span, 1);
  };
  mesh.userData.setEnds(from, to);
  return mesh;
}


/* ==================================================================
 * 3. 우주 배경
 * ================================================================== */

function buildStars() {
  const COUNT = 9000;
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const siz = new Float32Array(COUNT);
  const twk = new Float32Array(COUNT);
  const c = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    const r = 900 + Math.pow(rng(), 0.6) * 3400;
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(2 * rng() - 1);
    pos[i * 3] = 340 + r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.62;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);

    const t = rng();
    if (t > 0.9) c.setHSL(0.075, 0.6, 0.72);
    else if (t > 0.8) c.setHSL(0.03, 0.55, 0.66);
    else if (t > 0.66) c.setHSL(0.58, 0.42, 0.74);
    else c.setHSL(0.12, 0.08, 0.5 + rng() * 0.45);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;

    siz[i] = 1.0 + Math.pow(rng(), 3.4) * 8;
    twk[i] = rng() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('tw', new THREE.BufferAttribute(twk, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: STAR_TEX }, uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float tw;
      varying vec3 vColor;
      varying float vTw;
      varying float vDim;
      uniform float uTime;
      uniform float uPR;
      void main() {
        vColor = color;
        // 반짝임은 아주 얕고 느리게. 큰 별만 조금 흔들리고 작은 별은 가만히 있는다.
        float amp = 0.03 + 0.10 * smoothstep(2.0, 7.5, size);
        float rate = 0.16 + fract(tw) * 0.34;
        vTw = 1.0 + amp * sin(uTime * rate + tw * 6.283);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);

        // 깜빡임의 진짜 원인은 반짝임 식이 아니라 **1픽셀보다 작은 점**이었다.
        // 한 픽셀도 못 채우는 점은 카메라가 조금만 움직여도 래스터라이저가
        // 찍었다 말았다 해서 화면에서 잘게 떤다. 게다가 가산 합성 + 블룸이라
        // 그 깜빡임이 그대로 증폭된다.
        // 그래서 **최소 크기를 한 픽셀 넘게 붙잡아 두고, 원래 크기만큼 어둡게** 만든다.
        // 넓이(px^2)에 비례해 낮추므로 화면에 뿌려지는 빛의 총량은 그대로다.
        // gl_PointSize 는 이미 프레임버퍼 픽셀 단위다 (uPR 이 곱해져 있다).
        // 1.8px 아래로는 안 내려가게 붙잡고, 원래 넓이 비율(k^2)만큼 어둡게 한다.
        float px = size * uPR * (640.0 / -mv.z);
        float minPx = 1.8;
        float k = clamp(px / minPx, 0.0, 1.0);
        vDim = k * k;
        gl_PointSize = max(px, minPx);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vTw;
      varying float vDim;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vDim;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vColor * vTw * a * 1.9, a);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { mat, pts };
}
const stars = buildStars();

/**
 * 가스 덩어리 텍스처 — **무늬는 없다.**
 * 가운데에서 가장자리로 부드럽게 풀리는 것뿐이고, 윤곽만 낮은 주파수로 일그러뜨려
 * 완전한 원판처럼 보이지 않게 한다. 안쪽에 결이 생기면 배경이 아니라 그림이 된다.
 */
function makeGasTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const h = size / 2;
  // 윤곽을 흔들 낮은 주파수 세 겹 (위상은 매번 다르게)
  const w = [1, 2, 3].map((k) => ({ k: k + 1, a: 0.16 / k, p: rng() * Math.PI * 2 }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - h) / h;
      const dy = (y - h) / h;
      let r = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      let edge = 1;
      for (const o of w) edge += o.a * Math.sin(th * o.k + o.p);
      r /= Math.max(0.4, edge);
      // 가운데는 평평하고 가장자리에서만 길게 풀린다
      const a = Math.pow(clamp(1 - r, 0, 1), 2.2) * (0.55 + 0.45 * clamp(1 - r * 1.6, 0, 1));
      const o = (y * size + x) * 4;
      d[o] = 255; d[o + 1] = 255; d[o + 2] = 255;
      d[o + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 배경 가스 — 시간선 주변에 낮게 깔리는 한 가지 색의 기운.
 * 멀리 뒤에 세운 성운이 아니라 선을 따라 깔리므로, 카메라가 움직이면 같이 흐른다.
 *
 * 거제 야호 이전은 **가스가 없다**. 그런데 성운 판이 한 장에 1,500~3,700 유닛이라
 * 가운데를 분기점 뒤에 둬도 판 자체는 한참 앞까지 걸친다. 그래서 판을 옮기는 게 아니라
 * 프래그먼트에서 **월드 x 를 보고 잘라 낸다** — 분기점 앞은 0, 뒤로 240 유닛에 걸쳐 번진다.
 */
const GAS_CUT_X = dateToX(GAS_CUT);
const GAS_CUT_SPAN = 240;
function cutBeforeNexus(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = { value: GAS_CUT_X };
    sh.uniforms.uCutSpan = { value: GAS_CUT_SPAN };
    sh.vertexShader = 'varying float vWX;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vWX = (modelMatrix * vec4(transformed, 1.0)).x;'
    );
    sh.fragmentShader =
      'varying float vWX;\nuniform float uCut;\nuniform float uCutSpan;\n' +
      sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  float gcut = smoothstep(uCut, uCut + uCutSpan, vWX);\n  gl_FragColor.rgb *= gcut;\n  gl_FragColor.a *= gcut;'
      );
  };
}

const gasBlobs = [];
// 가스는 재생 중 대박 분기에서 빅뱅이 터진 뒤에야 차오른다
let gasWake = false;
let gasT = 1;
function buildNebulae() {
  const g = new THREE.Group();
  const plane = new THREE.PlaneGeometry(1, 1);
  // 무늬 없는 덩어리 — 안은 고르고 가장자리만 부드럽게 풀린다.
  // 윤곽만 조금 일그러뜨려 원판처럼 보이지 않게 한다 (낮은 주파수 세 겹).
  const tex = [0, 1, 2].map(() => makeGasTexture(256));

  for (let i = 0; i < GAS.n; i++) {
    const t = i / Math.max(1, GAS.n - 1);
    const x = lerp(GAS.from, GAS.to, t) + (rng() - 0.5) * ((GAS.to - GAS.from) / GAS.n) * 2.4;
    // 시간선을 따라 깔리게, 그 자리 새 시간선 높이를 기준으로 잡는다
    const base = pointAtX(NEXUS_LINE, clamp(x, TIME.xTailHead, TIME.xTailEnd)).point;

    const mat = new THREE.MeshBasicMaterial({
      map: tex[i % tex.length],
      color: GAS.color,
      transparent: true,
      opacity: GAS.op * (0.6 + rng() * 0.8),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    cutBeforeNexus(mat);
    mat.userData.baseOpacity = mat.opacity;
    const mesh = new THREE.Mesh(plane, mat);
    mesh.position.set(
      x,
      base.y + (rng() - 0.5) * 2 * GAS.spread.y,
      lerp(GAS.spread.z[0], GAS.spread.z[1], rng())
    );
    mesh.scale.setScalar(lerp(GAS.size[0], GAS.size[1], Math.pow(rng(), 0.7)));
    // 판 하나는 옆에서 보면 사라진다. 매 프레임 카메라를 향해 세워 두고
    // 앞뒤로 흩어 놓으면, 돌려 볼 때 앞뒤 덩어리가 서로 스쳐 지나며 부피로 읽힌다.
    // (자기만의 회전은 따로 물려 둬서 전부 같은 모양으로 보이지 않게 한다)
    mesh.userData.spin = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), rng() * Math.PI * 2);
    gasBlobs.push(mesh);
    g.add(mesh);
  }

  g.renderOrder = -20;
  scene.add(g);
}
// 호출은 시간선이 만들어진 뒤(4장 끝)로 미룬다 — 선을 따라 깔아야 해서 NEXUS_LINE 이 필요하다.

function buildDust() {
  const COUNT = 2600;
  const pos = new Float32Array(COUNT * 3);
  const siz = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = 340 + (rng() - 0.5) * 2100;
    pos[i * 3 + 1] = 60 + (rng() - 0.5) * 620;
    pos[i * 3 + 2] = (rng() - 0.5) * 620;
    siz[i] = 0.8 + Math.pow(rng(), 2.4) * 3.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: SPARK_TEX }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float size;
      uniform float uPR;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPR * (280.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(vec3(1.0, 0.62, 0.30) * a * 0.30, a * 0.30);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
const dust = buildDust();

/**
 * 멀리서 지나가는 유성.
 * 예전엔 화면을 가로지르는 굵은 막대 하나였는데, 가깝고 조잡해 보였다.
 * 지금은 아주 멀리(성운 뒤) 아주 느리게, 여러 겹으로 나눠 그린다:
 *   가늘고 긴 꼬리 / 그보다 짧고 밝은 속꼬리 / 머리 발광 / 머리에서 떨어져 나가는 부스러기.
 * 겹마다 길이·투명도가 달라 하나의 굵은 선이 아니라 흩어지는 자취로 보인다.
 */
function buildMeteors() {
  const COUNT = 4;
  const list = [];
  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const bar = (len, w, col, op) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(len, w),
      new THREE.MeshBasicMaterial({
        map: ANAMORPH_TEX, color: col, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    m.frustumCulled = false;
    return m;
  };

  for (let i = 0; i < COUNT; i++) {
    const g = new THREE.Group();
    g.visible = false;
    // 차가운 것 하나, 나머지는 따뜻한 톤
    const cold = i === 1;
    const tail = cold ? 0xa8c4ff : 0xffd0a2;
    const core = cold ? 0xe8f0ff : 0xfff2dc;

    const long = bar(1, 1, tail, 0.2);      // 길고 흐린 자취
    const mid = bar(1, 1, tail, 0.34);      // 짧고 진한 속꼬리
    const hot = bar(1, 1, core, 0.5);       // 머리 쪽 밝은 심
    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: GLOW_TEX, color: core, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    g.add(long, mid, hot, head);

    // 머리에서 떨어져 나가는 부스러기
    const bits = [];
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: SPARK_TEX, color: tail, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      g.add(sp);
      bits.push({ sp, lag: 0.03 + rng() * 0.16, off: (rng() - 0.5) * 26, size: 3 + rng() * 5 });
    }

    scene.add(g);
    list.push({
      g, long, mid, hot, head, bits,
      t: 2, wait: 6 + i * 9 + rng() * 14,
      from: new THREE.Vector3(), to: new THREE.Vector3(),
      dur: 1, len: 1, scale: 1,
    });
  }

  return function update(dt) {
    for (const s of list) {
      if (s.t >= 1) {
        s.g.visible = false;
        s.wait -= dt;
        if (s.wait > 0) continue;
        s.t = 0;
        // 아주 느리게 — 눈으로 좇을 수 있을 만큼
        s.dur = 4.5 + rng() * 4;
        s.wait = 16 + rng() * 30;

        // 성운(z −1500~−2900)보다도 멀리 둔다
        const depth = -2600 - rng() * 1800;
        const sx = 340 + (rng() - 0.5) * 5200;
        const sy = 900 + rng() * 1500;
        s.from.set(sx, sy, depth);
        // 거의 수평에 가깝게 비스듬히 흐른다
        const travel = 1500 + rng() * 1800;
        const slope = -0.28 - rng() * 0.3;
        s.to.set(sx + travel * (rng() > 0.5 ? 1 : -1), sy + travel * slope, depth + (rng() - 0.5) * 400);
        s.scale = 0.8 + rng() * 0.7;
        s.g.visible = true;
      }

      s.t += dt / s.dur;
      const k = clamp(s.t, 0, 1);
      // 들어올 때 살짝 빨라졌다가 나갈 때 느려진다
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      s.g.position.lerpVectors(s.from, s.to, e);

      dir.copy(s.to).sub(s.from).normalize();
      s.g.lookAt(camera.position);
      const roll = Math.atan2(dir.y, dir.x);

      // 나타났다 사라지는 동안 자취가 늘었다 줄어든다
      const life = Math.sin(k * Math.PI);
      const grow = Math.pow(life, 0.6);
      const L = 640 * s.scale;

      for (const [m, len, w, op] of [
        [s.long, L * grow, 4.5, 0.16],
        [s.mid, L * 0.45 * grow, 7, 0.26],
        [s.hot, L * 0.16 * grow, 9, 0.4],
      ]) {
        m.rotation.z = roll;
        m.scale.set(Math.max(len, 1), w * s.scale, 1);
        // 자취는 머리 뒤로만 뻗는다
        m.position.set(Math.cos(roll) * -len * 0.5, Math.sin(roll) * -len * 0.5, 0);
        m.material.opacity = op * life;
      }

      s.head.scale.setScalar(15 * s.scale * (0.7 + life * 0.5));
      s.head.material.opacity = 0.55 * life;

      for (const b of s.bits) {
        const bk = clamp(e - b.lag, 0, 1);
        tmp.copy(s.from).lerp(s.to, bk).sub(s.g.position);
        b.sp.position.copy(tmp).add(
          new THREE.Vector3(-Math.sin(roll) * b.off, Math.cos(roll) * b.off, 0)
        );
        b.sp.scale.setScalar(b.size * s.scale);
        b.sp.material.opacity = 0.35 * life * (1 - b.lag * 3);
      }
    }
  };
}
const updateMeteors = buildMeteors();

/* ==================================================================
 * 4. 시간선 시스템
 * ================================================================== */

const NEXUS_EV = EVENTS.find((e) => e.nexus);
const NEXUS_X = dateToX(NEXUS_EV.date);
const RISE_END_X = NEXUS_X + 190; // 새 시간선이 다 솟아오르는 지점
const RISE_Y = 195;              // 새 시간선이 본류 위로 올라가는 높이
const ECHO_Y = -152;             // 메라디오 시간선의 깊이 (분기 아래를 지나간다)
const STAFF_Y = -230;            // 대표와 이사 — 메라디오와 연수아저씨 사이
const DRIVE_Y = -308;            // 나의 연수아저씨 시간선 — 메라디오보다 한 단 더 아래

/** 곡선을 균등 샘플링해 점/프레임을 캐시 */
function sampleCurve(curve, n) {
  const frames = curve.computeFrenetFrames(n, false);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(curve.getPointAt(i / n));
  return { curve, n, pts, nrm: frames.normals, bin: frames.binormals, tan: frames.tangents };
}

/** x 기준 이분 탐색 (샘플의 x 는 단조 증가) */
function pointAtX(line, x) {
  let lo = 0;
  let hi = line.n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (line.pts[mid].x < x) lo = mid + 1;
    else hi = mid;
  }
  const i = clamp(lo, 0, line.n);
  return {
    point: line.pts[i].clone(),
    tangent: line.tan[i].clone(),
    normal: line.nrm[i].clone(),
    binormal: line.bin[i].clone(),
    i,
    u: i / line.n,
  };
}

/** 완만하게 굽이치는 본류 곡선 */
function buildMainCurve() {
  const pts = [];
  for (let x = TIME.xTailHead; x <= TIME.xTailEnd; x += 34) {
    pts.push(
      new THREE.Vector3(
        x,
        Math.sin(x * 0.0105) * 11 + Math.sin(x * 0.0037 + 1.2) * 6,
        Math.cos(x * 0.0082) * 15 + Math.sin(x * 0.0045 + 0.4) * 7
      )
    );
  }
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  c.arcLengthDivisions = 2600;
  return c;
}

const MAIN = sampleCurve(buildMainCurve(), 1800);
const NEXUS_U_MAIN = pointAtX(MAIN, NEXUS_X).u;
/** 안원잘부 채널 개설 지점 — 여기 이전의 본류는 가늘게 그린다 */
const CHANNEL_X = dateToX(CHANNEL.date);
const CHANNEL_U_MAIN = pointAtX(MAIN, CHANNEL_X).u;

/**
 * 채도 단계 — 연습생 시절은 거의 색이 빠져 있고, 데뷔하면서 절반,
 * 대박 지점을 넘어가며 완전히 살아난다.
 */
const DEBUT_X = dateToX(EVENTS.find((e) => e.kind === 'debut').date);
/** 재생 중 시간선을 그리기 시작하는 지점 — 이 앞(파묘 구간과 꼬리)은 아예 안 나온다 */
const PLAY_HEAD_X = ERAS[0].x0;
// 재생은 데뷔가 아니라 멤버 공개(연습생 시절의 끝)에서 시작한다
const PLAY_FROM = Math.min(
  DEBUT_X,
  ...EVENTS.filter((e) => e.kind === 'member').map((e) => dateToX(e.date))
) - 40;
/**
 * 재생은 **오늘**에서 끝난다. 여기서부터가 아직 오지 않은 시간이고,
 * 진행선이 오늘을 넘는 순간 「무수한 가능성」 갈래가 뻗어 나간다.
 * (마지막 콘텐츠가 오늘보다 뒤에 있으면 그것까지는 보여 주고 끝낸다)
 */
const TODAY_X = (() => {
  const t = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const x0 = dateToX(iso(t));
  const x1 = dateToX(iso(new Date(t.getTime() + 864e5)));
  // 날짜 경계에 딱 세우면 되돌려 읽을 때 하루 전으로 떨어진다. 반나절 안쪽에 세운다.
  return x0 + (x1 - x0) * 0.5;
})();
const LAST_CONTENT_X = Math.max(
  ...EVENTS.map((e) => dateToX(e.date)),
  ...EVENTS.filter((e) => e.resurfaced).map((e) => dateToX(e.resurfaced)),
  ...RADIO.episodes.map((e) => dateToX(e.date)),
  ...MVS.map((m) => dateToX(m.date))
);
const PLAY_TO = TODAY_X >= LAST_CONTENT_X ? TODAY_X : LAST_CONTENT_X + 40;

const SAT = [0.2, 0.5, 1];
const satU = (line) => [pointAtX(line, DEBUT_X).u, pointAtX(line, NEXUS_X).u];
/** 분기·노드처럼 한 시점에 붙는 요소는 상수 채도를 쓴다 */
const satAt = (x) => {
  const v = x < DEBUT_X ? SAT[0] : x < NEXUS_X ? SAT[1] : SAT[2];
  return [v, v, v];
};

/** 대박 지점에서 갈라져 나와 위로 솟았다가 나란히 진행하는 새 시간선 */
function buildNexusCurve() {
  const start = pointAtX(MAIN, NEXUS_X).i;
  const pts = [];
  for (let i = start; i <= MAIN.n; i += 5) {
    const p = MAIN.pts[i];
    const k = smoothstep(NEXUS_X, RISE_END_X, p.x);
    pts.push(
      new THREE.Vector3(
        p.x,
        p.y + RISE_Y * k + Math.sin(p.x * 0.013) * 6 * k,
        p.z + 26 * k * Math.sin(p.x * 0.006 + 0.7)
      )
    );
  }
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  c.arcLengthDivisions = 1800;
  return c;
}
const NEXUS_LINE = sampleCurve(buildNexusCurve(), 900);

/**
 * 메라디오 시간선 — 본류 아무 데서나 시작하는 게 아니라,
 * 첫 방송(2024-12-20)이 있는 지점에서 본류에서 갈라져 나와 아래로 내려간 뒤
 * 나란히 흐른다. 시작 지점을 보면 "여기서부터 메라디오"라는 게 바로 읽힌다.
 */
const ECHO_START_X = dateToX(RADIO.episodes[0].date) - 52;   // 분기 지점이 첫 방송 노드에 먹히지 않게 살짝 앞에서
const ECHO_DROP_END_X = ECHO_START_X + 260;

function buildEchoCurve() {
  const pts = [];
  const i0 = pointAtX(MAIN, ECHO_START_X).i;
  for (let i = i0; i <= MAIN.n; i += 8) {
    const p = MAIN.pts[i];
    const k = smoothstep(ECHO_START_X, ECHO_DROP_END_X, p.x);
    pts.push(
      new THREE.Vector3(
        p.x,
        p.y + (ECHO_Y + Math.sin(p.x * 0.021) * 3.5) * k,
        p.z + 12 * k
      )
    );
  }
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  c.arcLengthDivisions = 1800;
  return c;
}
const ECHO = sampleCurve(buildEchoCurve(), 700);

/**
 * 나의 연수아저씨 시간선 — 첫 화(무면허) 지점에서 본류에서 갈라져
 * 메라디오보다 한 단 더 아래로 내려간 뒤 나란히 흐른다.
 */
const DRIVE_START_X = dateToX(DRIVE.episodes[0].date) - 52;
const DRIVE_DROP_END_X = DRIVE_START_X + 300;
/** 졸업식으로 시리즈가 끝난다 — 시간선도 거기서 멈춘다 */
const DRIVE_END_X = dateToX(DRIVE.episodes[DRIVE.episodes.length - 1].date) + 130;

function buildDriveCurve() {
  const pts = [];
  const i0 = pointAtX(MAIN, DRIVE_START_X).i;
  const i1 = pointAtX(MAIN, DRIVE_END_X).i;
  for (let i = i0; i <= i1; i += 8) {
    const p = MAIN.pts[i];
    const k = smoothstep(DRIVE_START_X, DRIVE_DROP_END_X, p.x);
    pts.push(new THREE.Vector3(p.x, p.y + (DRIVE_Y + Math.sin(p.x * 0.017 + 1.4) * 4) * k, p.z + 22 * k));
  }
  // 끝을 정확히 맞춘다 (샘플 간격 때문에 조금 못 미칠 수 있다)
  const last = pointAtX(MAIN, DRIVE_END_X).point;
  pts.push(new THREE.Vector3(last.x, last.y + DRIVE_Y + Math.sin(last.x * 0.017 + 1.4) * 4, last.z + 22));
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  c.arcLengthDivisions = 1800;
  return c;
}
const DRIVE_LINE = sampleCurve(buildDriveCurve(), 700);

/**
 * 대표와 이사 시간선.
 * 메라디오와 연수아저씨 사이를 지난다. 회사 이야기라 본류와 나란히 끝까지 간다.
 */
const STAFF_START_X = dateToX(STAFF.episodes[0].date) - 52;
const STAFF_DROP_END_X = STAFF_START_X + 280;

function buildStaffCurve() {
  const pts = [];
  const i0 = pointAtX(MAIN, STAFF_START_X).i;
  for (let i = i0; i <= MAIN.n; i += 8) {
    const p = MAIN.pts[i];
    const k = smoothstep(STAFF_START_X, STAFF_DROP_END_X, p.x);
    pts.push(new THREE.Vector3(p.x, p.y + (STAFF_Y + Math.sin(p.x * 0.019 + 0.6) * 3.5) * k, p.z + 12 * k));
  }
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  c.arcLengthDivisions = 1800;
  return c;
}
const STAFF_LINE = sampleCurve(buildStaffCurve(), 700);

const LINES = { main: MAIN, nexus: NEXUS_LINE, echo: ECHO, drive: DRIVE_LINE };

// 배경 가스는 시간선을 따라 깔리므로 선이 다 만들어진 지금 세운다
buildNebulae();
const lineOf = (ev) => LINES[ev.line || 'main'];

const timelineMats = [];   // { m, line } — 재생 연출에서 라인별 진행도를 따로 먹인다

/**
 * 재생 연출용 등록소.
 * x(시간축 좌표)와 그때 나타나야 할 오브젝트들을 묶어 둔다.
 * 재생 중에는 진행선 앞쪽 오브젝트를 통째로 감춘다.
 */
const revealables = [];

/** 오브젝트 트리에서 페이드에 쓸 재질/엘리먼트를 모은다 */
function collectFade(o) {
  if (o.isCSS2DObject) return { el: o.element };
  const mats = [];
  o.traverse((c) => {
    const m = c.material;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((mm) => mats.push({ m: mm, base: mm.opacity ?? 1 }));
  });
  return { mats };
}

function revealAt(x, ...objs) {
  const list = objs.filter(Boolean);
  if (!list.length) return;
  revealables.push({ x, objs: list, fades: list.map(collectFade), k: 1, settled: true });
}

/**
 * 하나의 시간선을 헤이즈 + 본체 + 코어 + 나선 가닥으로 구성한다.
 * boost 값으로 특정 지점 이후 증폭(양수)/감쇠(음수)를 준다.
 */
function buildTimelineStrands(line, cfg) {
  const group = new THREE.Group();
  const boostAt = cfg.boostAt ?? 2;
  const sat = cfg.sat ?? SAT;
  const sU = cfg.satU ?? satU(line);
  const thinA = cfg.thinA ?? -1;
  const thinB = cfg.thinB ?? 0;
  const thinAmt = cfg.thinAmt ?? 0;
  const thinR = cfg.thinR ?? 0;
  const R = (base, amt) => (u) =>
    base *
    (1 + (thinA > -0.5 ? thinR * (1 - smoothstep(thinA, thinB, u)) : 0)) *
    (1 + (amt || 0) * smoothstep(boostAt - 0.01, boostAt + 0.06, u));

  const haze = filamentMaterial({
    glow: cfg.hazeGlow, core: cfg.hazeCore, intensity: cfg.hazeI, speed: 0.03, flowScale: 3,
    headFade: cfg.headFade, tailFade: cfg.tailFade, rimPower: 2.6, grain: 0.4,
    boostAt, boostAmt: cfg.boostHaze ?? 0, thinA, thinB, thinAmt, sat, satU: sU,
  });
  group.add(new THREE.Mesh(taperedTube(line.curve, R(cfg.hazeR, cfg.boostRHaze), Math.round(cfg.seg * 0.5), 12), haze));

  const outer = filamentMaterial({
    glow: cfg.glow, core: cfg.core, intensity: cfg.outerI, speed: 0.05, flowScale: cfg.flowScale,
    headFade: cfg.headFade, tailFade: cfg.tailFade, rimPower: 1.6,
    boostAt, boostAmt: cfg.boostOuter ?? 0, thinA, thinB, thinAmt, sat, satU: sU,
  });
  const core = filamentMaterial({
    glow: cfg.core, core: 0xffffff, intensity: cfg.coreI, speed: 0.05, flowScale: cfg.flowScale,
    headFade: cfg.headFade + 0.01, tailFade: cfg.tailFade + 0.01, rimPower: 1.2, grain: 0.5,
    boostAt, boostAmt: cfg.boostCore ?? 0, thinA, thinB, thinAmt, sat, satU: sU,
  });
  group.add(
    new THREE.Mesh(taperedTube(line.curve, R(cfg.outerR, cfg.boostR), cfg.seg, 14), outer),
    new THREE.Mesh(taperedTube(line.curve, R(cfg.coreR, cfg.boostR), cfg.seg, 8), core)
  );
  timelineMats.push({ m: haze, line }, { m: outer, line }, { m: core, line });

  // 본체를 감고 도는 나선 가닥
  for (const s of cfg.strands || []) {
    const hp = [];
    for (let i = 0; i <= line.n; i += 3) {
      const u = i / line.n;
      const a = s.phase + u * s.turns * Math.PI * 2;
      const r = s.r * (0.72 + 0.28 * Math.sin(u * 22 + s.phase));
      const p = line.pts[i];
      const nn = line.nrm[i];
      const bb = line.bin[i];
      hp.push(
        new THREE.Vector3(
          p.x + (nn.x * Math.cos(a) + bb.x * Math.sin(a)) * r,
          p.y + (nn.y * Math.cos(a) + bb.y * Math.sin(a)) * r,
          p.z + (nn.z * Math.cos(a) + bb.z * Math.sin(a)) * r
        )
      );
    }
    const hc = new THREE.CatmullRomCurve3(hp, false, 'centripetal', 0.5);
    hc.arcLengthDivisions = 2000;
    const m = filamentMaterial({
      glow: s.glow, core: 0xfff0d4, intensity: s.i, speed: s.sp, flowScale: 4,
      headFade: cfg.headFade, tailFade: cfg.tailFade, rimPower: 1.4,
      boostAt, boostAmt: cfg.boostStrand ?? 0, thinA, thinB, thinAmt, sat, satU: sU,
    });
    group.add(new THREE.Mesh(taperedTube(hc, R(s.w, cfg.boostR), cfg.strandSeg, 6), m));
    timelineMats.push({ m, line });
  }

  scene.add(group);
  return group;
}

// 원래 본류 — 대박 지점 이후로는 가늘고 어두워진다 (갈라지고 남은 흐름)
buildTimelineStrands(MAIN, {
  hazeGlow: 0xff5a0e, hazeCore: 0xffa055, hazeI: 0.11, hazeR: 8,
  glow: 0xff7d16, core: 0xffe7bb, outerI: 0.6, coreI: 0.42,
  outerR: 2.35, coreR: 0.62, flowScale: 6, seg: 760, strandSeg: 1400,
  headFade: 0.1, tailFade: 0.1,
  boostAt: NEXUS_U_MAIN,
  boostHaze: -0.8, boostOuter: -0.72, boostCore: -0.85, boostStrand: -0.75,
  boostR: -0.62, boostRHaze: -0.6,
  // 안원잘부 채널 개설 전 — 거제 야호도 사투리도 아직 없던 구간
  thinA: CHANNEL_U_MAIN - 0.012, thinB: CHANNEL_U_MAIN + 0.03, thinAmt: -0.42, thinR: CHANNEL.thin - 1,
  strands: [
    { r: 4.6, turns: 26, phase: 0.0, w: 0.4, glow: 0xffa844, i: 0.5, sp: 0.14 },
    { r: 5.6, turns: 26, phase: 2.1, w: 0.32, glow: 0xff7a1e, i: 0.46, sp: 0.11 },
    { r: 3.9, turns: 36, phase: 4.2, w: 0.28, glow: 0xffc478, i: 0.44, sp: 0.19 },
    { r: 7.2, turns: 19, phase: 1.1, w: 0.24, glow: 0xff5c10, i: 0.36, sp: 0.09 },
    { r: 6.2, turns: 45, phase: 5.4, w: 0.2, glow: 0xffb35a, i: 0.32, sp: 0.24 },
  ],
});

/**
 * 새 시간선 — 태어나자마자 굵은 게 아니다. 커지는 순서가 있다.
 *
 *   03. 20  「거제 야호」가 처음 나옴. 아직 아무도 모름
 *   05. 01  사투리편(925만)이 먼저 뜨기 시작 — 완만하게 차오른다
 *   05. 22  그 와중에 거제 1편(1,227만)이 터짐 — 여기서 한 번 꺾여 올라간다
 *   ~08. 09 역주행 → 음방 1위 → 상암 하프타임까지 계속 굵어진다
 *
 * 완만한 상승(thinA~thinB)에 거제편 지점의 무릎(boostAt)을 얹어 그 순서를 만든다.
 */
const BUILD_FROM_U = pointAtX(NEXUS_LINE, dateToX('2026-05-01')).u;   // 사투리편 — 뜨기 시작
const BUILD_KNEE_U = pointAtX(NEXUS_LINE, dateToX('2026-05-22')).u;   // 거제 1편 — 터진 지점
const BUILD_TO_U = pointAtX(NEXUS_LINE, dateToX('2026-08-09')).u;     // 상암 하프타임
buildTimelineStrands(NEXUS_LINE, {
  hazeGlow: 0xff7a1a, hazeCore: 0xffc888, hazeI: 0.16, hazeR: 9,
  glow: 0xffa22a, core: 0xfff0d2, outerI: 0.82, coreI: 0.62,
  outerR: 2.8, coreR: 0.78, flowScale: 5, seg: 620, strandSeg: 1100,
  headFade: 0.045, tailFade: 0.1,
  sat: [1, 1, 1], satU: [-1, -1],
  // 사투리편 → 하프타임에 걸친 완만한 상승
  thinA: BUILD_FROM_U, thinB: BUILD_TO_U, thinAmt: -0.46, thinR: -0.46,
  // 거제 1편에서 한 번 꺾여 올라간다
  boostAt: BUILD_KNEE_U,
  boostHaze: 0.34, boostOuter: 0.34, boostCore: 0.34, boostStrand: 0.34,
  boostR: 0.28, boostRHaze: 0.24,
  strands: [
    { r: 5.0, turns: 16, phase: 1.3, w: 0.44, glow: 0xffc060, i: 0.62, sp: 0.16 },
    { r: 6.2, turns: 16, phase: 3.4, w: 0.36, glow: 0xff8b28, i: 0.58, sp: 0.13 },
    { r: 4.2, turns: 23, phase: 5.5, w: 0.3, glow: 0xffd894, i: 0.54, sp: 0.22 },
    { r: 7.8, turns: 11, phase: 0.4, w: 0.26, glow: 0xff6a14, i: 0.44, sp: 0.1 },
  ],
});

// 보조 시간선 — 본류 아래를 얇게 흐르는 콘텐츠 스트림
{
  const eU = satU(ECHO);
  const m = filamentMaterial({
    glow: 0xffa03c, core: 0xffe3bc, intensity: 0.62, speed: 0.2, flowScale: 16,
    headFade: 0.06, tailFade: 0.06, rimPower: 1.4, grain: 0.7, sat: SAT, satU: eU,
  });
  const h = filamentMaterial({
    glow: 0xff7418, core: 0xffb066, intensity: 0.1, speed: 0.05, flowScale: 5,
    headFade: 0.08, tailFade: 0.08, rimPower: 2.6, grain: 0.3, sat: SAT, satU: eU,
  });
  const eh = new THREE.Mesh(taperedTube(ECHO.curve, () => 3.6, 300, 10), h);
  const em = new THREE.Mesh(taperedTube(ECHO.curve, () => 0.62, 700, 8), m);
  scene.add(eh, em);
  revealAt(ECHO_START_X, eh, em);
  timelineMats.push({ m, line: ECHO }, { m: h, line: ECHO });

  // 라벨은 갈라져 내려온 직후에 — "여기서부터 메라디오"
  const anchor = pointAtX(ECHO, ECHO_DROP_END_X + 40);
  const el = document.createElement('div');
  el.className = 'echo-label';
  el.innerHTML =
    `<b>${RADIO.label} · ${RADIO.sub}</b>` +
    `<span>${RADIO.caption}</span>` +
    `<i>${formatDate(RADIO.episodes[0].date)} 첫 방송 · 총 ${RADIO.episodes.length}회</i>`;
  const o = new CSS2DObject(el);
  o.position.copy(anchor.point).add(new THREE.Vector3(0, -30, 0));
  scene.add(o);

  // 갈라져 나오는 지점 표식
  const j = pointAtX(MAIN, ECHO_START_X);
  const jh = makeHalo(RADIO.color, 18, 0.5);
  jh.position.copy(j.point);
  scene.add(jh);
  revealAt(ECHO_START_X, jh);
  revealAt(ECHO_DROP_END_X + 40, o);
}

// 나의 연수아저씨 — 메라디오보다 한 단 더 아래를 흐르는 얇은 시간선
{
  const dU = satU(DRIVE_LINE);
  const m = filamentMaterial({
    glow: DRIVE.color, core: DRIVE.core, intensity: 0.55, speed: 0.16, flowScale: 14,
    headFade: 0.06, tailFade: 0.06, rimPower: 1.4, grain: 0.7, sat: SAT, satU: dU,
  });
  const h = filamentMaterial({
    glow: 0xff7a2c, core: 0xffb98a, intensity: 0.09, speed: 0.05, flowScale: 5,
    headFade: 0.08, tailFade: 0.08, rimPower: 2.6, grain: 0.3, sat: SAT, satU: dU,
  });
  const dh = new THREE.Mesh(taperedTube(DRIVE_LINE.curve, () => 3.2, 300, 10), h);
  const dm = new THREE.Mesh(taperedTube(DRIVE_LINE.curve, () => 0.56, 700, 8), m);
  scene.add(dh, dm);
  timelineMats.push({ m, line: DRIVE_LINE }, { m: h, line: DRIVE_LINE });
  revealAt(DRIVE_START_X, dh, dm);

  const anchor = pointAtX(DRIVE_LINE, DRIVE_DROP_END_X + 40);
  const el = document.createElement('div');
  el.className = 'echo-label drive-label';
  el.innerHTML =
    `<b>${DRIVE.label} · ${DRIVE.sub}</b>` +
    `<span>${DRIVE.caption}</span>` +
    `<i>${formatDate(DRIVE.episodes[0].date)} 무면허에서 시작 · 총 ${DRIVE.episodes.length}편</i>`;
  const o = new CSS2DObject(el);
  o.position.copy(anchor.point).add(new THREE.Vector3(0, -30, 0));
  scene.add(o);
  revealAt(DRIVE_DROP_END_X + 40, o);

  const j = pointAtX(MAIN, DRIVE_START_X);
  const jh = makeHalo(DRIVE.color, 18, 0.5);
  jh.position.copy(j.point);
  scene.add(jh);
  revealAt(DRIVE_START_X, jh);

  // 졸업식으로 끝나는 지점 — 잘린 게 아니라 마무리로 읽히게 매듭을 짓는다
  const endP = DRIVE_LINE.pts[DRIVE_LINE.n].clone();
  const cap = makeHalo(DRIVE.color, 26, 0.45);
  cap.position.copy(endP);
  const capNode = makeNode(DRIVE.core, 1.3);
  capNode.position.copy(endP);
  scene.add(cap, capNode);

  const endEl = document.createElement('div');
  endEl.className = 'drive-end';
  endEl.innerHTML = `<b>졸업</b><span>${formatDate(DRIVE.episodes[DRIVE.episodes.length - 1].date)}</span>`;
  endEl.title = '나의연수아저씨 — 여기서 시리즈가 끝난다';
  const endLbl = new CSS2DObject(endEl);
  endLbl.position.copy(endP).add(new THREE.Vector3(0, -30, 0));
  scene.add(endLbl);
  scene.add(makeLeader(endP, endLbl.position, DRIVE.color));
  revealAt(DRIVE_END_X, cap, capNode, endLbl);
}

/** 시간선을 따라 흐르는 빛 입자 */
function buildFlow(line, count, cfg) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const siz = new Float32Array(count);
  const t = new Float32Array(count);
  const spd = new Float32Array(count);
  const rad = new Float32Array(count);
  const ang = new Float32Array(count);
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    t[i] = rng();
    spd[i] = 0.012 + rng() * 0.034;
    rad[i] = Math.pow(rng(), 1.5) * cfg.spread;
    ang[i] = rng() * Math.PI * 2;
    siz[i] = cfg.size * (0.5 + Math.pow(rng(), 2.2) * 1.8);
    c.setHSL(cfg.hue + rng() * 0.045, 0.95, 0.58 + rng() * 0.34);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: SPARK_TEX }, uPR: { value: renderer.getPixelRatio() }, uGain: { value: cfg.gain ?? 1.5 } },
    vertexShader: /* glsl */ `
      attribute float size;
      varying vec3 vColor;
      uniform float uPR;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPR * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uGain;
      varying vec3 vColor;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a * uGain, a);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  return function update(dt, time) {
    const arr = geo.attributes.position.array;
    const sarr = geo.attributes.size.array;
    const front = play.active ? play.front : Infinity;
    const head = play.active ? PLAY_HEAD_X : -Infinity;
    for (let i = 0; i < count; i++) {
      t[i] += spd[i] * dt * 0.13;
      if (t[i] > 1) t[i] -= 1;
      const idx = clamp(Math.floor(t[i] * line.n), 0, line.n);
      const p = line.pts[idx];
      const nn = line.nrm[idx];
      const bb = line.bin[idx];
      const a = ang[i] + time * 0.55;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r = rad[i] * (0.62 + 0.38 * Math.sin(time * 1.3 + i));
      arr[i * 3] = p.x + nn.x * ca * r + bb.x * sa * r;
      arr[i * 3 + 1] = p.y + nn.y * ca * r + bb.y * sa * r;
      arr[i * 3 + 2] = p.z + nn.z * ca * r + bb.z * sa * r;
      sarr[i] = p.x <= front && p.x >= head ? siz[i] : 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  };
}
const flowUpdaters = [
  buildFlow(MAIN, 620, { spread: 8.5, size: 3.4, hue: 0.062 }),
  buildFlow(NEXUS_LINE, 620, { spread: 9.5, size: 3.8, hue: 0.07, gain: 1.8 }),
  buildFlow(ECHO, 420, { spread: 2.6, size: 1.7, hue: 0.055, gain: 0.9 }),
];


/* ------------------------------------------------------------------
 * 대표와 이사 시간선 — 선 · 이름표 · 갈림 매듭
 * ------------------------------------------------------------------ */
{
  const SAT = satAt(STAFF_START_X);
  const sU = [dateToX('2024-03-26'), dateToX('2026-03-20')];
  const m = filamentMaterial({
    glow: STAFF.color, core: STAFF.core, intensity: 0.3, speed: 0.16, flowScale: 3,
    headFade: 0.06, tailFade: 0.06, rimPower: 2.2, grain: 0.34, sat: SAT, satU: sU,
  });
  const h = filamentMaterial({
    glow: 0xffb861, core: 0xffe0b4, intensity: 0.08, speed: 0.05, flowScale: 5,
    headFade: 0.08, tailFade: 0.08, rimPower: 2.6, grain: 0.3, sat: SAT, satU: sU,
  });
  const sh = new THREE.Mesh(taperedTube(STAFF_LINE.curve, () => 3, 300, 10), h);
  const sm = new THREE.Mesh(taperedTube(STAFF_LINE.curve, () => 0.52, 700, 8), m);
  scene.add(sh, sm);
  timelineMats.push({ m, line: STAFF_LINE }, { m: h, line: STAFF_LINE });
  revealAt(STAFF_START_X, sh, sm);

  const anchorP = pointAtX(STAFF_LINE, STAFF_DROP_END_X + 40);
  const el = document.createElement('div');
  el.className = 'echo-label staff-label';
  el.innerHTML =
    `<b>${STAFF.label} · ${STAFF.sub}</b>` +
    `<span>${STAFF.caption}</span>` +
    `<i>${STAFF.ceo.name}(${STAFF.ceo.nick[0]}) · ${STAFF.dir.name} 이사 · 총 ${STAFF.episodes.length}편</i>`;
  const o = new CSS2DObject(el);
  o.position.copy(anchorP.point).add(new THREE.Vector3(0, -26, 0));
  scene.add(o);
  revealAt(STAFF_DROP_END_X + 40, o);

  const jp = pointAtX(MAIN, STAFF_START_X);
  const jhalo = makeHalo(STAFF.color, 16, 0.5);
  jhalo.position.copy(jp.point);
  scene.add(jhalo);
  revealAt(STAFF_START_X, jhalo);
}

/* ==================================================================
 * 5. 눈금 · 연도 표식 · 기간 밴드
 * ================================================================== */

function upAtTangent(t) {
  return new THREE.Vector3(0, 1, 0).addScaledVector(t, -t.y).normalize();
}

// 구간 이름표를 어디에 세울지 — 본류는 오르내리므로 그대로 띄우면 이름표 높이가 제각각이 된다.
// 가장 높이 걸리는 자리를 재서 전부 그 높이에 맞춘다. 글자 줄이 한 줄로 선다.
// 이름표를 구간 어디쯤에 세울지. 왼쪽 끝(파묘~연습생)은 축척이 눌려 있어
// 같은 비율로 두면 글자가 서로 붙는다 — 그 둘만 바깥으로 벌려 놓는다.
const ERA_ANCHOR_F = { past: 0, trainee: 0.16 };
const eraAnchorX = (era) => era.x0 + (era.x1 - era.x0) * (ERA_ANCHOR_F[era.id] ?? 0.03);
const eraLabels = [];
const ERA_LABEL_Y = (() => {
  let top = -Infinity;
  for (const era of [PAST, ...ERAS]) {
    top = Math.max(top, pointAtX(MAIN, eraAnchorX(era)).point.y + (era === PAST ? 322 : 268));
  }
  return top;
})();

/** 구간 이름표를 누르면 그 구간 첫머리로 날아간다 */
function bindEraJump(el, era) {
  el.classList.add('is-jump');
  el.title = `${era.label} — 누르면 이 구간 시작으로 이동`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelection();
    flyTo(new THREE.Vector3(...era.cam.pos), new THREE.Vector3(...era.cam.tgt), 1.3);
  });
}

/** 화면에서 서로 밀어낼 라벨 목록 (fixed 는 안 움직이는 장애물) */
const declutter = [];

function buildTicks() {
  const g = new THREE.Group();

  for (const era of ERAS) {
    for (let m = 0; m < 12; m++) {
      const x = dateToX(`${era.year ?? era.label}-${String(m + 1).padStart(2, '0')}-01`);
      // 한 해가 두 구간으로 쪼개져 있으므로 자기 범위 밖의 달은 건너뛴다
      if (x < era.x0 - 1 || x > era.x1 + 1) continue;
      const { point, tangent } = pointAtX(MAIN, x);
      const up = upAtTangent(tangent);
      // 눈금선은 그리지 않는다 — 시간선에 안 붙은 잔선처럼 보인다. 라벨만 남긴다.
      const big = m % era.labelEvery === 0;
      const b = point.clone().addScaledVector(up, -32);
      if (big) {
        const el = document.createElement('div');
        el.className = 'tick-label';
        el.textContent = `${m + 1}월`;
        const lbl = new CSS2DObject(el);
        lbl.position.copy(b).addScaledVector(up, -10);
        g.add(lbl);
        revealAt(x, lbl);
      }
    }

    const edge = pointAtX(MAIN, era.x0);
    const eup = upAtTangent(edge.tangent);

    const anchor = pointAtX(MAIN, eraAnchorX(era));
    const el = document.createElement('div');
    el.className = `era-label era-${era.id}`;
    el.innerHTML = `<b>${era.label}</b><span>${era.caption}</span><i>${era.sub}</i>`;
    bindEraJump(el, era);
    const o = new CSS2DObject(el);
    o.position.set(anchor.point.x, ERA_LABEL_Y, anchor.point.z);
    g.add(o);
    eraLabels.push({ el, pos: o.position.clone() });
    declutter.push({ obj: o, el, fixed: true, kind: 'era', base: o.position.clone() });
    revealAt(era.x0, o);
  }

  // 파묘 구간 — 눈금 없이 라벨과 경계선만
  {
    const edge = pointAtX(MAIN, PAST.x1);
    const eup = upAtTangent(edge.tangent);
    const anchor = pointAtX(MAIN, eraAnchorX(PAST));
    const el = document.createElement('div');
    el.className = 'era-label era-past';
    el.innerHTML = `<b>${PAST.label}</b><span>${PAST.caption}</span><i>${PAST.sub}</i>`;
    bindEraJump(el, PAST);
    const o = new CSS2DObject(el);
    o.position.set(anchor.point.x, ERA_LABEL_Y, anchor.point.z);
    g.add(o);
    eraLabels.push({ el, pos: o.position.clone() });
    declutter.push({ obj: o, el, fixed: true, kind: 'era', base: o.position.clone() });
    revealAt(Infinity, o);   // 파묘 구간 라벨도 재생에서는 감춘다
  }

  // 안원잘부 채널 개설 — 본류가 굵어지기 시작하는 지점
  {
    const q = pointAtX(MAIN, CHANNEL_X);
    const up = upAtTangent(q.tangent);
    const el = document.createElement('div');
    el.className = 'channel-mark';
    el.innerHTML = `<b>${CHANNEL.label}</b><span>${formatDate(CHANNEL.date)}</span><i>${CHANNEL.sub}</i>`;
    el.title = `${CHANNEL.label} — 이 지점부터 본류가 굵어진다`;
    const o = new CSS2DObject(el);
    o.position.copy(q.point).addScaledVector(up, 74);
    g.add(o);

    const h = makeHalo(0xffb257, 24, 0.42);
    h.position.copy(q.point);
    g.add(h);
    revealAt(CHANNEL_X, o, h);
  }

  scene.add(g);
}
buildTicks();

/** 특정 기간을 발광 슬리브로 감싸 강조 (제철 구간 등) */
const periodMats = [];
function buildPeriods() {
  for (const p of PERIODS) {
    const revealX = dateToX(p.from);
    const line = LINES[p.line] || MAIN;
    const i0 = pointAtX(line, dateToX(p.from)).i;
    const i1 = pointAtX(line, dateToX(p.to)).i;
    if (i1 - i0 < 4) continue;

    const stride = Math.max(1, Math.floor((i1 - i0) / 48));
    const pts = [];
    for (let i = i0; i < i1; i += stride) pts.push(line.pts[i].clone());
    pts.push(line.pts[i1].clone());

    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    c.arcLengthDivisions = 600;

    // 슬리브가 시간선보다 굵으면 시간선이 두꺼워진 것처럼 보인다.
    // 반지름과 밝기를 구간별로 받아 그 자리 시간선 굵기에 맞춘다.
    const mat = filamentMaterial({
      glow: p.color, core: 0xfff2d8, intensity: p.i ?? 0.2, speed: 0.1, flowScale: 2.2,
      headFade: 0.12, tailFade: 0.12, rimPower: 3.8, grain: 0.35,
    });
    const sleeve = new THREE.Mesh(taperedTube(c, () => p.r ?? 13, 140, 16), mat);
    scene.add(sleeve);
    periodMats.push({ m: mat, line, i0, i1, gain: p.i ?? 0.2 });

    // 브래킷 선은 그리지 않는다 — 발광 슬리브가 이미 구간을 보여 주므로
    // 선까지 얹으면 시간선 주변이 지저분해진다.
    const anchorI = i0 + Math.round((i1 - i0) * (p.labelAt ?? 0.5));
    const anchor = line.pts[anchorI];
    const bracket = null;

    // 구간은 툴팁 상자가 아니라 활자 표식으로 — PHASE 번호 + 이름만.
    // 설명과 날짜는 브래킷이 이미 말해 주므로 빼고, 배경·테두리도 없앤다.
    const el = document.createElement('div');
    el.className = `period-label period-${p.id}`;
    el.innerHTML =
      `<i>PHASE ${String(PERIODS.indexOf(p) + 1).padStart(2, '0')}</i>` +
      `<b>${p.label.replace(/\s*구간$/, '')}</b>`;
    el.title = `${p.caption} · ${formatDate(p.from)} — ${formatDate(p.to)}`;
    const o = new CSS2DObject(el);
    o.position.set(anchor.x, anchor.y + p.offset, anchor.z);
    scene.add(o);
    // 구간이 끝나는 지점에 종료 표식을 세운다 (제철처럼 "여기서 끝났다"가 사건인 경우)
    if (p.endLabel) {
      const endP = pointAtX(line, dateToX(p.to));
      const eup = upAtTangent(endP.tangent);
      const eEl = document.createElement('div');
      eEl.className = `period-end period-${p.id}`;
      eEl.innerHTML = `<i></i><b>${p.endLabel}</b><span>${formatDate(p.to)}</span>`;
      const eObj = new CSS2DObject(eEl);
      eObj.position.copy(endP.point).addScaledVector(eup, p.offset * 0.62);
      scene.add(eObj);
      revealAt(dateToX(p.to), eObj);
      // 끝점에 매듭 하나 — 선이 그냥 지나가면 끝난 게 안 보인다
      const knot = makeHalo(p.color, 15, 0.5);
      knot.position.copy(endP.point);
      scene.add(knot);
      revealAt(dateToX(p.to), knot);
    }

    // 슬리브는 구간 첫머리부터 진행선을 따라 차오르고,
    // PHASE 이름표는 진행선이 이름표 자리에 닿아야 뜬다.
    // 구간에 들어서자마자 띄우면 이름표가 아직 안 그려진 앞쪽 허공에 혼자 떠 있게 된다
    // (역주행 구간은 labelAt 이 1 이라 넉 달치 앞이었다).
    revealAt(revealX, sleeve, bracket);
    revealAt(anchor.x, o);
  }
}
buildPeriods();

// 갈라지고 남은 원래 흐름을 짚어주는 표식
{
  const el = document.createElement('div');
  el.className = 'ghostline-label';
  el.innerHTML = `<b>원래 흐름</b><span>분기 이전의 시간선</span>`;
  const o = new CSS2DObject(el);
  const at = pointAtX(MAIN, TIME.xMax + 55);
  o.position.copy(at.point).addScaledVector(upAtTangent(at.tangent), 38);
  scene.add(o);
}

/* ==================================================================
 * 6. 사건 분기
 * ================================================================== */

/**
 * 라벨 겹침 해소.
 * 멀리서 보면 3D 상으로는 떨어져 있어도 화면에서는 라벨이 포개진다.
 * 매 프레임 화면 좌표로 투영해 서로 밀어내고, 그 이동량을 부드럽게 따라가게 한 뒤
 * 카메라 기준 오른쪽·위 방향으로 되돌려 3D 위치에 반영한다. 연결선도 같이 갱신한다.
 */

const branches = [];
const pickables = [];
const branchGroup = new THREE.Group();
scene.add(branchGroup);

/** 색을 채도 단계에 맞춰 회색 쪽으로 당긴다 */
function desat(hex, s) {
  const c = new THREE.Color(hex);
  const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  return c.lerp(new THREE.Color(l, l, l), 1 - s);
}

function makeNode(color, r) {
  const m = new THREE.Mesh(
    NODE_GEO,
    new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  m.scale.setScalar(r);
  return m;
}
/** 노드에서 라벨까지 이어지는 연결선 (라벨이 어느 방향에 있든 정확히 이어진다) */


/**
 * 다층 발광 — 스프라이트 하나로는 아무리 부드럽게 만들어도 "원 한 장"으로 보인다.
 * 작고 뜨거운 심 / 중간 온기 / 아주 넓은 자락을 서로 다른 주기로 숨쉬게 겹쳐야
 * 깊이가 생긴다. 심은 작고 밝게 둬서 블룸이 알아서 번지게 한다.
 */
function makeGlowStack(s, hot = 0xfff6e6, warm = 0xffb95c, deep = 0xff6a14) {
  const g = new THREE.Group();
  const layers = [
    { c: deep, k: 3.0, o: 0.13, rate: 0.33 },
    { c: warm, k: 1.35, o: 0.3, rate: 0.52 },
    { c: warm, k: 0.62, o: 0.42, rate: 0.78 },
    { c: hot, k: 0.2, o: 0.95, rate: 1.15 },
  ].map((L, i) => {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: GLOW_TEX, color: L.c, transparent: true, opacity: L.o, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sp.scale.setScalar(s * L.k);
    g.add(sp);
    return { sp, base: s * L.k, o: L.o, rate: L.rate, phase: i * 1.7 };
  });
  g.userData.layers = layers;
  return g;
}

/** 다층 발광의 숨쉬기 */
function pulseGlowStack(g, time, gain = 1) {
  for (const L of g.userData.layers) {
    const b = 1 + Math.sin(time * L.rate + L.phase) * 0.09;
    L.sp.scale.setScalar(L.base * b * gain);
    L.sp.material.opacity = L.o * (0.86 + Math.sin(time * L.rate * 0.8 + L.phase) * 0.14) * gain;
  }
}

function makeHalo(color, s, opacity = 0.5) {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sp.scale.setScalar(s);
  return sp;
}
/**
 * 멤버 프로필 사진.
 * 예전엔 데뷔 트레일러의 영상 화면을 16:9 로 크게 깔았는데, 재생 중엔 그게 너무 커서
 * 시선을 다 가져갔다. 이제는 인물 사진을 동그랗게, 작게 얹는다.
 *
 * 사진은 세 단계로 떨어진다:
 *   1. assets/members 의 파일 — 소속사 자료라 저장소에 넣지 않는다. 로컬에만 있다.
 *   2. 없으면 그 멤버의 데뷔 트레일러에서 유튜브가 뽑아 둔 프레임(`yt`).
 *      MV 썸네일과 똑같이 유튜브가 주는 걸 그대로 거는 것이라 재배포가 아니고,
 *      GitHub Pages 처럼 파일이 없는 곳에서도 얼굴이 보인다.
 *   3. 그것도 실패하면 이름 첫 글자를 넣은 동그라미(`.mp-slot.is-gone`).
 *
 * 대표 썸네일(mqdefault)은 흰 배경에 이름만 적힌 카드라 얼굴이 없다.
 * 대신 영상 1/4 지점 프레임(`hq1.jpg`)을 쓴다 — 다섯 명 모두 정면 얼굴이다.
 *
 * 파일이 있으면 언제나 파일이 먼저다. 유튜브 프레임은 어디까지나 예비다.
 * 파일명이 한글이라 encodeURIComponent 를 거친다.
 */
const MEMBER_PHOTO = {
  woni:   { name: '원이',   real: '정원이',     file: '원이.jpg',   yt: 'D88uhaLAGoM' },
  liv:    { name: '리브',   real: '진경은',     file: '리브.png',   yt: 'l-RMOXHFMVk' },
  minami: { name: '미나미', real: '이토 미나미', file: '미나미.jpg', yt: '4fqiTeVz504' },
  may:    { name: '메이',   real: '이예빈',     file: '메이.png',   yt: 'I_K54WugHtQ' },
  zena:   { name: '제나',   real: '김가영',     file: '제나.jpg',   yt: 'JnVAt6ZMuG4' },
};
const ytFace = (id) => `https://i.ytimg.com/vi/${id}/hq1.jpg`;
/**
 * 1 → 2 → 3 으로 한 번씩만 떨어지는 onerror.
 * 같은 주소로 무한히 되돌지 않게 어디까지 갔는지 `data-fb` 에 적어 둔다.
 * HTML 속성 안이라 `&&` 는 escape 가 필요해진다 — 중첩 if 로 피한다.
 */
const PHOTO_FALLBACK =
  "if(this.dataset.yt){if(!this.dataset.fb){this.dataset.fb=1;this.classList.add('is-yt');" +
  "this.src='https://i.ytimg.com/vi/'+this.dataset.yt+'/hq1.jpg';return;}}" +
  "this.closest('.mp-slot').classList.add('is-gone');";
const photoImg = (m) =>
  `<img src="./assets/members/${encodeURIComponent(m.file)}"` +
  ` data-yt="${m.yt || ''}" alt="${m.name}" title="${m.name} (${m.real})" loading="lazy"` +
  ` onerror="${PHOTO_FALLBACK}">`;
const photoRow = (photo, cls) => {
  if (!photo) return '';
  const keys = (Array.isArray(photo) ? photo : [photo]).filter((k) => MEMBER_PHOTO[k]);
  if (!keys.length) return '';
  return `<span class="${cls}${keys.length > 1 ? ' is-many' : ''}">${keys
    .map((k) => {
      const m = MEMBER_PHOTO[k];
      return `<i><span class="mp-slot" data-ini="${m.name.slice(0, 1)}">${photoImg(m)}</span>` +
        `<b>${m.name}<em>${m.real}</em></b></i>`;
    })
    .join('')}</span>`;
};

const hasHi = (ev) => !!(ev.videos && ev.videos.some((v) => v.hi));
const playBadge = (ev) =>
  ev.videos && ev.videos.length
    ? `${hasHi(ev) ? '<span class="nl-hi">★ 하이라이트</span>' : ''}<span class="nl-play">▶ ${ev.videos.length}</span>`
    : '';

function buildBranch(ev, index) {
  const kind = KINDS[ev.kind] || KINDS.release;
  const line = lineOf(ev);
  const { point: base, tangent, binormal } = pointAtX(line, dateToX(ev.date));

  const t = tangent.clone().normalize();
  const bi = binormal.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0).addScaledVector(t, -t.y).normalize();
  const worldSide = new THREE.Vector3().crossVectors(t, worldUp).normalize();
  const a = ev.angle * DEG;
  const dir = worldUp.clone().multiplyScalar(Math.cos(a)).addScaledVector(worldSide, Math.sin(a)).normalize();

  const L = ev.length;
  const sat = satAt(dateToX(ev.date));

  // 기본 사건은 분기를 뻗지 않는다 — 노드는 시간선 위에 그대로 박히고,
  // 라벨만 원래 분기가 향하던 방향·거리로 띄워 연결선으로 잇는다.
  // (angle/length 는 이제 "라벨을 어디에 둘지"만 정한다)
  const anchor = base.clone()
    .addScaledVector(t, L * 0.68)
    .addScaledVector(dir, L * 0.92);

  const mats = [];
  const grp = new THREE.Group();

  const kGlow = desat(kind.glow, sat[0]);
  const kCore = desat(kind.core, sat[0]);
  const junction = makeHalo(kGlow, ev.major ? 26 : 18, 0.5);
  junction.position.copy(base);
  grp.add(junction);

  // 시간선 위의 지점 자체가 사건이다
  const tip = base.clone();
  const nodeR = ev.major ? 3.1 : 2.2;
  const node = makeNode(kCore, nodeR);
  node.position.copy(tip);
  grp.add(node);

  const rings = [];
  for (let k = 0; k < 1; k++) {
    const r = new THREE.Mesh(
      RING_GEO,
      new THREE.MeshBasicMaterial({ color: kGlow, transparent: true, opacity: k ? 0.4 : 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    r.position.copy(tip);
    const b = nodeR * (k ? 3.4 : 2.4);
    r.scale.setScalar(b);
    r.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    grp.add(r);
    rings.push({ mesh: r, base: b, sx: (rng() - 0.5) * 0.5, sy: 0.25 + rng() * 0.5 });
  }

  // 하이라이트 사건은 원 하나로 끝내지 않고, 밝은 코어 + 맥동하는 이중 링을 얹는다
  const hiRings = [];
  let hiStack = null;
  let hiStreak = null;
  if (hasHi(ev)) {
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(
        SHOCK_GEO,
        new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      m.position.copy(tip);
      m.frustumCulled = false;
      grp.add(m);
      hiRings.push({ mesh: m, off: k / 2 });
    }
    const stack = makeGlowStack((ev.major ? 30 : 21) * 1.9, 0xfff4e2, 0xffc472, 0xff7a1e);
    stack.position.copy(tip);
    grp.add(stack);
    hiStack = stack;

    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(ev.major ? 320 : 240, 22),
      new THREE.MeshBasicMaterial({ map: ANAMORPH_TEX, color: 0xffc887, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    streak.position.copy(tip);
    grp.add(streak);
    hiStreak = streak;
  }

  const haloBase = ev.major ? 30 : 21;
  const halo = makeHalo(kGlow, haloBase);
  halo.position.copy(tip);
  grp.add(halo);

  const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(tip);
  hit.scale.setScalar(ev.major ? 12 : 10);
  hit.userData.eventIndex = index;
  grp.add(hit);
  pickables.push(hit);

  const el = document.createElement('div');
  el.className = `node-label kind-${ev.kind}${hasHi(ev) ? ' is-hi' : ''}`;
  el.innerHTML =
    photoRow(ev.photo, 'nl-photo') +
    `<span class="nl-date">${formatDate(ev.date)}</span>
    <span class="nl-title">${ev.title}</span>
    <span class="nl-kind">${kind.label}${playBadge(ev)}</span>`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); selectEvent(index, true); });
  // 라벨은 분기 끝에서 조금 더 뻗은 자리에 둔다.
  // labelOff 가 있으면 거기서 다시 평면 이동한다 — 분기 모양은 그대로 두고
  // 라벨만 빈 자리로 옮기기 위한 값이다 (연결선은 자동으로 따라온다).
  const labelPos = anchor.clone().addScaledVector(dir, 30);
  if (ev.labelOff) labelPos.x += ev.labelOff[0], labelPos.y += ev.labelOff[1];
  const label = new CSS2DObject(el);
  label.position.copy(labelPos);
  grp.add(label);

  const leader = makeLeader(tip, labelPos, kGlow);
  grp.add(leader);
  declutter.push({ obj: label, el, base: labelPos.clone(), from: tip.clone(), leader, kind: 'label' });

  // 분기 곡선이 없어졌으므로 스파크는 노드에서 라벨로 이어지는 선을 타고 흐른다
  const samples = [];
  for (let i = 0; i <= 48; i++) samples.push(tip.clone().lerp(labelPos, i / 48));

  branchGroup.add(grp);
  // 파묘 사건은 시간순 재생에서 빼 둔다 (데뷔부터 흐르는 이야기에 끼어들지 않게)
  revealAt(ev.kind === 'dig' ? Infinity : dateToX(ev.date), grp);
  return {
    ev, index, kind, sat, base, dir, tip, node, rings, hiRings, hiStack, hiStreak, halo, haloBase, junction,
    label, el, mats, samples, forks: [], nexusRings: [], nodeR, dimTarget: 1,
    phase: rng() * Math.PI * 2, jRing: null, leaders: [leader],
  };
}

/**
 * 대박 분기점은 일반 분기가 아니라 "새 시간선이 태어나는 지점" 으로 그린다.
 * 본류 위의 갈라지는 접합부 + 다 솟아오른 지점의 거대 노드 + 상시 충격파 + 하위 갈래.
 */
function buildNexusMarker(ev, index) {
  const kind = KINDS[ev.kind];
  const grp = new THREE.Group();
  const mats = [];

  const divergence = pointAtX(MAIN, NEXUS_X).point;
  const top = pointAtX(NEXUS_LINE, RISE_END_X);
  // 분기점 자체가 사건이다 — 노드는 갈라지는 지점에 놓고,
  // 솟아오른 뒤가 아니라 여기서 충격파가 퍼진다.
  const tip = divergence.clone();

  const junction = makeHalo(kind.glow, 52, 0.8);
  junction.position.copy(divergence);
  grp.add(junction);

  const jRing = new THREE.Mesh(
    RING_GEO,
    new THREE.MeshBasicMaterial({ color: kind.glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  jRing.position.copy(divergence);
  jRing.scale.setScalar(11);
  grp.add(jRing);

  // 솟아오르는 구간 (하위 갈래와 스파크에 사용)
  const iStart = pointAtX(NEXUS_LINE, NEXUS_X).i;
  const iTop = top.i;
  const rp = [];
  const stride = Math.max(1, Math.floor((iTop - iStart) / 20));
  for (let i = iStart; i < iTop; i += stride) rp.push(NEXUS_LINE.pts[i].clone());
  rp.push(NEXUS_LINE.pts[iTop].clone());
  const riseCurve = new THREE.CatmullRomCurve3(rp, false, 'centripetal', 0.5);
  riseCurve.arcLengthDivisions = 400;

  // 하위 갈래 — 「거제편」 / 「사투리편」
  const forks = [];
  const leaders = [];
  for (const f of ev.fork || []) {
    const fp = riseCurve.getPointAt(f.at);
    const ft = riseCurve.getTangentAt(f.at).normalize();
    const perp = new THREE.Vector3(-ft.y, ft.x, 0).normalize();
    const fa = f.spread * DEG;
    const fd = ft.clone().multiplyScalar(Math.cos(fa)).addScaledVector(perp, Math.sin(fa)).normalize();
    const fl = f.length;
    const fc = new THREE.CatmullRomCurve3([
      fp.clone(),
      fp.clone().addScaledVector(ft, fl * 0.3).addScaledVector(fd, fl * 0.1),
      fp.clone().addScaledVector(ft, fl * 0.16).addScaledVector(fd, fl * 0.64),
      fp.clone().addScaledVector(fd, fl),
    ]);
    fc.arcLengthDivisions = 300;

    const fOuter = filamentMaterial({
      glow: kind.glow, core: kind.core, intensity: 0.85, speed: 0.34,
      flowScale: 1.4, headFade: 0.07, tailFade: 0.02, rimPower: 1.6,
    });
    const fCore = filamentMaterial({
      glow: kind.core, core: 0xffffff, intensity: 0.75, speed: 0.34,
      flowScale: 1.4, headFade: 0.08, tailFade: 0.02, rimPower: 1.2, grain: 0.5,
    });
    grp.add(
      new THREE.Mesh(taperedTube(fc, (u) => lerp(0.9, 0.16, Math.pow(u, 0.7)), 110, 10), fOuter),
      new THREE.Mesh(taperedTube(fc, (u) => lerp(0.3, 0.05, Math.pow(u, 0.7)), 110, 6), fCore)
    );
    mats.push(fOuter, fCore);

    const ftip = fc.getPointAt(1);
    const fnode = makeNode(kind.core, 1.6);
    fnode.position.copy(ftip);
    const fhalo = makeHalo(kind.glow, 22, 0.45);
    fhalo.position.copy(ftip);
    grp.add(fnode, fhalo);

    const fel = document.createElement('div');
    fel.className = `fork-label kind-${ev.kind}`;
    fel.textContent = f.label;
    fel.addEventListener('pointerdown', (e) => e.stopPropagation());
    fel.addEventListener('click', (e) => { e.stopPropagation(); selectEvent(index, true); });
    const fLabelPos = ftip.clone().addScaledVector(fd, 26);
    const flbl = new CSS2DObject(fel);
    flbl.position.copy(fLabelPos);
    grp.add(flbl);
    const fLeader = makeLeader(ftip, fLabelPos, kind.glow);
    grp.add(fLeader);
    leaders.push(fLeader);

    forks.push({ node: fnode, halo: fhalo, el: fel, phase: rng() * Math.PI * 2 });
  }

  const nodeR = 6.4;
  // 대박 분기점은 채도 100% 구간이라 색을 그대로 쓴다
  const node = makeNode(kind.core, nodeR);
  node.position.copy(tip);
  grp.add(node);

  const rings = [];

  const haloBase = 62;
  const halo = makeHalo(kind.glow, haloBase, 0.55);
  halo.position.copy(tip);
  grp.add(halo);

  /* --- 분기점 연출 ---------------------------------------------------
   * 링을 여러 겹 퍼뜨리는 건 금방 싸구려로 보인다.
   * 화면을 향해 고정된 "장치" 하나로 만든다:
   *   십자 플레어 + 서로 반대로 도는 얇은 호 + 아주 느린 파문 한 겹.
   * ------------------------------------------------------------------ */
  const flare = new THREE.Group();
  flare.position.copy(tip);
  grp.add(flare);

  // 1) 다층 발광 — 이게 핵심. 심은 작고 희게, 자락은 넓고 어둡게.
  const glowStack = makeGlowStack(150, 0xfffaf0, 0xffc270, 0xff6d16);
  flare.add(glowStack);

  // 2) 아나모픽 스트릭 — 좌우로 길게 누운, 끝이 부드럽게 사라지는 렌즈 플레어
  const bar = (w, h, op, col) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: ANAMORPH_TEX, color: col, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    flare.add(m);
    return m;
  };
  const bars = [
    { m: bar(760, 46, 0.34, 0xffc06a), o: 0.34, rate: 0.41 },
    { m: bar(1180, 22, 0.16, 0xff8a2e), o: 0.16, rate: 0.29 },
    { m: bar(300, 26, 0.2, 0xffe6c0), o: 0.2, rate: 0.63 },
  ];
  bars[2].m.rotation.z = Math.PI / 2;

  // 3) 아이리스 고스트 — 렌즈 안에서 튕긴 상. 아주 흐리게 두 점만.
  const ghostsFx = [];
  for (const [off, sc, op] of [[210, 26, 0.13], [-330, 40, 0.09], [430, 18, 0.07]]) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffb257, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    sp.position.set(off, 0, 0);
    sp.scale.setScalar(sc);
    flare.add(sp);
    ghostsFx.push({ sp, o: op });
  }

  // 4) 서로 반대로 도는 얇은 호 — 원이 아니라 계기 같은 인상
  const arcs = [];
  for (let k = 0; k < 2; k++) {
    const geo = new THREE.TorusGeometry(1, 0.009, 6, 96, Math.PI * (k ? 1.15 : 0.62));
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: k ? kind.core : kind.glow, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.scale.setScalar(k ? 64 : 44);
    flare.add(m);
    arcs.push({ mesh: m, spin: k ? 0.16 : -0.25, phase: k * 2.1 });
  }

  // 퍼져나가는 파문은 쓰지 않는다 — 커졌다 사라지는 반복이 금방 눈에 걸린다.
  // 분기점의 존재감은 다층 발광과 스트릭으로만 낸다.
  const nexusRings = [];


  const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(tip);
  hit.scale.setScalar(24);
  hit.userData.eventIndex = index;
  grp.add(hit);
  pickables.push(hit);

  const el = document.createElement('div');
  el.className = `node-label kind-${ev.kind} is-nexus${hasHi(ev) ? ' is-hi' : ''}`;
  el.innerHTML = `
    <span class="nl-date">${formatDate(ev.date)}</span>
    <span class="nl-title">${ev.title}</span>
    <span class="nl-kind">${kind.label} — 새 시간선 시작${playBadge(ev)}</span>`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); selectEvent(index, true); });
  const labelPos = tip.clone().add(new THREE.Vector3(-30, 236, 0));
  const label = new CSS2DObject(el);
  label.position.copy(labelPos);
  grp.add(label);
  const leader = makeLeader(tip, labelPos, kind.glow);
  grp.add(leader);
  leaders.push(leader);
  declutter.push({ obj: label, el, base: labelPos.clone(), from: tip.clone(), leader, kind: 'label' });

  const samples = [];
  for (let i = 0; i <= 48; i++) samples.push(riseCurve.getPointAt(i / 48));

  branchGroup.add(grp);
  revealAt(NEXUS_X, grp);
  return {
    ev, index, kind, base: divergence, dir: new THREE.Vector3(0, 1, 0), tip,
    node, rings, halo, haloBase, junction, label, el, mats, samples, forks, nexusRings, flare, arcs, glowStack, bars, ghostsFx,
    nodeR, dimTarget: 1, phase: rng() * Math.PI * 2, jRing, leaders,
  };
}

EVENTS.forEach((ev, i) => branches.push(ev.nexus ? buildNexusMarker(ev, i) : buildBranch(ev, i)));

/**
 * 파묘 — 데뷔 이전에 찍힌 영상이 2026년에 발굴돼 새 시간선으로 역류하는 실.
 * 앞쪽이 복잡하므로 화면 뒤쪽(-Z)으로 크게 돌아 지나간다.
 */
const digThreads = [];
for (const b of branches) {
  if (!b.ev.resurfaced) continue;
  const from = b.tip.clone();
  const land = pointAtX(NEXUS_LINE, dateToX(b.ev.resurfaced));
  const to = land.point.clone();
  const depth = -470;
  const peak = Math.max(from.y, to.y) + 190;

  const curve = new THREE.CatmullRomCurve3(
    [
      from,
      new THREE.Vector3(lerp(from.x, to.x, 0.2), from.y + 130, depth * 0.62),
      new THREE.Vector3(lerp(from.x, to.x, 0.52), peak, depth),
      new THREE.Vector3(lerp(from.x, to.x, 0.85), to.y + 120, depth * 0.55),
      to,
    ],
    false,
    'centripetal',
    0.5
  );
  curve.arcLengthDivisions = 900;

  const mat = filamentMaterial({
    glow: b.kind.glow, core: b.kind.core, intensity: 0.26, speed: 0.55, flowScale: 5.5,
    headFade: 0.015, tailFade: 0.015, rimPower: 2.2, grain: 0.45,
    sat: SAT, satU: [0.25, 0.72],   // 과거에서 출발해 2026 에 닿으며 색이 살아난다
  });
  const thread = new THREE.Mesh(taperedTube(curve, (u) => 0.5 + Math.sin(u * Math.PI) * 0.75, 260, 6), mat);
  scene.add(thread);

  const node = makeNode(b.kind.core, 1.6);
  node.position.copy(to);
  const halo = makeHalo(b.kind.glow, 22, 0.45);
  halo.position.copy(to);
  scene.add(node, halo);

  const el = document.createElement('div');
  el.className = 'dig-chip';
  el.innerHTML = `<b>${formatDate(b.ev.resurfaced)}</b><span>파묘</span>`;
  el.title = `${b.ev.title} — ${formatDate(b.ev.resurfaced)} 발굴`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); selectEvent(b.index, true); });
  const chipSide = digThreads.length % 2 ? 1 : -1;
  const chipPos = to.clone().add(new THREE.Vector3(0, chipSide * 40, 0));
  const chip = new CSS2DObject(el);
  chip.position.copy(chipPos);
  scene.add(chip);
  scene.add(makeLeader(to, chipPos, b.kind.glow));

  revealAt(Infinity, thread, node, halo, chip);   // 파묘 실도 재생에서는 감춘다
  digThreads.push({ b, mat, node, halo, el, chipPos: chipPos.clone(), phase: rng() * Math.PI * 2 });
}

/** 모든 분기를 따라 흐르는 스파크 */
function buildBranchSparks() {
  const PER = 80;
  const COUNT = PER * branches.length;
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const siz = new Float32Array(COUNT);
  const t = new Float32Array(COUNT);
  const spd = new Float32Array(COUNT);
  const bidx = new Int16Array(COUNT);
  const c = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    const b = branches[Math.floor(i / PER)];
    bidx[i] = b.index;
    t[i] = rng();
    spd[i] = 0.16 + rng() * 0.4;
    siz[i] = 0.9 + Math.pow(rng(), 2) * 3.4;
    c.copy(desat(rng() > 0.55 ? b.kind.core : b.kind.glow, b.sat ? b.sat[0] : 1));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(COUNT).fill(1), 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: SPARK_TEX }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float alpha;
      varying vec3 vColor;
      varying float vA;
      uniform float uPR;
      void main() {
        vColor = color; vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPR * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vA;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * a * 1.6, a);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  return function update(dt) {
    const arr = geo.attributes.position.array;
    const al = geo.attributes.alpha.array;
    for (let i = 0; i < COUNT; i++) {
      t[i] += spd[i] * dt * 0.42;
      if (t[i] > 1) t[i] -= 1;
      const b = branches[bidx[i]];
      const f = t[i] * 48;
      const i0 = Math.min(47, Math.floor(f));
      const k = f - i0;
      const a = b.samples[i0];
      const bb = b.samples[i0 + 1];
      arr[i * 3] = lerp(a.x, bb.x, k);
      arr[i * 3 + 1] = lerp(a.y, bb.y, k);
      arr[i * 3 + 2] = lerp(a.z, bb.z, k);
      al[i] = (1 - t[i] * 0.55) * b.dimTarget;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.alpha.needsUpdate = true;
  };
}
const updateSparks = buildBranchSparks();

/* ==================================================================
 * 6-b. 메라디오 회차 — 보조 시간선 위에 방송일 순서대로
 * ================================================================== */

const CHIP_OFFSETS = [-14, 30, -40, 20, -14];
const radios = [];
{
  const grp = new THREE.Group();
  const total = RADIO.episodes.length;

  RADIO.episodes.forEach((ep, i) => {
    const q = pointAtX(ECHO, dateToX(ep.date));
    const up = upAtTangent(q.tangent);
    // 아직 본류에서 갈라져 내려오는 중인 초반 회차는 칩을 더 아래로 내린다
    const drop = smoothstep(ECHO_START_X, ECHO_DROP_END_X, q.point.x);
    // 25회가 몰린 달에도 칩이 안 겹치도록 5주기 오프셋을 쓴다 (전수 탐색으로 고른 값)
    const chipOff = CHIP_OFFSETS[i % CHIP_OFFSETS.length] - (1 - drop) * 34;

    // 역주행 이후 조회수가 한 자릿수 배로 뛴다 — 노드 크기로 그대로 보여준다
    const vs = 0.85 + Math.min(1.55, (ep.views || 0) / 300000);
    const nr = 1.9 * vs;    // 어디가 회차인지 툴팁 없이 보이게 키운다
    const hr = 15 * vs;

    const node = makeNode(RADIO.core, nr);
    node.position.copy(q.point);
    const halo = makeHalo(RADIO.color, hr, 0.5);
    halo.position.copy(q.point);
    grp.add(node, halo);

    const labelPos = q.point.clone().addScaledVector(up, chipOff);
    const leader = makeLeader(q.point, labelPos, RADIO.color);
    grp.add(leader);

    const el = document.createElement('div');
    el.className = 'radio-chip';
    el.innerHTML =
      `<b>${String(i + 1).padStart(2, '0')}</b>` +
      `<u>${ep.date.slice(5).replace('-', '.')}</u><em>▶</em>`;
    el.title = `${formatDate(ep.date)} · ${ep.title}`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); selectRadio(i, true); });
    const lbl = new CSS2DObject(el);
    lbl.position.copy(labelPos);
    grp.add(lbl);

    const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(q.point);
    hit.scale.setScalar(7);
    hit.userData.radioIndex = i;
    grp.add(hit);
    pickables.push(hit);

    revealAt(q.point.x, node, halo, lbl, leader);
    radios.push({ i, ep, node, halo, el, nr, hr, pos: q.point.clone(), up: up.clone(), phase: rng() * Math.PI * 2, total });
  });

  scene.add(grp);
}

/* ==================================================================
 * 6-d. 나의 연수아저씨 회차
 * ================================================================== */

// 메라디오 칩 · 사건 라벨까지 장애물로 넣고 전수 탐색한 값 (충돌 0)
const DRIVE_OFFSETS = [16, -46, -16, 16, -16];
const drives = [];
{
  const grp = new THREE.Group();
  const total = DRIVE.episodes.length;

  DRIVE.episodes.forEach((ep, i) => {
    const q = pointAtX(DRIVE_LINE, dateToX(ep.date));
    const up = upAtTangent(q.tangent);
    const drop = smoothstep(DRIVE_START_X, DRIVE_DROP_END_X, q.point.x);
    const chipOff = DRIVE_OFFSETS[i % DRIVE_OFFSETS.length] - (1 - drop) * 38;

    // 조회수에 비례한 크기 — 거제 왕복편·졸업식이 확 부푼다
    const vs = 0.85 + Math.min(1.55, (ep.views || 0) / 2600000);
    const nr = 1.9 * vs;
    const hr = 15 * vs;

    const node = makeNode(DRIVE.core, nr);
    node.position.copy(q.point);
    const halo = makeHalo(DRIVE.color, hr, 0.5);
    halo.position.copy(q.point);
    grp.add(node, halo);

    const labelPos = q.point.clone().addScaledVector(up, chipOff);
    const leader = makeLeader(q.point, labelPos, DRIVE.color);
    grp.add(leader);

    const el = document.createElement('div');
    el.className = 'radio-chip drive-chip';
    el.innerHTML =
      `<b>${String(i + 1).padStart(2, '0')}</b>` +
      `<u>${ep.date.slice(5).replace('-', '.')}</u><em>▶</em>`;
    el.title = `${formatDate(ep.date)} · ${ep.title}`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); selectDrive(i, true); });
    const lbl = new CSS2DObject(el);
    lbl.position.copy(labelPos);
    grp.add(lbl);

    const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(q.point);
    hit.scale.setScalar(7);
    hit.userData.driveIndex = i;
    grp.add(hit);
    pickables.push(hit);

    revealAt(q.point.x, node, halo, lbl, leader);
    drives.push({ i, ep, node, halo, el, nr, hr, pos: q.point.clone(), phase: rng() * Math.PI * 2, total });
  });

  scene.add(grp);
}

/* ==================================================================
 * 6-f. 대표와 이사 회차
 * ================================================================== */

const STAFF_OFFSETS = [18, -40, -18, 40, -18];
const staffs = [];
{
  const grp = new THREE.Group();
  const total = STAFF.episodes.length;

  STAFF.episodes.forEach((ep, i) => {
    const q = pointAtX(STAFF_LINE, dateToX(ep.date));
    const up = upAtTangent(q.tangent);
    const drop = smoothstep(STAFF_START_X, STAFF_DROP_END_X, q.point.x);
    const chipOff = STAFF_OFFSETS[i % STAFF_OFFSETS.length] - (1 - drop) * 34;

    const vs = 0.85 + Math.min(1.5, (ep.views || 0) / 2200000);
    const nr = 1.8 * vs;
    const hr = 14 * vs;

    const node = makeNode(STAFF.core, nr);
    node.position.copy(q.point);
    const halo = makeHalo(STAFF.color, hr, 0.5);
    halo.position.copy(q.point);
    grp.add(node, halo);

    const labelPos = q.point.clone().addScaledVector(up, chipOff);
    const leader = makeLeader(q.point, labelPos, STAFF.color);
    grp.add(leader);

    const el = document.createElement('div');
    el.className = `radio-chip staff-chip${ep.hi ? ' is-hi' : ''}`;
    el.innerHTML =
      `<b>${String(i + 1).padStart(2, '0')}</b>` +
      `<u>${ep.date.slice(5).replace('-', '.')}</u><em>▶</em>`;
    el.title = `${formatDate(ep.date)} · ${ep.title}`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); selectStaff(i, true); });
    const lbl = new CSS2DObject(el);
    lbl.position.copy(labelPos);
    grp.add(lbl);

    const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(q.point);
    hit.scale.setScalar(7);
    hit.userData.staffIndex = i;
    grp.add(hit);
    pickables.push(hit);

    revealAt(q.point.x, node, halo, lbl, leader);
    staffs.push({ i, ep, node, halo, el, nr, hr, pos: q.point.clone(), phase: rng() * Math.PI * 2, total });
  });

  scene.add(grp);
}

/* ==================================================================
 * 6-g. 곁줄기 — 광고 · 사주
 *
 * 메라디오 · 연수아저씨 · 대표와 같은 꼴이라 한 번만 쓰고 두 줄에 쓴다.
 * 본류에서 갈라져 제 깊이로 내려간 뒤 나란히 흐르고, 회차 칩이 붙는다.
 * ================================================================== */

const sideLines = [];
function buildSideLine(cfg) {
  const { data, y, offsets, cls } = cfg;
  // 첫 회차가 나올 때쯤엔 이미 제 깊이에 내려와 있어야 한다.
  // 늦게 내려오면 그 구간에서 옆 줄기(연수아저씨 등)와 같은 높이를 지나며 엉킨다.
  const startX = dateToX(data.episodes[0].date) - (cfg.lead ?? 120);
  const dropEndX = startX + (cfg.dropSpan ?? 200);

  const pts = [];
  const i0 = pointAtX(MAIN, startX).i;
  for (let i = i0; i <= MAIN.n; i += 8) {
    const p = MAIN.pts[i];
    const k = smoothstep(startX, dropEndX, p.x);
    pts.push(new THREE.Vector3(p.x, p.y + (y + Math.sin(p.x * 0.016 + cfg.phase) * 3.5) * k, p.z + 10 * k));
  }
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  c.arcLengthDivisions = 1800;
  const LINE = sampleCurve(c, 700);

  const grp = new THREE.Group();
  const SAT = satAt(startX);
  const sU = [dateToX('2024-03-26'), dateToX('2026-03-20')];
  const m = filamentMaterial({
    glow: data.color, core: data.core, intensity: 0.28, speed: 0.15, flowScale: 3,
    headFade: 0.06, tailFade: 0.06, rimPower: 2.2, grain: 0.34, sat: SAT, satU: sU,
  });
  const h = filamentMaterial({
    glow: data.color, core: data.core, intensity: 0.075, speed: 0.05, flowScale: 5,
    headFade: 0.08, tailFade: 0.08, rimPower: 2.6, grain: 0.3, sat: SAT, satU: sU,
  });
  const lh = new THREE.Mesh(taperedTube(LINE.curve, () => 2.9, 300, 10), h);
  const lm = new THREE.Mesh(taperedTube(LINE.curve, () => 0.5, 700, 8), m);
  grp.add(lh, lm);
  timelineMats.push({ m, line: LINE }, { m: h, line: LINE });
  revealAt(startX, lh, lm);

  const nameAnchor = pointAtX(LINE, dropEndX + 40);
  const nameEl = document.createElement('div');
  nameEl.className = `echo-label ${cls}-label`;
  nameEl.innerHTML =
    `<b>${data.label} · ${data.sub}</b><span>${data.caption}</span>` +
    `<i>${formatDate(data.episodes[0].date)} 시작 · 총 ${data.episodes.length}편</i>`;
  const nameObj = new CSS2DObject(nameEl);
  nameObj.position.copy(nameAnchor.point).add(new THREE.Vector3(0, -24, 0));
  grp.add(nameObj);
  revealAt(dropEndX + 40, nameObj);

  const jp = pointAtX(MAIN, startX);
  const jhalo = makeHalo(data.color, 15, 0.5);
  jhalo.position.copy(jp.point);
  grp.add(jhalo);
  revealAt(startX, jhalo);

  const side = { data, LINE, cls, items: [], startX, dropEndX };
  const si = sideLines.length;

  const maxViews = Math.max(...data.episodes.map((e) => e.views || 1));
  data.episodes.forEach((ep, i) => {
    const q = pointAtX(LINE, dateToX(ep.date));
    const up = upAtTangent(q.tangent);
    const drop = smoothstep(startX, dropEndX, q.point.x);
    const chipOff = offsets[i % offsets.length] - (1 - drop) * 32;

    // 조회수 차이가 5만 배까지 나므로 로그로 눌러야 작은 게 안 사라진다
    const vs = 0.8 + 1.5 * (Math.log10((ep.views || 1) + 1) / Math.log10(maxViews + 1));
    const nr = 1.7 * vs;
    const hr = 13 * vs;

    const node = makeNode(data.core, nr);
    node.position.copy(q.point);
    const halo = makeHalo(data.color, hr, 0.5);
    halo.position.copy(q.point);
    grp.add(node, halo);

    const labelPos = q.point.clone().addScaledVector(up, chipOff);
    const leader = makeLeader(q.point, labelPos, data.color);
    grp.add(leader);

    const el = document.createElement('div');
    el.className = `radio-chip ${cls}-chip${ep.hi ? ' is-hi' : ''}${ep.ppl ? ' is-ppl' : ''}`;
    el.innerHTML =
      `<b>${String(i + 1).padStart(2, '0')}</b>` +
      `<u>${ep.date.slice(5).replace('-', '.')}</u><em>▶</em>`;
    el.title = `${formatDate(ep.date)} · ${ep.ppl ? 'PPL · ' : ''}${ep.title}`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); selectSide(si, i, true); });
    const lbl = new CSS2DObject(el);
    lbl.position.copy(labelPos);
    grp.add(lbl);

    const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(q.point);
    hit.scale.setScalar(7);
    hit.userData.side = { si, i };
    grp.add(hit);
    pickables.push(hit);

    revealAt(q.point.x, node, halo, lbl, leader);
    side.items.push({ i, ep, node, halo, el, nr, hr, pos: q.point.clone(), phase: rng() * Math.PI * 2 });
  });

  scene.add(grp);
  sideLines.push(side);
  return side;
}

buildSideLine({ data: AD,   y: -604, phase: 0.4, lead: 130, dropSpan: 200, offsets: [18, -40, -18, 40, -18], cls: 'ad' });
buildSideLine({ data: BUY,  y: -660, phase: 2.1, lead: 150, dropSpan: 190, offsets: [-18, 36, -36, 18, -18], cls: 'buy' });

/* ==================================================================
 * 6-e. 굴욕 타임라인 — 멤버마다 한 줄
 *
 * 자기 순간들이 있는 구간만 짧게 깔린다. 비어 있는 멤버는 선을 안 그린다.
 * ================================================================== */

const shames = [];
{
  const grp = new THREE.Group();

  SHAME.members.forEach((mem, mi) => {
    if (!mem.moments.length) return;   // 아직 자료가 없는 멤버는 건너뛴다

    const xs = mem.moments.map((v) => dateToX(v.date));
    const x0 = Math.min(...xs) - 150;
    const x1 = Math.max(...xs) + 150;

    // 본류에서 갈라져 나오지 않는다 — 자기 높이에 놓인 독립된 선.
    // 다만 자로 그은 듯 완전히 평평하면 죽은 선처럼 보이므로,
    // 본류와 무관한 자기만의 완만한 굽이를 준다 (멤버마다 위상이 다르다).
    const pts = [];
    const SEG = 48;
    const ph = mi * 1.9;
    for (let i = 0; i <= SEG; i++) {
      const x = lerp(x0, x1, i / SEG);
      const w = x * 0.0125;
      // 양 끝으로 갈수록 굽이가 잦아들어 매듭 없이 사라진다
      const edge = smoothstep(x0, x0 + 130, x) * smoothstep(x1, x1 - 130, x);
      const wy = (Math.sin(w + ph) * 11 + Math.sin(w * 2.3 + ph * 1.7) * 5) * edge;
      const wz = (Math.cos(w * 0.8 + ph) * 20 + Math.sin(w * 1.9 + ph) * 9) * edge;
      pts.push(new THREE.Vector3(x, mem.lane + wy, 34 + wz));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    curve.arcLengthDivisions = 400;
    // 진행 노출이 line.tan / nrm / bin 을 쓰므로 다른 시간선과 같은 형태로 샘플링해 둔다
    const lane = sampleCurve(curve, 200);

    const mat = filamentMaterial({
      glow: mem.color, core: mem.core, intensity: 0.42, speed: 0.18, flowScale: 9,
      headFade: 0.16, tailFade: 0.16, rimPower: 1.5, grain: 0.7,
      sat: [1, 1, 1], satU: [-1, -1],
    });
    const tube = new THREE.Mesh(taperedTube(curve, () => 0.5, 200, 8), mat);
    grp.add(tube);
    timelineMats.push({ m: mat, line: lane });
    revealAt(x0, tube);

    // 멤버 이름표 — 선 왼쪽 끝
    const head = lane.pts[Math.round(lane.n * 0.04)].clone();
    const nameEl = document.createElement('div');
    nameEl.className = 'shame-name';
    nameEl.innerHTML = `<b>${mem.name}</b><span>${SHAME.label}</span>`;
    const nameLbl = new CSS2DObject(nameEl);
    nameLbl.position.copy(head).add(new THREE.Vector3(-38, 0, 0));
    grp.add(nameLbl);
    revealAt(x0, nameLbl);

    mem.moments.forEach((mo, i) => {
      const x = dateToX(mo.date);
      const at = pointAtX(lane, x).point;

      const node = makeNode(mem.core, 2.2);
      node.position.copy(at);
      const halo = makeHalo(mem.color, 20, 0.55);
      halo.position.copy(at);
      grp.add(node, halo);

      // 칩은 늘 선 아래에 붙인다. 레인 간격이 46 이라 세로로는 한 줄밖에 못 들어가고,
      // 위아래로 번갈아 두면 옆 레인 칩과 부딪힌다. 붙어 있는 순간은 가로로 벌린다.
      const prevX = i > 0 ? dateToX(mem.moments[i - 1].date) : -Infinity;
      const nextX = i < mem.moments.length - 1 ? dateToX(mem.moments[i + 1].date) : Infinity;
      const crowded = x - prevX < 260 || nextX - x < 260;
      const xOff = crowded ? (i % 2 ? 78 : -78) : 0;
      const labelPos = at.clone().add(new THREE.Vector3(xOff, -28, 0));
      const leader = makeLeader(at, labelPos, mem.color);
      grp.add(leader);

      const el = document.createElement('div');
      el.className = 'shame-chip';
      el.innerHTML = `<b>${mo.title}</b><em>▶</em>`;
      el.title = `${formatDate(mo.date)} · ${mo.note || ''}`;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); selectShame(mi, i); });
      const lbl = new CSS2DObject(el);
      lbl.position.copy(labelPos);
      grp.add(lbl);

      const hit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(at);
      hit.scale.setScalar(9);
      hit.userData.shame = { mi, i };
      grp.add(hit);
      pickables.push(hit);

      revealAt(x, node, halo, lbl, leader);
      shames.push({ mi, i, mem, mo, node, halo, el, pos: at.clone(), phase: rng() * Math.PI * 2 });
    });
  });

  scene.add(grp);
}

/* ==================================================================
 * 6-c. 타이틀곡 MV — 본류 위의 클릭 가능한 사건
 *
 * 노드는 시간선 "위"에 그대로 박아 두고(고정 좌표), 썸네일 스크린만
 * 카메라 기준 위쪽으로 띄운다. 오프셋 방향이 카메라 up 벡터라서
 * 어느 방향에서 돌려 봐도 스크린이 시간선 바로 옆에 붙어 보인다.
 * 노드·스크린·캡션 어디를 눌러도 재생된다.
 * ================================================================== */

const mvScreens = [];
const formatViews = (n) =>
  n >= 100000000 ? `${(n / 100000000).toFixed(1)}억회` : `${Math.round(n / 10000).toLocaleString('ko-KR')}만회`;

{
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const grp = new THREE.Group();
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const MV_GLOW = 0xffb14a;
  const MV_CORE = 0xfff0d8;

  MVS.forEach((mv, i) => {
    const line = LINES[mv.line] || MAIN;
    const q = pointAtX(line, dateToX(mv.date));
    const anchor = q.point.clone();          // 시간선 위 고정점
    const sat = satAt(dateToX(mv.date));
    const gCol = desat(MV_GLOW, sat[0]);
    const cCol = desat(MV_CORE, sat[0]);

    /* --- 시간선 위 노드 (사건과 같은 방식으로 클릭된다) --- */
    const node = makeNode(cCol, mv.major ? 2.4 : 1.9);
    node.position.copy(anchor);
    const halo = makeHalo(gCol, mv.major ? 26 : 20, 0.5);
    halo.position.copy(anchor);
    const ring = new THREE.Mesh(
      RING_GEO,
      new THREE.MeshBasicMaterial({ color: gCol, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.copy(anchor);
    ring.scale.setScalar(mv.major ? 8 : 6.4);
    grp.add(node, halo, ring);

    const nodeHit = new THREE.Mesh(HIT_GEO, new THREE.MeshBasicMaterial({ visible: false }));
    nodeHit.position.copy(anchor);
    nodeHit.scale.setScalar(11);
    nodeHit.userData.mvIndex = i;
    grp.add(nodeHit);
    pickables.push(nodeHit);

    /* --- 카메라 기준으로 띄우는 스크린 --- */
    const W = mv.major ? 76 : 62;
    const H = (W * 9) / 16;
    const holder = new THREE.Group();
    holder.position.copy(anchor);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xff9c33, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.scale.set(W * 1.3, H * 1.45, 1);
    holder.add(glow);

    const frameMat = new THREE.MeshBasicMaterial({
      color: 0xffa93c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(PLANE, frameMat);
    frame.scale.set(W + 5, H + 5, 1);
    holder.add(frame);

    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x1a0f07, transparent: true, opacity: 1, toneMapped: false, side: THREE.DoubleSide, depthWrite: false,
    });
    const screen = new THREE.Mesh(PLANE, screenMat);
    screen.scale.set(W, H, 1);
    screen.position.z = 0.1;
    holder.add(screen);

    loader.load(
      `https://i.ytimg.com/vi/${mv.id}/mqdefault.jpg`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        // mqdefault 는 16:9 위아래에 검은 띠가 있어 살짝 잘라낸다
        tex.offset.set(0, 0.1);
        tex.repeat.set(1, 0.8);
        screenMat.map = tex;
        screenMat.color.setHex(0xf0dcc4);
        screenMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );

    const hit = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    hit.scale.set(W + 8, H + 8, 1);
    hit.position.z = 0.2;
    hit.userData.mvIndex = i;
    holder.add(hit);
    pickables.push(hit);

    // 캡션은 홀더의 자식이라 스크린을 그대로 따라다닌다
    const el = document.createElement('div');
    el.className = `mv-card${mv.major ? ' is-major' : ''}${mv.completedBy ? ' is-cut' : ''}`;
    el.innerHTML = `
      <span class="mv-play">▶</span>
      <span class="mv-text">
        <b>${mv.song}</b>
        <i>${mv.album}</i>
        <u>${formatDate(mv.date)} · ${formatViews(mv.views)}${mv.run ? ` · ${mv.run}` : ''}</u>
        ${mv.note ? `<em class="mv-note${mv.completedBy ? ' is-cut' : ''}">${mv.note}</em>` : ''}
      </span>`;
    el.title = mv.note ? `${mv.song} Official MV — ${mv.note}` : `${mv.song} Official MV`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); openMv(i); });
    const card = new CSS2DObject(el);
    card.position.set(0, H / 2 + 20, 0);
    holder.add(card);
    grp.add(holder);

    // 노드 → 스크린 연결선. 스크린이 매 프레임 움직이므로 setEnds 로 늘려 쓴다.
    const leader = makeLeader(anchor, anchor.clone().add(new THREE.Vector3(0, 1, 0)), gCol);
    grp.add(leader);

    revealAt(anchor.x, node, halo, ring, holder, leader);
    // 스크린에 붙어 있어야 하므로 옮기지는 않고, 겹침 계산에는 참여한다
    declutter.push({
      obj: card, el, fixed: true, kind: 'mv',
      baseFn: (out) => out.copy(holder.position).addScaledVector(camUp, H / 2 + 20),
      base: new THREE.Vector3(),
    });
    mvScreens.push({
      mv, i, holder, frameMat, glow, el, node, halo, ring, leader,
      anchor, lift: mv.lift ?? (i % 2 ? 188 : 104), nodeR: mv.major ? 2.4 : 1.9,
      haloR: mv.major ? 26 : 20, halfH: H / 2, phase: rng() * Math.PI * 2,
    });
  });

  scene.add(grp);
}

/* --- 6-i. 미완성 → 완성 실 -----------------------------------------
 * 선공개 「YoYo」 MV 는 예산이 모자라 곡 전체를 찍지 못했다(1:47).
 * 한 달 뒤 「UhUh」가 풀 버전(3:34)으로 다시 서서 공식 데뷔 타이틀이 된다.
 * 두 노드를 화면 앞쪽(+Z)으로 얕게 감아 잇고, 실이 나아갈수록 색이 살아나게 해
 * "반쪽으로 끊긴 것이 한 달 뒤 완성됐다"는 관계 자체를 보이게 만든다.
 * ------------------------------------------------------------------ */

const arcThreads = [];
for (const src of mvScreens) {
  if (!src.mv.completedBy) continue;
  const dst = mvScreens.find((s) => s.mv.song === src.mv.completedBy);
  if (!dst) continue;

  const a = src.anchor.clone();
  const b = dst.anchor.clone();
  const dip = -58;          // 본류 아래로 살짝 — 메라디오 레인(-152)까지는 닿지 않는다
  const front = 150;        // MV 스크린이 없는 앞쪽 통로를 쓴다
  const curve = new THREE.CatmullRomCurve3(
    [
      a,
      new THREE.Vector3(lerp(a.x, b.x, 0.26), a.y + dip * 0.8, front * 0.72),
      new THREE.Vector3(lerp(a.x, b.x, 0.5), (a.y + b.y) / 2 + dip, front),
      new THREE.Vector3(lerp(a.x, b.x, 0.74), b.y + dip * 0.8, front * 0.72),
      b,
    ],
    false,
    'centripetal',
    0.5
  );
  curve.arcLengthDivisions = 400;

  const mat = filamentMaterial({
    glow: 0xffb14a, core: 0xfff0d8, intensity: 0.3, speed: 0.72, flowScale: 4.2,
    headFade: 0.02, tailFade: 0.02, rimPower: 2.1, grain: 0.42,
    // 데뷔 전(거의 흑백)에서 출발해 「UhUh」에 닿으며 색이 돈다
    sat: [SAT[0], SAT[1], SAT[1]], satU: [0.62, 0.99],
  });
  // 출발이 가늘고 도착이 굵다 — 반쪽에서 완성으로
  const thread = new THREE.Mesh(taperedTube(curve, (u) => 0.42 + u * 1.05, 200, 6), mat);
  scene.add(thread);

  const mid = curve.getPoint(0.5);
  const el = document.createElement('div');
  el.className = 'arc-chip';
  el.innerHTML = `<b>${src.mv.run} → ${dst.mv.run}</b><span>미완성 → 완성</span>`;
  el.title = `${src.mv.song} — ${src.mv.note} / ${dst.mv.song} — ${dst.mv.note}`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); openMv(dst.i); });
  const chipPos = mid.clone().add(new THREE.Vector3(0, -34, 0));
  const chip = new CSS2DObject(el);
  chip.position.copy(chipPos);
  scene.add(chip);
  const leader = makeLeader(mid, chipPos, 0xffb14a);
  scene.add(leader);

  // 완성 지점에 닿아야 나타난다 — 재생 중엔 「UhUh」를 지날 때 그려진다
  revealAt(b.x, thread, chip, leader);
  declutter.push({ obj: chip, el, base: chipPos.clone(), from: mid.clone(), leader, kind: 'label' });
  arcThreads.push({ src, dst, mat, el, mid: mid.clone(), chipPos: chipPos.clone(), phase: rng() * Math.PI * 2 });
}

/* ==================================================================
 * 7. 장식용 미세 분기
 * ================================================================== */

const ghosts = [];
function buildGhosts() {
  const g = new THREE.Group();
  for (let i = 0; i < 52; i++) {
    const onNexus = rng() < 0.34;
    const line = onNexus ? NEXUS_LINE : MAIN;
    const x = onNexus
      ? lerp(RISE_END_X + 20, TIME.xTailEnd - 40, rng())
      : lerp(TIME.xTailHead + 30, TIME.xTailEnd - 30, rng());
    const { point: base, tangent } = pointAtX(line, x);
    const t = tangent.clone().normalize();
    const wu = new THREE.Vector3(0, 1, 0).addScaledVector(t, -t.y).normalize();
    const ws = new THREE.Vector3().crossVectors(t, wu).normalize();
    const a = rng() * Math.PI * 2;
    const dir = wu.clone().multiplyScalar(Math.cos(a)).addScaledVector(ws, Math.sin(a)).normalize();
    const L = 9 + Math.pow(rng(), 1.6) * 40;

    const curve = new THREE.CatmullRomCurve3([
      base.clone(),
      base.clone().addScaledVector(t, L * 0.4).addScaledVector(dir, L * 0.07),
      base.clone().addScaledVector(t, L * 0.6).addScaledVector(dir, L * 0.5),
      base.clone().addScaledVector(t, L * 0.68).addScaledVector(dir, L * 0.95),
    ]);
    curve.arcLengthDivisions = 200;
    // 갈라진 뒤 남은 원래 흐름의 잔가지는 더 흐리게
    const faded = !onNexus && x > NEXUS_X;
    const mat = filamentMaterial({
      glow: onNexus ? 0xffa030 : 0xff7418,
      core: 0xffd4a0,
      intensity: (0.28 + rng() * 0.24) * (faded ? 0.35 : 1),
      speed: 0.24 + rng() * 0.34, flowScale: 1.3, headFade: 0.07, tailFade: 0.02, rimPower: 1.9,
      sat: onNexus ? [1, 1, 1] : satAt(x), satU: [-1, -1],
    });
    const gm = new THREE.Mesh(taperedTube(curve, (u) => lerp(0.42, 0.08, u), 44, 6), mat);
    g.add(gm);
    revealAt(x < PLAY_HEAD_X ? Infinity : x, gm);
    ghosts.push({ mat, phase: rng() * Math.PI * 2, rate: 0.35 + rng() * 1.7 });
  }
  scene.add(g);
}
buildGhosts();

/* ==================================================================
 * 7-b. 대박 분기점의 빅뱅
 *
 * 재생이 분기점에 닿는 순간 한 번만 터진다.
 * 흰 섬광 → 충격파 두 겹 → 파편 900개 → 길게 늘어나는 광선,
 * 그리고 카메라가 잠깐 흔들린다. 다 잦아든 뒤에 소개 카드가 뜬다.
 * ================================================================== */

const BANG_LEAD = 2.6;   // 꽃잎이 퍼질 때까지 기다렸다 소개 카드

const bang = { t: 99, pos: new THREE.Vector3(), on: false };
const bangFlashEl = document.getElementById('bang-flash');

const bangGroup = new THREE.Group();
bangGroup.visible = false;
scene.add(bangGroup);

/**
 * 중심에서 터져나가는 꽃잎.
 * 리센느의 이름이 "향기로 다시 장면을 떠올린다"이므로,
 * 분기점은 파편이 아니라 꽃잎이 사방으로 흩어지며 세상을 물들이는 그림으로 간다.
 */
const BANG_N = 900;
const bangDir = new Float32Array(BANG_N * 3);
const bangSpd = new Float32Array(BANG_N);
const bangGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(BANG_N * 3);
  const col = new Float32Array(BANG_N * 3);
  const siz = new Float32Array(BANG_N);
  const c = new THREE.Color();
  for (let i = 0; i < BANG_N; i++) {
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(2 * rng() - 1);
    // 시간선을 따라 옆으로 더 길게 퍼지도록 x 를 늘린다
    bangDir[i * 3] = Math.sin(ph) * Math.cos(th) * 1.9;
    bangDir[i * 3 + 1] = Math.cos(ph);
    bangDir[i * 3 + 2] = Math.sin(ph) * Math.sin(th);
    bangSpd[i] = 260 + Math.pow(rng(), 2.1) * 1500;
    siz[i] = 7 + Math.pow(rng(), 2.2) * 26;
    // 벚꽃 분홍 ~ 살구 ~ 크림. 몇 장은 거의 흰색으로 튄다.
    const t = rng();
    if (t > 0.9) c.setHSL(0.09, 0.35, 0.95);
    else if (t > 0.55) c.setHSL(0.955 + rng() * 0.04, 0.72, 0.78 + rng() * 0.12);
    else c.setHSL(0.03 + rng() * 0.045, 0.68, 0.72 + rng() * 0.14);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  bangGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bangGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  bangGeo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  const spin = new Float32Array(BANG_N);
  for (let i = 0; i < BANG_N; i++) spin[i] = rng();
  bangGeo.setAttribute('spin', new THREE.BufferAttribute(spin, 1));
}
const bangMat = new THREE.ShaderMaterial({
  uniforms: {
    uMap: { value: PETAL_TEX },
    uPR: { value: renderer.getPixelRatio() },
    uFade: { value: 1 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    attribute float size;
    attribute float spin;
    varying vec3 vColor;
    varying float vSpin;
    uniform float uPR;
    uniform float uTime;
    void main() {
      vColor = color;
      // 꽃잎마다 다른 속도로 뒤집히며 돈다
      vSpin = spin * 6.283 + uTime * (1.4 + fract(spin) * 3.2);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * uPR * (420.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform float uFade;
    varying vec3 vColor;
    varying float vSpin;
    void main() {
      // 점 스프라이트를 회전시켜 꽃잎이 팔랑이게 한다
      vec2 p = gl_PointCoord - 0.5;
      float c = cos(vSpin), s = sin(vSpin);
      // 세로로 눌러 뒤집히는 느낌 (|cos| 이 0 에 가까우면 옆면이라 얇아진다)
      p = mat2(c, -s, s, c) * p;
      p.y /= max(0.22, abs(cos(vSpin * 0.7)));
      vec2 uv = p + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
      float a = texture2D(uMap, uv).a * uFade;
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor * a * 1.5, a);
    }
  `,
  vertexColors: true, transparent: true, blending: THREE.NormalBlending, depthWrite: false,
});
const bangPts = new THREE.Points(bangGeo, bangMat);
bangPts.frustumCulled = false;
bangGroup.add(bangPts);

/** 터지는 순간의 흰 심 */
const bangCore = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
);
bangGroup.add(bangCore);

/** 충격파 두 겹 */
const bangRings = [0, 0.16].map((off) => {
  const m = new THREE.Mesh(
    SHOCK_GEO,
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  m.frustumCulled = false;
  bangGroup.add(m);
  return { mesh: m, off };
});

/** 향기 물결 — 세상을 물들이며 퍼지는 부드러운 색 */
const scentWaves = [0, 0.28, 0.56].map((off, i) => {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: GLOW_TEX, color: [0xffb7c8, 0xffd0a8, 0xffe8d0][i],
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  bangGroup.add(sp);
  return { sp, off };
});

/** 좌우로 길게 뻗는 광선 */
const bangBeam = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: ANAMORPH_TEX, color: 0xfff0d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
);
bangGroup.add(bangBeam);

function fireBigBang(pos) {
  bang.pos.copy(pos);
  bang.t = 0;
  bang.on = true;
  bangGroup.visible = true;
  bangGroup.position.copy(pos);
}

/** 0 이 아니면 카메라를 흔든다 */
function bangShake() {
  if (!bang.on || bang.t > 0.9) return 0;
  return Math.pow(1 - bang.t / 0.9, 2.4);
}

function updateBigBang(dt, time) {
  if (!bang.on) return;
  bang.t += dt;
  const t = bang.t;
  if (t > 4.6) {
    bang.on = false;
    bangGroup.visible = false;
    if (bangFlashEl) bangFlashEl.style.opacity = '0';
    return;
  }

  // 섬광 — 터지는 순간보다 물드는 느낌이 커야 하므로 조금 낮추고 길게 뺀다
  if (bangFlashEl) {
    const f = t < 0.11 ? t / 0.11 : Math.max(0, 1 - (t - 0.11) / 1.25);
    bangFlashEl.style.opacity = String(Math.pow(f, 1.5) * 0.66);
  }

  // 심
  const ck = clamp(t / 0.22, 0, 1);
  bangCore.scale.setScalar(40 + easeOutQuint(ck) * 620);
  bangCore.material.opacity = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 1.5);

  // 충격파
  for (const r of bangRings) {
    const k = clamp((t - r.off) / 2.1, 0, 1);
    r.mesh.quaternion.copy(camera.quaternion);
    r.mesh.scale.setScalar(20 + easeOutQuint(k) * 2100);
    r.mesh.material.opacity = k <= 0 ? 0 : Math.sin(k * Math.PI) * 0.3;
  }

  // 광선 — 순간적으로 좌우로 찢어졌다가 잦아든다
  const bk = clamp(t / 0.5, 0, 1);
  bangBeam.quaternion.copy(camera.quaternion);
  bangBeam.scale.set(300 + easeOutQuint(bk) * 3400, 60 + (1 - bk) * 120, 1);
  bangBeam.material.opacity = Math.max(0, 1 - t / 1.6) * 0.34;

  // 향기 물결 — 아주 넓게, 아주 부드럽게
  for (const w of scentWaves) {
    const k = clamp((t - w.off) / 2.8, 0, 1);
    if (k <= 0) { w.sp.material.opacity = 0; continue; }
    w.sp.scale.setScalar(120 + easeOutQuint(k) * 2600);
    w.sp.material.opacity = Math.sin(k * Math.PI) * 0.2;
  }

  // 꽃잎 — 곧게 날아가지 않는다. 빠르게 흩어졌다 공기에 잡혀 느려지고,
  // 옆으로 흔들리며 천천히 가라앉는다.
  const arr = bangGeo.attributes.position.array;
  const spread = 1 - Math.pow(1 - clamp(t / 3.2, 0, 1), 2.4);
  for (let i = 0; i < BANG_N; i++) {
    const d = bangSpd[i] * spread * 0.85;
    const ph = bangSpd[i];                       // 꽃잎마다 다른 위상
    const sway = Math.sin(t * (1.1 + (ph % 7) * 0.24) + ph) * 26 * spread;
    const sway2 = Math.cos(t * (0.8 + (ph % 5) * 0.3) + ph * 1.7) * 20 * spread;
    arr[i * 3] = bangDir[i * 3] * d + sway;
    arr[i * 3 + 1] = bangDir[i * 3 + 1] * d + sway2 - t * t * 11;   // 서서히 가라앉는다
    arr[i * 3 + 2] = bangDir[i * 3 + 2] * d + sway * 0.6;
  }
  bangGeo.attributes.position.needsUpdate = true;
  bangMat.uniforms.uTime.value = t;
  bangMat.uniforms.uFade.value = t < 0.16 ? t / 0.16 : Math.max(0, 1 - Math.pow(clamp((t - 0.16) / 3.1, 0, 1), 1.7));
}

/* ==================================================================
 * 7-c. 거제편 이후 — 온 우주를 떠다니는 꽃잎과 향기
 *
 * 분기점에서 끊임없이 새 꽃잎이 태어나 사방으로 퍼지고, 수명이 다하면
 * 다시 그 자리에서 태어난다. 처음부터 나이를 흩어 두어 시작하자마자
 * 공간이 이미 차 있게 만든다. 재생 중에는 진행선을 넘어선 꽃잎을 숨긴다.
 * ================================================================== */

const PETALS_N = 1500;
const petalField = (() => {
  const pos = new Float32Array(PETALS_N * 3);
  const col = new Float32Array(PETALS_N * 3);
  const siz = new Float32Array(PETALS_N);
  const spn = new Float32Array(PETALS_N);
  const base = new Float32Array(PETALS_N);
  const vel = new Float32Array(PETALS_N * 3);
  const age = new Float32Array(PETALS_N);
  const life = new Float32Array(PETALS_N);
  const seed = new Float32Array(PETALS_N);
  const c = new THREE.Color();

  // 한 점이 아니라 새 시간선 "전체"에서 피어난다.
  // 분기점 근처를 더 촘촘하게 잡아 터진 자리가 여전히 진원지로 읽히게 한다.
  const spawn = (i, prime) => {
    const along = Math.pow(rng(), 1.6);             // 분기점 쪽으로 치우친 분포
    const idx = clamp(Math.round(along * NEXUS_LINE.n), 0, NEXUS_LINE.n);
    const p = NEXUS_LINE.pts[idx];
    const nn = NEXUS_LINE.nrm[idx];
    const bb = NEXUS_LINE.bin[idx];

    // 시간선 둘레에서 피어난다
    const a = rng() * Math.PI * 2;
    const r = 6 + rng() * 26;
    pos[i * 3] = p.x + (nn.x * Math.cos(a) + bb.x * Math.sin(a)) * r;
    pos[i * 3 + 1] = p.y + (nn.y * Math.cos(a) + bb.y * Math.sin(a)) * r;
    pos[i * 3 + 2] = p.z + (nn.z * Math.cos(a) + bb.z * Math.sin(a)) * r;

    // 선에서 바깥으로 밀려나며 앞쪽으로도 흐른다
    const sp = 10 + Math.pow(rng(), 1.7) * 40;
    vel[i * 3] = sp * (0.25 + rng() * 1.1);
    vel[i * 3 + 1] = sp * ((nn.y * Math.cos(a) + bb.y * Math.sin(a)) * 1.5 + (rng() - 0.5) * 0.9);
    vel[i * 3 + 2] = sp * ((nn.z * Math.cos(a) + bb.z * Math.sin(a)) * 1.7 + (rng() - 0.5) * 1.1);

    life[i] = 26 + rng() * 44;
    age[i] = prime ? rng() * life[i] : 0;
    seed[i] = rng() * 100;
    base[i] = 5 + Math.pow(rng(), 2.4) * 22;
    spn[i] = rng();

    const t = rng();
    if (t > 0.9) c.setHSL(0.09, 0.3, 0.94);
    else if (t > 0.55) c.setHSL(0.955 + rng() * 0.04, 0.66, 0.76 + rng() * 0.12);
    else c.setHSL(0.03 + rng() * 0.045, 0.62, 0.7 + rng() * 0.14);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;

    // 이미 흘러간 만큼 미리 밀어 둔다 (시작부터 공간이 차 있게)
    if (prime) {
      const a = age[i];
      pos[i * 3] += vel[i * 3] * a;
      pos[i * 3 + 1] += vel[i * 3 + 1] * a * 0.55;
      pos[i * 3 + 2] += vel[i * 3 + 2] * a;
    }
  };
  for (let i = 0; i < PETALS_N; i++) spawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('spin', new THREE.BufferAttribute(spn, 1));

  const mat = bangMat.clone();
  mat.uniforms.uMap.value = PETAL_TEX;
  mat.uniforms.uFade.value = 1;
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  return function update(dt, time) {
    const front = play.active ? play.front : Infinity;
    const on = !play.active || play.front > NEXUS_X;
    pts.visible = on;
    if (!on) return;

    mat.uniforms.uTime.value = time * 0.35;
    for (let i = 0; i < PETALS_N; i++) {
      age[i] += dt;
      if (age[i] > life[i]) spawn(i, false);

      const sd = seed[i];
      // 팔랑이며 흐른다
      pos[i * 3] += (vel[i * 3] + Math.sin(time * 0.5 + sd) * 5) * dt;
      pos[i * 3 + 1] += (vel[i * 3 + 1] * 0.55 + Math.sin(time * 0.75 + sd * 1.7) * 7) * dt;
      pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(time * 0.42 + sd * 2.3) * 6) * dt;

      // 태어나고 사그라들 때 부드럽게
      const k = age[i] / life[i];
      const fade = Math.min(1, k * 6) * Math.min(1, (1 - k) * 3.4);
      siz[i] = pos[i * 3] <= front ? base[i] * fade : 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  };
})();

/**
 * 데뷔의 꽃잎 — 같은 꽃잎인데 초라하다.
 * 몇 장 안 되고, 작고, 멀리 못 가고, 근처에서 곧 사라진다.
 * 2년 뒤 거제편에서 온 우주를 덮는 그 꽃잎과 같은 것이라는 게 대비의 전부다.
 * (데뷔 쇼케이스 생중계 6만 회 ↔ 거제 1편 1,227만 회)
 */
const DEBUT_PETALS_N = 70;
const debutPetals = (() => {
  const origin = pointAtX(MAIN, DEBUT_X).point.clone();
  const pos = new Float32Array(DEBUT_PETALS_N * 3);
  const col = new Float32Array(DEBUT_PETALS_N * 3);
  const siz = new Float32Array(DEBUT_PETALS_N);
  const spn = new Float32Array(DEBUT_PETALS_N);
  const base = new Float32Array(DEBUT_PETALS_N);
  const vel = new Float32Array(DEBUT_PETALS_N * 3);
  const age = new Float32Array(DEBUT_PETALS_N);
  const life = new Float32Array(DEBUT_PETALS_N);
  const seed = new Float32Array(DEBUT_PETALS_N);
  const c = new THREE.Color();

  const spawn = (i, prime) => {
    const a = rng() * Math.PI * 2;
    const r = 2 + rng() * 9;
    pos[i * 3] = origin.x + Math.cos(a) * r;
    pos[i * 3 + 1] = origin.y + (rng() - 0.3) * 8;
    pos[i * 3 + 2] = origin.z + Math.sin(a) * r;
    // 아주 느리게, 멀리 못 간다
    const sp = 2.5 + rng() * 7;
    vel[i * 3] = sp * (rng() - 0.35) * 1.1;
    vel[i * 3 + 1] = sp * (0.25 + rng() * 0.8);
    vel[i * 3 + 2] = sp * (rng() - 0.5) * 1.2;
    life[i] = 3.4 + rng() * 4.2;
    age[i] = prime ? rng() * life[i] : 0;
    seed[i] = rng() * 100;
    base[i] = 3 + Math.pow(rng(), 2.2) * 8;   // 작다
    spn[i] = rng();
    // 색도 옅다
    const t = rng();
    if (t > 0.7) c.setHSL(0.955 + rng() * 0.03, 0.4, 0.78);
    else c.setHSL(0.05 + rng() * 0.04, 0.34, 0.72 + rng() * 0.1);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    if (prime) {
      const t2 = age[i];
      pos[i * 3] += vel[i * 3] * t2;
      pos[i * 3 + 1] += vel[i * 3 + 1] * t2;
      pos[i * 3 + 2] += vel[i * 3 + 2] * t2;
    }
  };
  for (let i = 0; i < DEBUT_PETALS_N; i++) spawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('spin', new THREE.BufferAttribute(spn, 1));

  const mat = bangMat.clone();
  mat.uniforms.uMap.value = PETAL_TEX;
  mat.uniforms.uFade.value = 0.75;
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  revealAt(DEBUT_X, pts);

  return function update(dt, time) {
    if (!pts.visible) return;
    mat.uniforms.uTime.value = time * 0.3;
    for (let i = 0; i < DEBUT_PETALS_N; i++) {
      age[i] += dt;
      if (age[i] > life[i]) spawn(i, false);
      const sd = seed[i];
      pos[i * 3] += (vel[i * 3] + Math.sin(time * 0.7 + sd) * 2.2) * dt;
      pos[i * 3 + 1] += (vel[i * 3 + 1] - age[i] * 1.4) * dt;      // 이내 가라앉는다
      pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(time * 0.6 + sd * 2) * 2) * dt;
      const k = age[i] / life[i];
      siz[i] = base[i] * Math.min(1, k * 5) * Math.min(1, (1 - k) * 2.2);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  };
})();

/** 향기 — 분기점 이후 공간을 물들이는 아주 옅은 색 안개 */
const scentField = (() => {
  const g = new THREE.Group();
  const puffs = [];
  const origin = pointAtX(MAIN, NEXUS_X).point.clone();
  const tints = [0xffb7c8, 0xffc9a6, 0xffa8bd, 0xffe0c4, 0xff9fb4, 0xffd6b0];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: GLOW_TEX, color: tints[i % tints.length],
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    const size = 900 + rng() * 1900;
    sp.scale.setScalar(size);
    sp.position.set(
      origin.x + 200 + rng() * 2400,
      origin.y + (rng() - 0.45) * 900,
      -300 - rng() * 1600
    );
    g.add(sp);
    puffs.push({ sp, size, phase: rng() * Math.PI * 2, rate: 0.06 + rng() * 0.11, o: 0.05 + rng() * 0.06 });
  }
  scene.add(g);

  return function update(time) {
    const on = !play.active || play.front > NEXUS_X;
    g.visible = on;
    if (!on) return;
    for (const p of puffs) {
      const b = 1 + Math.sin(time * p.rate + p.phase) * 0.16;
      p.sp.scale.setScalar(p.size * b);
      p.sp.material.opacity = p.o * (0.7 + Math.sin(time * p.rate * 1.4 + p.phase) * 0.3);
    }
  };
})();

/* ==================================================================
 * 7-d. 마지막 — 중심선에서 하나씩 뻗어 나가는 가능성들
 *
 * 사방으로 쏘아 보내는 게 아니라, 시간선이 원래 잔가지를 내던 그 방식 그대로다.
 * 뿌리는 선을 따라 붙어 나가다 부드럽게 휘어 나가고(buildGhosts 와 같은 곡선),
 * 갈래는 앞쪽으로 한 줄기씩 차례로 돋는다. 굵은 가지에서 다시 잔가지가 갈라진다.
 * 평소엔 아주 옅게 깔려 있다가, 재생이 끝에 닿으면 순서대로 자라나며 타오른다.
 * ================================================================== */

const futureFan = (() => {
  const grp = new THREE.Group();
  const arms = [];

  const X0 = PLAY_TO - 60;                  // 오늘 — 여기서부터 아직 오지 않은 시간
  const X1 = TIME.xTailEnd - 40;            // 시간선 끝
  const N = 20;

  /** buildGhosts 와 똑같은 분기 곡선 — 선을 따라 붙어 나가다 휘어 나간다 */
  const branchCurve = (base, t, dir, L) => {
    const c = new THREE.CatmullRomCurve3([
      base.clone(),
      base.clone().addScaledVector(t, L * 0.4).addScaledVector(dir, L * 0.07),
      base.clone().addScaledVector(t, L * 0.6).addScaledVector(dir, L * 0.5),
      base.clone().addScaledVector(t, L * 0.68).addScaledVector(dir, L * 0.95),
    ], false, 'centripetal', 0.5);
    c.arcLengthDivisions = 300;
    return c;
  };

  const addArm = (curve, r0, delay, grow, gain) => {
    const mats = [];
    const mk = (glow, core, intensity, rf, rad) => {
      const m = filamentMaterial({
        glow, core, intensity: intensity * gain, speed: 0.22 + rng() * 0.2, flowScale: 1.5,
        headFade: 0.06, tailFade: 0.03, rimPower: 1.9, grain: 0.4,
        sat: [1, 1, 1], satU: [-1, -1],
      });
      grp.add(new THREE.Mesh(taperedTube(curve, rf, 96, rad), m));
      mats.push(m);
    };
    mk(0xff7a1a, 0xffc888, 0.14, (u) => lerp(r0 * 2.6, r0 * 0.5, Math.pow(u, 0.7)), 8);
    mk(0xffa22a, 0xfff0d2, 0.62, (u) => lerp(r0, 0.1, Math.pow(u, 0.75)), 10);

    const seed = makeHalo(0xffd8a0, r0 * 7, 0.5);
    seed.position.copy(curve.getPointAt(1));
    grp.add(seed);

    arms.push({ mats, seed, delay, grow });
    return curve;
  };

  for (let i = 0; i < N; i++) {
    // 앞으로 갈수록 촘촘해진다 — 끝에 다다를수록 가능성이 잦아진다
    const f = Math.pow(i / (N - 1), 0.78);
    const x = lerp(X0, X1, f);
    const { point: base, tangent } = pointAtX(NEXUS_LINE, x);
    const t = tangent.clone().normalize();
    const wu = new THREE.Vector3(0, 1, 0).addScaledVector(t, -t.y).normalize();
    const ws = new THREE.Vector3().crossVectors(t, wu).normalize();

    // 위아래·앞뒤 고르게. 같은 자리에서 두 갈래가 반대로 갈리기도 한다.
    const a = (i * 2.399963) + rng() * 0.6;
    const dir = wu.clone().multiplyScalar(Math.cos(a)).addScaledVector(ws, Math.sin(a)).normalize();
    const L = 320 + Math.pow(rng(), 0.75) * 640;
    const r0 = 1.5 + rng() * 1.5;
    const delay = i * 0.135 + rng() * 0.05;
    const curve = addArm(branchCurve(base, t, dir, L), r0, delay, 1.1 + rng() * 0.7, 1);

    // 굵은 가지에서 다시 갈라져 나오는 잔가지
    const sub = 1 + (rng() < 0.55 ? 1 : 0);
    for (let k = 0; k < sub; k++) {
      const u = 0.34 + rng() * 0.34;
      const sBase = curve.getPointAt(u);
      const sT = curve.getTangentAt(u).normalize();
      const sU = new THREE.Vector3(0, 1, 0).addScaledVector(sT, -sT.y).normalize();
      const sS = new THREE.Vector3().crossVectors(sT, sU).normalize();
      const sa = rng() * Math.PI * 2;
      const sDir = sU.clone().multiplyScalar(Math.cos(sa)).addScaledVector(sS, Math.sin(sa)).normalize();
      const sL = L * (0.3 + rng() * 0.3);
      addArm(branchCurve(sBase, sT, sDir, sL), r0 * 0.42, delay + 0.42 + rng() * 0.24, 0.8 + rng() * 0.5, 0.85);
    }
  }

  scene.add(grp);
  // 재생 중에는 끝에 닿기 전까지 아예 없는 것으로 둔다.
  // 미리 깔려 있으면 "아직 오지 않은 것"이 아니라 그냥 배경이 돼 버린다.
  // (재생이 아닐 때는 다른 요소들처럼 평소대로 옅게 보인다)
  revealAt(Infinity, grp);

  const LAST = N * 0.135 + 0.66 + 1.3;   // 마지막 잔가지까지 다 자라는 시각
  const st = { t: 99, homed: true };
  const fire = () => { st.t = 0; st.homed = false; grp.visible = true; };

  const update = (dt, time) => {
    const firing = st.t < 99;
    if (firing) st.t += dt;
    for (const a of arms) {
      for (const m of a.mats) m.uniforms.uTime.value = time;
      if (!firing) {
        // 평소엔 옅게 깔려 있다
        for (const m of a.mats) { m.uniforms.uReveal.value = 2; m.uniforms.uFlicker.value = 0.28; }
        a.seed.material.opacity = 0.14;
        continue;
      }
      const since = st.t - a.delay;
      const k = clamp(since / a.grow, 0, 1);
      const e = easeOutQuint(k);
      // 제 차례가 오기 전에는 아직 없는 갈래다 — 밝기도 같이 기다린다
      const flare = since < 0 ? 0 : Math.max(0, 1 - Math.max(0, since - a.grow) / 3.4);
      for (const m of a.mats) {
        m.uniforms.uReveal.value = k >= 1 ? 2 : e;
        // 돋아나는 동안 확 타올랐다가 서서히 가라앉는다
        m.uniforms.uFlicker.value = 0.28 + flare * 2.4;
      }
      a.seed.material.opacity = 0.14 + Math.sin(clamp(k, 0, 1) * Math.PI) * 0.5;
    }
    // 다 뻗고 나면 부드럽게 전체 보기로
    if (firing && !st.homed && st.t > LAST + 0.5) {
      st.homed = true;
      flyTo(HOME_POS, HOME_TGT, 4.2);
    }
    if (firing && st.t > LAST + 6.5) st.t = 99;
  };

  return { fire, update, arms, st, grp };
})();

/* ==================================================================
 * 8. 선택 시 퍼지는 충격파
 * ================================================================== */

/**
 * 선택 시 퍼지는 파문 — 링을 여러 겹 쌓으면 금방 요란해져서,
 * 아주 얇은 링 하나와 뒤에 번지는 발광 하나로만 만든다.
 */
const shockRing = new THREE.Mesh(
  SHOCK_GEO,
  new THREE.MeshBasicMaterial({ color: 0xffb257, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
);
shockRing.frustumCulled = false;
shockRing.visible = false;
scene.add(shockRing);

const shockGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffb257, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
);
shockGlow.visible = false;
scene.add(shockGlow);

const shock = { t: 2 };
function fireShock(pos, color) {
  shockRing.position.copy(pos);
  shockRing.material.color.set(color);
  shockRing.visible = true;
  shockGlow.position.copy(pos);
  shockGlow.material.color.set(color);
  shockGlow.visible = true;
  shock.t = 0;
}

/* ==================================================================
 * 9. 인터랙션
 * ================================================================== */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-2, -2);
let hovered = -1;
let selected = -1;

const panel = document.getElementById('panel');
const els = {
  kind: document.getElementById('p-kind'),
  date: document.getElementById('p-date'),
  title: document.getElementById('p-title'),
  meta: document.getElementById('p-meta'),
  desc: document.getElementById('p-desc'),
  index: document.getElementById('p-index'),
  videos: document.getElementById('p-videos'),
};

/* --- 유튜브 플레이어 ------------------------------------------------ */

const playerEl = document.getElementById('player');
const playerFrame = document.getElementById('player-frame');
const playerTitle = document.getElementById('player-title');
const playerLink = document.getElementById('player-link');

/** 영상 창이 열려 있는가 — 열려 있으면 재생은 그 자리에 멈춰 선다 */
function watchingVideo() {
  return playerEl.classList.contains('is-open');
}

function openPlayer(v) {
  bgmDuck(true);   // 영상 보는 동안 배경음은 잠시 물러난다
  // 재생 중이었다면 소개 카드를 접는 타이머도 같이 멈춰 세운다.
  // 벽시계로 도는 타이머라 그냥 두면 영상 보는 사이에 카드가 사라진다.
  if (play.active) clearTimeout(cueTimer);
  playerFrame.innerHTML = '';
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1`;
  f.title = v.t;
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.allowFullscreen = true;
  playerFrame.appendChild(f);
  playerFrame.classList.toggle('is-shorts', !!v.s);
  playerTitle.textContent = v.t;
  playerLink.href = `https://www.youtube.com/watch?v=${v.id}`;
  playerEl.classList.add('is-open');
  playerEl.setAttribute('aria-hidden', 'false');
}
function closePlayer() {
  bgmDuck(false);
  // 남은 소개 시간만큼 타이머를 다시 건다
  if (play.active && play.hold > 0) {
    clearTimeout(cueTimer);
    cueTimer = setTimeout(hideCue, Math.max(200, play.hold * 1000 - 420));
  }
  playerFrame.innerHTML = '';
  playerEl.classList.remove('is-open');
  playerEl.setAttribute('aria-hidden', 'true');
}
document.getElementById('player-close').addEventListener('click', closePlayer);
playerEl.addEventListener('click', (e) => { if (e.target === playerEl) closePlayer(); });

/** 타이틀곡 MV 재생 */
function openMv(i) {
  const mv = MVS[i];
  openPlayer({ id: mv.id, t: `RESCENE 「${mv.song}」 Official MV — ${mv.album}` });
}

/* --- MV 갤러리 ------------------------------------------------------ */

const galEl = document.getElementById('mvgal');
{
  const list = document.getElementById('mvgal-list');
  MVS.forEach((mv, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mvg-item${mv.major ? ' is-major' : ''}${mv.completedBy ? ' is-cut' : ''}`;
    btn.innerHTML = `
      <span class="mvg-thumb"><img src="https://i.ytimg.com/vi/${mv.id}/mqdefault.jpg" alt="" loading="lazy"><em>▶</em></span>
      <span class="mvg-text"><b></b><i></i><u></u>${mv.note ? '<s></s>' : ''}</span>`;
    btn.querySelector('b').textContent = mv.song;
    btn.querySelector('i').textContent = mv.album;
    btn.querySelector('u').textContent =
      `${formatDate(mv.date)} · ${formatViews(mv.views)}${mv.run ? ` · ${mv.run}` : ''}`;
    if (mv.note) btn.querySelector('s').textContent = mv.note;
    btn.addEventListener('click', () => { closeGallery(); openMv(i); });
    list.appendChild(btn);
  });
  document.getElementById('mvgal-close').addEventListener('click', () => closeGallery());
  galEl.addEventListener('click', (e) => { if (e.target === galEl) closeGallery(); });
}
function openGallery() {
  if (typeof memEl !== 'undefined' && memEl) closeMembers();
  galEl.classList.add('is-open');
  galEl.setAttribute('aria-hidden', 'false');
}
function closeGallery() {
  galEl.classList.remove('is-open');
  galEl.setAttribute('aria-hidden', 'true');
}
document.getElementById('btn-mv').addEventListener('click', () => {
  galEl.classList.contains('is-open') ? closeGallery() : openGallery();
});

/* --- 멤버 소개 ------------------------------------------------------
 * 사진 · 본명 · 출신 · 별명(어디서 나왔는지) · 콘텐츠에 함께 나오는 가족.
 * 별명은 대부분 방송 중에 즉석에서 붙은 것이라, 유래가 곧 이 팀의 서사다.
 * ------------------------------------------------------------------ */

const memEl = document.getElementById('memgal');
if (memEl) {
  const list = document.getElementById('memgal-list');
  MEMBERS.forEach((mem) => {
    const card = document.createElement('div');
    card.className = `mem-card mem-${mem.key}`;
    const p = MEMBER_PHOTO[mem.key] || {};
    const born = mem.born ? `${formatDate(mem.born)} 생` : '';
    card.innerHTML = `
      <div class="mem-head">
        <span class="mem-photo mp-slot" data-ini="${mem.name.slice(0, 1)}">${photoImg(p)}</span>
        <div class="mem-id">
          <b class="mem-name"></b>
          <span class="mem-real"></span>
          <span class="mem-meta"></span>
        </div>
      </div>
      <div class="mem-sec mem-nick"><h3>별명</h3><ul></ul></div>
      <div class="mem-sec mem-fam"><h3>가족</h3><ul></ul></div>`;
    card.querySelector('.mem-name').textContent = mem.name;
    card.querySelector('.mem-real').textContent =
      `본명 ${mem.real}${mem.hanja ? ` (${mem.hanja})` : ''}`;
    card.querySelector('.mem-meta').textContent =
      [born, mem.from, mem.role].filter(Boolean).join(' · ');

    const nl = card.querySelector('.mem-nick ul');
    for (const n of mem.nick) {
      const li = document.createElement('li');
      li.innerHTML = '<b></b><span></span>';
      li.querySelector('b').textContent = n.n;
      li.querySelector('span').textContent = n.why || '';
      if (!n.why) li.classList.add('is-bare');
      nl.appendChild(li);
    }

    const fam = card.querySelector('.mem-fam');
    if (!mem.family.length) fam.remove();
    else {
      const fl = fam.querySelector('ul');
      for (const f of mem.family) {
        const li = document.createElement('li');
        li.innerHTML = '<b></b><span></span>';
        li.querySelector('b').textContent = f.name ? `${f.rel} ${f.name}` : f.rel;
        li.querySelector('span').textContent = f.note || '';
        fl.appendChild(li);
      }
    }
    list.appendChild(card);
  });
  document.getElementById('memgal-close').addEventListener('click', () => closeMembers());
  memEl.addEventListener('click', (e) => { if (e.target === memEl) closeMembers(); });
}
function openMembers() {
  closeGallery();
  memEl.classList.add('is-open');
  memEl.setAttribute('aria-hidden', 'false');
}
function closeMembers() {
  memEl.classList.remove('is-open');
  memEl.setAttribute('aria-hidden', 'true');
}
/* --- 조작 안내 접기 ---------------------------------------------- */

// 한 번 읽으면 계속 띄워 둘 이유가 없다. 기본은 접고 C 로 여닫는다.
function toggleHelp(on) {
  const want = on === undefined ? !document.body.classList.contains('show-help') : on;
  document.body.classList.toggle('show-help', want);
}
function toggleLegend(on) {
  const want = on === undefined ? !document.body.classList.contains('show-legend') : on;
  document.body.classList.toggle('show-legend', want);
}
{
  const hint = document.getElementById('help-hint');
  if (hint) hint.addEventListener('click', (e) => { e.stopPropagation(); toggleHelp(true); });
  const help = document.querySelector('.hud-help');
  // 열려 있을 때 안내를 누르면 다시 접힌다
  if (help) help.addEventListener('click', (e) => { e.stopPropagation(); toggleHelp(false); });

  const lHint = document.getElementById('legend-hint');
  if (lHint) lHint.addEventListener('click', (e) => { e.stopPropagation(); toggleLegend(true); });
  const legend = document.querySelector('.hud-legend');
  if (legend) legend.addEventListener('click', (e) => { e.stopPropagation(); toggleLegend(false); });
}

const memBtn = document.getElementById('btn-members');
if (memBtn) memBtn.addEventListener('click', () => {
  memEl.classList.contains('is-open') ? closeMembers() : openMembers();
});

function renderVideos(ev) {
  els.videos.innerHTML = '';
  if (!ev.videos || !ev.videos.length) {
    els.videos.hidden = true;
    return;
  }
  els.videos.hidden = false;

  const h = document.createElement('span');
  h.className = 'pv-title';
  h.textContent = `관련 영상 ${ev.videos.length}`;
  els.videos.appendChild(h);

  const ul = document.createElement('ul');
  ev.videos.forEach((v, i) => {
    const li = document.createElement('li');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pv-item${v.hi ? ' is-hi' : ''}`;
    btn.innerHTML = `
      <span class="pv-n">${v.hi ? '★' : String(i + 1).padStart(2, '0')}</span>
      <span class="pv-thumb"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"><em>▶</em></span>
      <span class="pv-text"><b></b><i></i></span>`;
    btn.querySelector('b').textContent = v.t;
    btn.querySelector('i').textContent = v.c || '';
    btn.addEventListener('click', () => openPlayer(v));

    const a = document.createElement('a');
    a.className = 'pv-ext';
    a.href = `https://www.youtube.com/watch?v=${v.id}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = '유튜브에서 열기';
    a.textContent = '↗';

    li.append(btn, a);
    ul.appendChild(li);
  });
  els.videos.appendChild(ul);
}

/* --- 하단 연도 스크러버 -------------------------------------------- */

let scrubHover = -1;
const scrubDots = [];
{
  const eraBar = document.getElementById('scrub-months');
  const track = document.getElementById('scrub-track');
  const X0 = PAST.x0;
  const XS = TIME.xMax - X0;
  const pctX = (x) => ((x - X0) / XS) * 100;

  for (const era of [PAST, ...ERAS]) {
    const seg = document.createElement('span');
    seg.className = `scrub-era era-${era.id}`;
    seg.style.left = `${pctX(era.x0)}%`;
    seg.style.width = `${pctX(era.x1) - pctX(era.x0)}%`;
    seg.innerHTML = `<b>${era.label}</b><i>${era.caption}</i>`;
    eraBar.appendChild(seg);
    if (era.x0 > X0) {
      const d = document.createElement('span');
      d.className = 'scrub-div';
      d.style.left = `${pctX(era.x0)}%`;
      track.appendChild(d);
    }
  }

  // 기간 밴드도 스크러버에 표시
  for (const p of PERIODS) {
    const b = document.createElement('span');
    b.className = `scrub-period period-${p.id}`;
    b.style.left = `${pctX(dateToX(p.from))}%`;
    b.style.width = `${pctX(dateToX(p.to)) - pctX(dateToX(p.from))}%`;
    b.title = `${p.label} — ${p.caption}`;
    b.innerHTML = `<i>PHASE ${String(PERIODS.indexOf(p) + 1).padStart(2, '0')} · ${p.label.replace(/\s*구간$/, '')}</i>`;
    track.appendChild(b);
  }

  for (const b of branches) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = `scrub-dot kind-${b.ev.kind}${b.ev.major ? ' is-major' : ''}${b.ev.nexus ? ' is-nexus' : ''}`;
    d.style.left = `${pctX(dateToX(b.ev.date))}%`;
    d.title = `${formatDate(b.ev.date)} · ${b.ev.title}`;
    d.setAttribute('aria-label', d.title);
    d.addEventListener('click', () => selectEvent(b.index, true));
    d.addEventListener('pointerenter', () => (scrubHover = b.index));
    d.addEventListener('pointerleave', () => (scrubHover = -1));
    track.appendChild(d);
    scrubDots.push(d);
  }
}

/* --- 카메라 --------------------------------------------------------- */

const drift = new THREE.Vector3();
const camUp = new THREE.Vector3();
const mvEnd = new THREE.Vector3();
const playTgt = new THREE.Vector3();
const playPos = new THREE.Vector3();
/**
 * 재생 중 카메라는 목표에서 늘 이 자리에 선다. 거리가 고정이므로 화면에 담기는
 * 폭도 계산으로 나온다 — 「얼마나 앞서 볼지」를 world 단위가 아니라 화면 비율로
 * 잡을 수 있다. 가로 화면에서 알맞던 150 이 세로로 긴 손전화에서는 화면 절반을
 * 넘어서, 진행선이 오른쪽으로 밀려났다 돌아오는 것처럼 보였다.
 */
const PLAY_OFF = new THREE.Vector3(-120, 235, 940);
const PLAY_DIST = PLAY_OFF.length();

/* ==================================================================
 * 재생 연출 — 데뷔 지점에서 출발해 시간선이 자라나며 사건이 하나씩 켜진다.
 * ================================================================== */

const play = {
  active: false,
  front: 0,        // 지금까지 그려진 시간축 좌표
  speed: 1,        // 1× / 3× 토글
  dur: 28,         // 완급을 뺀 기준 이동 시간(초). 실제로는 완급 때문에 두 배쯤 걸린다
  hold: 0,         // 사건 안내로 멈춰 있는 남은 시간
  holdMax: 1,      // 이번 안내의 전체 길이
  next: 0,         // 다음에 안내할 사건
  lastCueX: 0,     // 직전 사건 좌표 (완급 폭 계산용)
  pendingCue: null, // 빅뱅이 끝난 뒤 띄울 소개
  focus: -1,       // 지금 비추고 있는 분기 사건
  focusMv: -1,     // 지금 비추고 있는 MV
};
const HOLD_SEC = 7;          // 사건 하나를 보여주는 시간 (영상까지 훑을 여유를 준다)
const FADE_SPAN = 110;       // 진행선이 지난 뒤 이 거리만큼에 걸쳐 서서히 나타난다


/** 진행선 x → 그 날짜 (역매핑) */
function xToParts(x) {
  const spans = [
    [PAST.x0, PAST.x1, Date.parse(PAST.from + 'T00:00:00Z'), TIME.start, PAST],
    ...ERAS.map((e) => [e.x0, e.x1, Date.parse(e.from + 'T00:00:00Z'), Date.parse(e.to + 'T00:00:00Z'), e]),
  ];
  for (const [x0, x1, t0, t1, era] of spans) {
    if (x <= x1 || x1 === TIME.xMax) {
      const k = clamp((x - x0) / (x1 - x0), 0, 1);
      const d = new Date(lerp(t0, t1, k));
      return {
        y: String(d.getUTCFullYear()),
        m: String(d.getUTCMonth() + 1).padStart(2, '0'),
        d: String(d.getUTCDate()).padStart(2, '0'),
        era,
      };
    }
  }
  return { y: '', m: '', d: '', era: ERAS[0] };
}
const xToDate = (x) => { const p = xToParts(x); return `${p.y}. ${p.m}. ${p.d}`; };

const playBtn = document.getElementById('btn-play');
const playHud = document.getElementById('play-hud');
const playDate = document.getElementById('play-date');
const playBar = document.getElementById('play-bar');
const playSpeedBtn = document.getElementById('play-speed');
/* --- 재생 중 배경음 -------------------------------------------------
 * 재생은 반드시 사용자 클릭에서 시작되므로 자동재생 정책에 걸리지 않는다.
 * 파일이 없거나 브라우저가 막으면 조용히 넘어간다 — 연출은 그대로 돈다.
 * ------------------------------------------------------------------ */
let bgmFade = 0;          // 0..1 목표를 향해 움직이는 현재 페이드
let bgmTarget = 0;
let bgmMuted = false;
let bgmDucked = false;
let bgmDuckK = 1;        // 1 = 그대로, 0 = 완전히 재움

/**
 * 배경음은 mp3 가 아니라 **공식 MV 를 그대로 튼다** (권리 문제를 피하는 유일하게 깔끔한 길).
 * 대신 유튜브 약관이 요구하는 대로 플레이어를 숨기지 않고 우상단에 작은 모니터로 띄운다.
 *
 * 나머지 코드는 `bgm.volume` · `bgm.paused` 만 보고 돌아가므로, 그 모양을 그대로 흉내 내는
 * 껍데기를 두고 실제 호출만 유튜브 쪽으로 넘긴다. 페이드·더킹 로직은 한 줄도 안 바뀐다.
 * (API 가 안 뜨는 환경에서도 껍데기만으로 조용히 돈다)
 */
const bgmView = document.getElementById('bgm-player');
const bgmSong = bgmView && bgmView.querySelector('.bgmp-meta b');
const bgmAlbum = bgmView && bgmView.querySelector('.bgmp-meta em');
const bgmStage = document.getElementById('bgm-stage');
const bgmFrame = document.getElementById('bgm-frame');
const bgmSlot = document.getElementById('bgm-slot');
let ytPlayer = null;
let ytReady = false;

/**
 * 깔리는 곡은 고정이 아니라 **진행선이 마지막으로 지나온 MV** 다.
 * 2024년을 지날 땐 「UhUh」가, 거제 야호를 지나면 「Runaway」가 흐른다.
 * 시간선을 따라 그 시절 소리가 같이 흐르는 셈이다.
 * 갈아 끼울 땐 볼륨을 한 번 접었다 편다 — 뚝 바뀌면 사고처럼 들린다.
 */
const MV_BY_X = MVS.map((mv, i) => ({ i, mv, x: dateToX(mv.date) })).sort((a, b) => a.x - b.x);
/** 기준곡 — 재생을 여는 곡이자 「한 곡」 모드에서 도는 곡 (data.js 의 BGM) */
const BGM_HOME = MV_BY_X.find((t) => t.mv.id === BGM.id) || MV_BY_X[0];
let bgmTrack = -1;        // 지금 깔린 MV
let bgmPending = -1;      // 접히고 나면 갈아 끼울 MV
let bgmSwapK = 1;

/**
 * 그 지점에서 마지막으로 지나온 MV.
 * 다만 **기준곡 자리에 닿기 전까지는 기준곡을 깐다.** 그냥 지나온 순서대로 깔면
 * 재생을 켜자마자 예산이 모자라 반쪽으로 끊긴 선공개 MV(「YoYo」)가 흐른다 —
 * 이 팀을 대표하는 곡으로 여는 편이 맞고, 기준곡은 어차피 제 날짜에 서 있으므로
 * 뒤로 돌아가는 어색한 전환도 생기지 않는다.
 */
function mvAt(x) {
  let k = 0;
  for (let i = 0; i < MV_BY_X.length; i++) { if (MV_BY_X[i].x <= x) k = i; else break; }
  const t = MV_BY_X[k];
  return t.x < BGM_HOME.x ? BGM_HOME : t;
}
function bgmWant(x) {
  if (bgmOne) return;                     // 한 곡 고정 — 아무 것도 갈아 끼우지 않는다
  const t = mvAt(x);
  if (!t || t.i === bgmTrack || t.i === bgmPending) return;
  bgmPending = t.i;
}

/* --- 한 곡 고정 -----------------------------------------------------
 * 유튜브 광고(프리롤)는 **새 재생을 시작할 때** 붙는다. 되감기에는 안 붙는다.
 * 그런데 시간선을 따라가는 방식은 재생 한 번에 곡을 열 번 갈아 끼우므로
 * 프리롤이 붙을 기회도 열 번이다. 「LOVE ATTACK」 한 곡으로 고정하면
 * 처음 한 번으로 준다 — 광고를 없애는 게 아니라 횟수를 줄이는 것이다.
 * (광고를 끄는 건 유튜브와 채널 사이의 문제라 이쪽에서 손댈 수 없다)
 * ------------------------------------------------------------------ */
const BGM_ONE_I = BGM_HOME.i;
const BGM_ONE_KEY = 'rescene.bgm.mode';
const bgmModeEl = document.getElementById('bgm-mode');
// 기본은 한 곡 고정이다 — 곡을 갈아 끼울 때마다 프리롤이 붙는 데다,
// 배경음으로 깔리는 소리가 도중에 바뀌면 그때마다 시선이 그쪽으로 끌린다.
let bgmOne = true;

function setBgmOne(on, opts = {}) {
  bgmOne = !!on;
  if (bgmModeEl) {
    bgmModeEl.textContent = bgmOne ? '한 곡' : '시간선';
    bgmModeEl.classList.toggle('is-one', bgmOne);
    bgmModeEl.setAttribute('aria-pressed', bgmOne ? 'true' : 'false');
    bgmModeEl.title = bgmOne
      ? `「${MVS[BGM_ONE_I].song}」 한 곡만 돈다 — 곡을 안 바꾸니 유튜브 프리롤이 처음 한 번으로 준다. 누르면 시간선 따라가기.`
      : '진행선이 마지막으로 지나온 MV 가 깔린다 — 곡이 바뀔 때마다 프리롤이 붙을 수 있다. 누르면 한 곡 고정.';
  }
  if (opts.save !== false) { try { localStorage.setItem(BGM_ONE_KEY, bgmOne ? 'one' : 'line'); } catch {} }
  if (opts.sync === false) return;
  // 켜면 그 곡으로 한 번만 갈아 끼우고 그 뒤로는 가만히 둔다. 끄면 지금 자리의 곡으로 돌아간다.
  // 아직 시작 전(bgmTrack < 0)이면 bgmStart 가 알아서 그 곡으로 연다 — 여기서 예약할 필요가 없다.
  if (bgmOne) bgmPending = bgmTrack < 0 || bgmTrack === BGM_ONE_I ? -1 : BGM_ONE_I;
  else bgmWant(play.active ? play.front : PLAY_FROM);
}
if (bgmModeEl) {
  bgmModeEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  bgmModeEl.addEventListener('click', (e) => { e.stopPropagation(); setBgmOne(!bgmOne); });
}
{
  // ?bgm=one / ?bgm=line 이 저장된 설정보다 우선하고, 둘 다 없으면 기본값(한 곡)
  const q = new URLSearchParams(location.search).get('bgm');
  let init = bgmOne;
  if (q === 'one' || q === 'line') init = q === 'one';
  else { try { const v = localStorage.getItem(BGM_ONE_KEY); if (v) init = v === 'one'; } catch {} }
  setBgmOne(init, { save: false, sync: false });
}
function bgmApplyTrack(i) {
  bgmTrack = i;
  const mv = MVS[i];
  bgm.src = `https://www.youtube.com/watch?v=${mv.id}`;
  if (bgmSong) bgmSong.textContent = mv.song;
  if (bgmAlbum) bgmAlbum.textContent = mv.album;
  if (bgmPending === i) bgmPending = -1;   // 이미 그 곡이면 다시 갈아 끼우지 않는다
  if (ytReady && ytPlayer) {
    try { bgm.paused ? ytPlayer.cueVideoById(mv.id) : ytPlayer.loadVideoById(mv.id); } catch {}
  }
}

const bgm = {
  src: `https://www.youtube.com/watch?v=${BGM.id}`,
  loop: true,
  volume: 0,
  paused: true,
  plays: 0,
  play() {
    this.paused = false;
    this.plays++;
    if (ytReady && ytPlayer) { try { ytPlayer.playVideo(); } catch {} }
    return Promise.resolve();
  },
  pause() {
    this.paused = true;
    if (ytReady && ytPlayer) { try { ytPlayer.pauseVideo(); } catch {} }
  },
};

/** 재생을 켜는 순간(= 사용자 제스처)에 만든다. 그래야 소리까지 자동재생이 된다. */
function bgmMount() {
  if (ytPlayer || !bgmView) return;
  // 유튜브 API 는 이 칸을 iframe 으로 통째로 갈아 끼운다 — 그래서 자리를 잡아 주는
  // 바깥 칸(#bgm-frame)이 아니라 안쪽의 갈려 나갈 칸을 넘긴다.
  const host = document.getElementById('bgm-yt');
  if (!host) return;
  const make = () => {
    const YT = window.YT;
    if (!YT || !YT.Player) return;
    ytPlayer = new YT.Player(host, {
      videoId: MVS[bgmTrack >= 0 ? bgmTrack : MV_BY_X[0].i].id,
      playerVars: {
        autoplay: 1, controls: 0, rel: 0, modestbranding: 1,
        playsinline: 1, loop: 1,
      },
      events: {
        onReady: (e) => {
          ytReady = true;
          try {
            e.target.setVolume(Math.round(bgm.volume * 100));
            if (!bgm.paused) e.target.playVideo();
          } catch {}
        },
        // loop=1 이 단일 영상에서는 가끔 안 먹는다. 끝나면 직접 되감는다.
        onStateChange: (e) => { if (e.data === 0) { try { e.target.seekTo(0); e.target.playVideo(); } catch {} } },
        onError: () => { ytReady = false; },
      },
    });
  };
  if (window.YT && window.YT.Player) { make(); return; }
  window.onYouTubeIframeAPIReady = make;
  if (!document.getElementById('yt-api')) {
    const tag = document.createElement('script');
    tag.id = 'yt-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
}

/* --- 화면이 앉는 자리 ------------------------------------------------
 * 화면(#bgm-frame)은 DOM 에서 절대 안 움직인다 — iframe 을 옮겨 붙이면 유튜브가
 * 처음부터 다시 물어서 소리가 끊기고 광고가 또 붙는다.
 * 대신 「모니터 자리」와 「우주 자리」를 재서 좌표만 넘겨 주고, 그 사이는
 * CSS transition 이 미끄러진다. 소리는 한 박자도 안 끊기고 화면만 내려앉는다.
 * ------------------------------------------------------------------ */
let bgmSpace = false;

/** 지금 화면이 앉아야 할 사각형 */
function bgmStageRect() {
  const W = Math.max(1, window.innerWidth);
  const H = Math.max(1, window.innerHeight);
  if (!bgmSpace) {
    // 카드 안에 비워 둔 자리를 그대로 덮는다
    const r = bgmSlot && bgmSlot.getBoundingClientRect ? bgmSlot.getBoundingClientRect() : null;
    if (r && r.width > 1 && r.height > 1) return { x: r.left, y: r.top, w: r.width, h: r.height };
    return { x: W - 268, y: 160, w: 242, h: 200 };
  }
  // 우주 — 화면을 남김없이 덮는다 (cover). 16:9 는 그대로 지키고 넘치는 쪽만 잘라 낸다 —
  // 찌그러뜨리면 사람 얼굴에서 먼저 티가 나기 때문. 세로로 긴 손전화에서는 좌우가 크게
  // 잘리는데, MV 는 가운데에 사람이 서므로 배경으로는 그 편이 낫다.
  const w = Math.max(W, H * (16 / 9));
  const h = Math.max(H, W * (9 / 16));
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function bgmLayout() {
  if (!bgmFrame || !bgmFrame.style) return;
  const r = bgmStageRect();
  bgmFrame.style.left = `${Math.round(r.x)}px`;
  bgmFrame.style.top = `${Math.round(r.y)}px`;
  bgmFrame.style.width = `${Math.round(r.w)}px`;
  bgmFrame.style.height = `${Math.round(r.h)}px`;
}
/** 우주로 내려앉히기 / 모니터로 되돌리기 */
function setBgmStage(on) {
  const want = !!on;
  if (bgmSpace === want) return;
  bgmSpace = want;
  if (bgmStage) bgmStage.classList.toggle('is-space', bgmSpace);
  if (bgmView) bgmView.classList.toggle('is-space', bgmSpace);
  // 카드 쪽 자리(빈 칸·카드 폭)는 전환 없이 바로 접힌다 — 그래야 여기서 잰 값이 최종값이다
  bgmLayout();
}

/* --- 광고가 지나갔는가 -----------------------------------------------
 * 유튜브 IFrame API 는 「지금 광고 중」을 알려주지 않는다. 공식 신호가 없다.
 * 다만 광고가 도는 동안 getDuration() 은 **광고 길이**를 돌려주고, 광고가 끝나
 * 곡이 시작돼야 그제서야 곡 길이로 바뀐다. 이 저장소의 MV 중 가장 짧은 게
 * 「YoYo」 1:47(107초)이고 프리롤은 보통 15~30초라, 75초를 경계로 두면 안 겹친다.
 * ------------------------------------------------------------------ */
const AD_MIN_RUN = 75;
let ytPoll = 0;          // 다음에 물어볼 때까지 남은 시간
let ytMiss = 0;          // 곡이 아니라고 나온 횟수 (연달아 몇 번인지)
/** 지금 유튜브에서 흐르는 것 — 'ad' 광고 · 'play' 곡 · 'pause' 멈춤 · 'none' 아직/모름 */
function ytState() {
  if (!ytReady || !ytPlayer) return 'none';
  try {
    const s = typeof ytPlayer.getPlayerState === 'function' ? ytPlayer.getPlayerState() : -1;
    const d = typeof ytPlayer.getDuration === 'function' ? ytPlayer.getDuration() : 0;
    if (d > 0 && d < AD_MIN_RUN) return 'ad';
    if (s === 2) return 'pause';
    if (s === 1 || s === 3) return 'play';   // 3 = 버퍼링 — 잠깐 끊긴 것이지 멈춘 게 아니다
    return 'none';
  } catch { return 'none'; }
}
/** 광고가 끝나고 곡이 실제로 시작됐는가 */
const ytContentLive = () => ytState() === 'play';

/** 소리가 멈춰 있는 동안에는 배경 화면을 다시 또렷하게 — 보라고 깔아 둔 화면이니까 */
let bgmHeld = false;
function setBgmHeld(on) {
  const want = !!on;
  if (bgmHeld === want) return;
  bgmHeld = want;
  if (bgmStage) bgmStage.classList.toggle('is-held', bgmHeld);
}

function bgmStart() {
  // 시작 곡은 진행선이 서 있는 자리의 곡 — 한 곡 고정이면 그 한 곡이다
  if (bgmTrack < 0) bgmApplyTrack(bgmOne ? BGM_ONE_I : mvAt(play.active ? play.front : PLAY_FROM).i);
  bgmMount();
  bgmTarget = 1;
  if (bgmView) { bgmView.classList.add('is-on'); bgmView.setAttribute('aria-hidden', 'false'); }
  if (bgmStage) { bgmStage.classList.add('is-on'); bgmStage.setAttribute('aria-hidden', 'false'); }
  bgmLayout();
  const p = bgm.play();
  if (p && p.catch) p.catch(() => {});
}
function bgmStop() {
  bgmTarget = 0;
  setBgmStage(false);
  setBgmHeld(false);
  if (bgmView) { bgmView.classList.remove('is-on'); bgmView.setAttribute('aria-hidden', 'true'); }
  if (bgmStage) { bgmStage.classList.remove('is-on'); bgmStage.setAttribute('aria-hidden', 'true'); }
}
/**
 * 영상을 보는 동안 배경음을 잠시 재운다 (재생 연출 자체는 그 자리에 멈춘다).
 * 뚝 끊으면 눌린 듯이 들려서, 재생을 켜고 끌 때처럼 **접어 넣었다 펴 준다**.
 * 다만 시작·종료 페이드(1.4초)보다는 짧게 — 멈춤은 바로 반응해야 멈춘 것 같다.
 */
// 소리는 선형으로 오르내리면 끝에서 툭 끊긴 듯 들린다.
// 완급 곡선을 한 번 태우고, 사람이 크기를 느끼는 방식(제곱에 가깝다)에 맞춰 한 번 더 눌러 준다.
const audioEase = (k) => {
  const s = clamp(k, 0, 1);
  return Math.pow(s * s * (3 - 2 * s), 1.4);
};
// 내릴 땐 빠르게, 올릴 땐 느긋하게 — 그래야 끊기지 않고 스며든다
const rampTo = (cur, target, upSec, downSec, dt) =>
  (target > cur ? Math.min(target, cur + dt / upSec) : Math.max(target, cur - dt / downSec));

const BGM_DUCK_UP = 0.8;
const BGM_DUCK_DOWN = 0.45;
const BGM_SWAP_DOWN = 0.75;
const BGM_SWAP_UP = 1.25;
function bgmDuck(on) {
  bgmDucked = on;
  // 되살아날 때는 소리를 먼저 물려 놓고 볼륨으로 올린다
  if (!on && bgmTarget > 0) { const p = bgm.play(); if (p && p.catch) p.catch(() => {}); }
}
/** 매 프레임 부드럽게 볼륨을 따라간다 */
function bgmUpdate(dt) {
  const f = Math.max(BGM.fade, 0.05);
  bgmFade = rampTo(bgmFade, bgmTarget, f, f, dt);
  bgmDuckK = rampTo(bgmDuckK, bgmDucked ? 0 : 1, BGM_DUCK_UP, BGM_DUCK_DOWN, dt);
  bgmSwapK = rampTo(bgmSwapK, bgmPending >= 0 ? 0 : 1, BGM_SWAP_UP, BGM_SWAP_DOWN, dt);
  // 다 접히고 나서 갈아 끼운다 — 소리가 나는 중에 바꾸면 그 순간이 그대로 들린다
  if (bgmPending >= 0 && bgmSwapK <= 0.001) { bgmApplyTrack(bgmPending); bgmPending = -1; }

  bgm.volume = clamp(
    audioEase(bgmFade) * audioEase(bgmDuckK) * audioEase(bgmSwapK) * BGM.volume * (bgmMuted ? 0 : 1),
    0, 1
  );
  // 다 접히고 나서야 실제로 멈춘다 (접히는 중에는 계속 흘러야 페이드로 들린다)
  // 곡 바꾸는 중에는 멈추지 않는다 (멈췄다 켜면 유튜브가 처음부터 다시 문다)
  if ((bgmFade <= 0.001 || bgmDuckK <= 0.001) && !bgm.paused) bgm.pause();
  if (ytReady && ytPlayer) { try { ytPlayer.setVolume(Math.round(bgm.volume * 100)); } catch {} }

  // 광고가 끝나고 곡이 실제로 흐르기 시작하면 그때 화면을 우주로 내려앉힌다.
  // 매 프레임 물어볼 일은 아니라 4분의 1초에 한 번만 본다.
  ytPoll -= dt;
  if (ytPoll <= 0) {
    ytPoll = 0.25;
    const st = bgmTarget > 0 ? ytState() : 'none';
    if (st === 'play') { ytMiss = 0; setBgmStage(true); setBgmHeld(false); }
    // 멈춰 있으면 자리는 그대로 두고 또렷해지기만 한다 (돌아오면 다시 옅어진다)
    else if (st === 'pause') { ytMiss = 0; setBgmHeld(true); }
    // 곡을 갈아 끼워 광고가 또 붙으면 화면을 도로 모니터로 올린다 —
    // 광고를 우주 배경으로 깔아 둘 이유는 없다. 다만 잠깐 끊긴 걸 광고로 오해해
    // 화면이 왔다 갔다 하면 안 되니, 여섯 번(1.5초) 연달아 아닐 때만.
    else if (++ytMiss > 6) { setBgmStage(false); setBgmHeld(false); }
  }
  waitTick(dt);
}

const clockEl = document.getElementById('play-strip');
// 띠를 눌러도 다음 사건으로 넘어간다 (캔버스를 누른 것과 같은 동작).
// 이 띠가 하단 버튼 위를 덮고 있어서, 넘기려던 클릭이 버튼에 닿지 않는다.
if (clockEl) {
  clockEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  clockEl.addEventListener('click', (e) => {
    if (!play.active) return;
    e.stopPropagation();
    skipCue();
  });
}
/**
 * 숫자가 바뀔 때 위아래로 굴러가게 한다.
 * 자리마다 따로 굴린다 — 09 → 10 이면 십의 자리와 일의 자리만 움직이고,
 * 2025 → 2026 이면 마지막 한 칸만 움직인다. 안 바뀐 자리까지 같이 굴리면
 * 숫자 전체가 흔들려서 어디가 바뀐 건지 안 보인다.
 * 옛 숫자는 위로 빠지고 새 숫자가 아래에서 올라온다. 창 밖은 잘린다.
 */
const rollCell = (c, cls = 'rl-cur') => `<span class="rl"><span class="${cls}">${c}</span></span>`;
const rollStatic = (v) => [...v].map((c) => rollCell(c)).join('');
function rollTo(el, val) {
  if (!el) return;
  const next = String(val);
  const prev = el._rv;
  if (prev === next) return;
  el._rv = next;
  // 처음이거나 자릿수가 달라지면 굴리지 않고 그냥 갈아 끼운다
  if (prev === undefined || prev.length !== next.length) {
    el.innerHTML = rollStatic(next);
    return;
  }
  el.innerHTML = [...next]
    .map((c, i) => (prev[i] === c
      ? rollCell(c)
      : `<span class="rl"><span class="rl-out">${prev[i]}</span><span class="rl-in">${c}</span></span>`))
    .join('');
  clearTimeout(el._rt);
  el._rt = setTimeout(() => { el.innerHTML = rollStatic(el._rv); }, 460);
}

const clkYear = document.getElementById('pclk-year');
const clkMonth = document.getElementById('pclk-month');
const clkDay = document.getElementById('pclk-day');
const clkEra = document.getElementById('pclk-era');
let clkLastY = '';
let clkLastM = '';

function applyReveal() {
  const front = play.active ? play.front : Infinity;
  // 소개 중에는 진행선이 멈춘다. 그런데 등장 페이드는 "진행선이 지난 뒤"부터 도는 탓에,
  // 지금 소개하는 분기가 정작 k≈0 이라 제일 어두운 채로 서 있었다.
  // 멈춰 있는 동안 노출 기준선만 따로 앞으로 밀어, 소개 시작과 함께 완전히 드러나게 한다.
  const revealFront =
    play.active && play.hold > 0
      ? front + FADE_SPAN * clamp((play.holdMax - play.hold) / 0.55, 0, 1)
      : front;
  for (const r of revealables) {
    // 노출 기준선을 앞으로 민 건 "지금 소개하는 것"을 살리려던 것이지,
    // 진행선보다 앞에 있는 걸 미리 띄우려던 게 아니다. 앞쪽은 그대로 잠가 둔다.
    // (PHASE 이름표가 구간 안쪽 깊숙이 놓여 있어서 여기로 새어 나왔다)
    const k = play.active
      ? (r.x > front + 1.5 ? 0 : clamp((revealFront - r.x) / FADE_SPAN, 0, 1))
      : 1;
    r.k = k;
    for (const o of r.objs) o.visible = k > 0.002;
    if (k >= 1) {
      if (r.settled) continue;
      r.settled = true;
      for (const f of r.fades) {
        if (f.el) { f.el.style.opacity = ''; continue; }
        for (const t of f.mats) {
          if (t.m.uniforms && t.m.uniforms.uAppear) t.m.uniforms.uAppear.value = 1;
          else t.m.opacity = t.base;
        }
      }
      continue;
    }
    r.settled = false;
    if (k <= 0.002) continue;
    // 부드럽게 밝아지며 들어온다
    const e = k * k * (3 - 2 * k);
    for (const f of r.fades) {
      if (f.el) { f.el.style.opacity = String(e); continue; }
      for (const t of f.mats) {
        if (t.m.uniforms && t.m.uniforms.uAppear) t.m.uniforms.uAppear.value = e;
        else t.m.opacity = t.base * e;
      }
    }
  }
  for (const t of timelineMats) {
    t.m.uniforms.uReveal.value = play.active ? pointAtX(t.line, front).u + 0.004 : 2;
    t.m.uniforms.uRevealFrom.value = play.active ? pointAtX(t.line, PLAY_HEAD_X).u - 0.002 : -1;
  }
  for (const p of periodMats) {
    p.m.uniforms.uReveal.value = play.active
      ? clamp((pointAtX(p.line, front).i - p.i0) / (p.i1 - p.i0), 0, 1) + 0.004
      : 2;
  }
  scrubDots.forEach((d, i) => d.classList.toggle('is-ahead', play.active && dateToX(EVENTS[i].date) > front));
}

/**
 * 재생 중 순서대로 소개할 것들 — 분기 사건과 타이틀곡 MV 를 같은 자격으로 섞는다.
 * 파묘 사건은 뺀다 (데뷔 이전이라 이야기 흐름에 끼어든다).
 */
const PLAY_CUES = [
  ...EVENTS.map((ev, index) => {
    const x = dateToX(ev.date);
    return ev.kind !== 'dig' && x >= PLAY_FROM ? { type: 'event', index, ev, x, hold: HOLD_SEC } : null;
  }),
  ...MVS.map((mv, index) => {
    const x = dateToX(mv.date);
    // 선공개 「YoYo」는 데뷔 전이라 소개에서 뺀다 — 멤버 공개 다섯을 보고 나면
    // 바로 데뷔 쇼케이스로 이어져야 하는데, 그 자리를 YoYo 가 가로채고 있었다.
    // 시간선 위 스크린과 MV 갤러리에는 그대로 있다.
    return x >= PLAY_FROM && !mv.noPlay ? { type: 'mv', index, mv, x, hold: HOLD_SEC * 0.72 } : null;
  }),
]
  .filter(Boolean)
  .sort((a, b) => a.x - b.x || (a.type === 'event' ? -1 : 1));

const cueEl = document.getElementById('play-cue');
const cardEl = document.getElementById('play-card');
const cardKind = document.getElementById('pcard-kind');
const cardDate = document.getElementById('pcard-date');
const cardTitle = document.getElementById('pcard-title');
const cardMeta = document.getElementById('pcard-meta');
const cardVideos = document.getElementById('pcard-videos');
const cardPhoto = document.getElementById('pcard-photo');

/** 소개 카드 왼쪽에 멤버 프로필 사진을 세운다 (영상 화면이 아니라 인물 사진) */
function renderCuePhoto(photo) {
  if (!cardPhoto) return;
  const html = photoRow(photo, 'pcard-photo-in');
  cardPhoto.innerHTML = html;
  cardPhoto.hidden = !html;
  cardEl.classList.toggle('has-photo', !!html);
}

/** 소개 카드 아래에 관련 유튜브 영상 썸네일을 깐다 */
function renderCueVideos(list) {
  if (!cardVideos) return;
  cardVideos.innerHTML = '';
  if (!list || !list.length) {
    cardVideos.hidden = true;
    cardEl.classList.remove('has-videos');
    return;
  }
  cardVideos.hidden = false;
  const show = list.slice(0, 4);
  cardEl.classList.add('has-videos');
  show.forEach((v, i) => {
    const item = document.createElement('span');
    item.className = `pcv${v.hi ? ' is-hi' : ''}`;
    item.style.animationDelay = `${0.12 + i * 0.09}s`;
    item.innerHTML = `
      <span class="pcv-thumb">
        <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy">
        <em>▶</em>${v.hi ? '<u>최초</u>' : ''}
      </span>
      <b></b>`;
    item.querySelector('b').textContent = v.t;
    // 재생을 멈추지 않고 그 자리에서 볼 수 있다.
    // 화면 아무 데나 누르면 다음 사건으로 넘어가므로 여기서 이벤트를 끊어 준다.
    item.title = v.t;
    item.addEventListener('pointerdown', (e) => e.stopPropagation());
    item.addEventListener('click', (e) => { e.stopPropagation(); openPlayer({ id: v.id, t: v.t }); });
    cardVideos.appendChild(item);
  });
  if (list.length > show.length) {
    const more = document.createElement('span');
    more.className = 'pcv-more';
    more.textContent = `+${list.length - show.length}`;
    cardVideos.appendChild(more);
  }
}
let cueTimer = null;

/**
 * 재생 중 "지금 여기" 표시.
 * 분기마다 발광을 달아 두면 낭비라, 하나를 만들어 현재 사건 위치로 옮겨 쓴다.
 */
const focusFx = makeGlowStack(132, 0xfffdf6, 0xffd08a, 0xff8a2e);
focusFx.visible = false;
scene.add(focusFx);

const focusStreak = new THREE.Mesh(
  new THREE.PlaneGeometry(520, 30),
  new THREE.MeshBasicMaterial({
    map: ANAMORPH_TEX, color: 0xffd7a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
);
focusStreak.visible = false;
scene.add(focusStreak);

const focusPos = new THREE.Vector3();

// 안내 카드는 하단 HUD 가 아니라 사건 바로 위에 뜬다.
// CSS2DObject 로 감싸면 3D 좌표를 따라다닌다.
const cueAnchor = cueEl ? new CSS2DObject(cueEl) : null;
if (cueAnchor) {
  cueAnchor.visible = false;
  scene.add(cueAnchor);
}

// 자라나는 시간선 끝에 붙는 날짜. 하단 시계와 같은 값인데, 시선이 선 위에 있을 때
// 굳이 아래를 안 봐도 되게 한 번 더 찍어 준다.
const headDate = document.createElement('div');
headDate.className = 'head-date';
const headAnchor = new CSS2DObject(headDate);
headAnchor.visible = false;
scene.add(headAnchor);

function showCue(cue) {
  if (!cueEl) return;
  play.focus = -1;
  play.focusMv = -1;

  if (cue.type === 'mv') {
    const mv = cue.mv;
    // MV 는 스크린 자체가 바로 옆에 있으므로 3D 칩을 따로 띄우지 않는다
    cueEl.className = 'play-cue is-mv';
    cueEl.textContent = '';
    cueEl.dataset.cue = `mv:${mv.id}`;
    cardEl.className = 'play-card is-mv';
    renderCuePhoto(null);
    cardKind.textContent = '타이틀곡 뮤직비디오';
    cardDate.textContent = formatDate(mv.date);
    cardTitle.textContent = mv.song;
    cardMeta.textContent = `${mv.album} · ${formatViews(mv.views)}`;
    renderCueVideos([{ id: mv.id, t: `${mv.song} Official MV`, hi: true }]);
    play.focusMv = cue.index;
    focusPos.copy(mvScreens[cue.index].anchor);
  } else {
    const kind = KINDS[cue.ev.kind] || KINDS.release;
    const hi = cue.ev.videos && cue.ev.videos.some((v) => v.hi);
    cueEl.className = `play-cue kind-${cue.ev.kind}${cue.ev.nexus ? ' is-nexus' : ''}`;
    cueEl.textContent = kind.label;
    cueEl.dataset.cue = cue.ev.id;
    cardEl.className = `play-card kind-${cue.ev.kind}${cue.ev.nexus ? ' is-nexus' : ''}${hi ? ' is-hi' : ''}`;
    renderCuePhoto(cue.ev.photo);
    cardKind.textContent = `${kind.label}${hi ? '  ★ 하이라이트' : ''}`;
    cardDate.textContent = formatDate(cue.ev.date);
    cardTitle.textContent = cue.ev.title;
    cardMeta.textContent = cue.ev.meta || '';
    renderCueVideos(cue.ev.videos);
    play.focus = cue.index;
    focusPos.copy(branches[cue.index].tip);
  }

  if (cueAnchor) cueAnchor.visible = cue.type !== 'mv';
  cueEl.classList.add('is-on');
  cardEl.classList.add('is-on');
  clearTimeout(cueTimer);
  cueTimer = setTimeout(hideCue, cue.hold * 1000 - 420);
}

function hideCue() {
  clearTimeout(cueTimer);
  if (cueEl) cueEl.classList.remove('is-on');
  if (cardEl) cardEl.classList.remove('is-on');
  if (cueAnchor) cueAnchor.visible = false;
}

/**
 * 큐 하나를 발동시킨다. 루프에서 자연히 닿았을 때도, 좌우 키로 건너뛸 때도 여기로 온다.
 * instant 면 빅뱅 연출이 잦아들기를 기다리지 않고 바로 소개한다.
 */
function fireCueAt(i, instant = false) {
  const idx = clamp(i, 0, PLAY_CUES.length - 1);
  const cue = PLAY_CUES[idx];
  if (!cue) return false;
  hideCue();
  play.pendingCue = null;
  play.next = idx + 1;
  play.lastCueX = cue.x;
  play.front = cue.x;
  const isBang = cue.type === 'event' && cue.ev.nexus;
  play.hold = cue.hold + (isBang && !instant ? BANG_LEAD : 0);
  play.holdMax = play.hold;
  if (isBang) { fireBigBang(branches[cue.index].tip); gasWake = true; }
  if (isBang && !instant) play.pendingCue = cue;
  else showCue(cue);
  return true;
}

/** 좌우 키 — 사건 단위로 빠르게 건너뛴다 */
function jumpCue(dir) {
  if (!play.active) return;
  if (dir > 0) {
    if (play.next >= PLAY_CUES.length) {
      play.front = PLAY_TO;
      return;
    }
    fireCueAt(play.next, true);
  } else {
    fireCueAt(play.next - 2, true);
  }
}

/** 재생 중 클릭 — 지금 보여주는 걸 끊고 다음 사건으로 */
function skipCue() {
  if (!play.active) return;
  if (play.hold > 0) {
    if (play.pendingCue) {   // 빅뱅 중이면 우선 소개부터 띄운다
      showCue(play.pendingCue);
      play.pendingCue = null;
      play.hold = Math.max(play.hold, 0.6);
      return;
    }
    play.hold = 0;
    hideCue();
    return;
  }
  const next = PLAY_CUES[play.next];
  play.lastCueX = play.front;
  play.front = next ? Math.max(play.front, next.x - 1) : PLAY_TO;
}

function startPlay() {
  gasWake = false;   // 빅뱅 전까지 가스는 없다
  clearSelection();
  fly.active = false;
  play.active = true;
  play.front = PLAY_FROM;
  play.hold = 0;
  play.next = 0;
  play.lastCueX = PLAY_FROM;
  play.pendingCue = null;
  play.focus = -1;
  play.focusMv = -1;
  play.speed = 1;
  if (playSpeedBtn) playSpeedBtn.textContent = '1×';
  document.body.classList.add('is-playing');
  document.body.classList.remove('show-ui');
  clearTimeout(uiTimer);
  playBtn.textContent = '■ 정지';
  playHud.classList.add('is-on');
  if (clockEl) clockEl.classList.add('is-on');
  if (bgmChoice !== false) bgmStart();   // 「소리 없이」를 고른 경우엔 유튜브를 아예 안 문다
  clkLastY = '';
  clkLastM = '';
  applyReveal();
}

function stopPlay(complete = false) {
  play.active = false;
  headAnchor.visible = false;
  play.hold = 0;
  play.focus = -1;
  play.focusMv = -1;
  play.pendingCue = null;
  bang.on = false;
  bangGroup.visible = false;
  if (bangFlashEl) bangFlashEl.style.opacity = '0';
  focusFx.visible = false;
  focusStreak.visible = false;
  branches.forEach((b) => b.el.classList.remove('is-focus', 'is-faded'));
  hideCue();
  document.body.classList.remove('is-playing');
  document.body.classList.remove('show-ui');
  clearTimeout(uiTimer);
  playBtn.textContent = '▶ 재생';
  playHud.classList.remove('is-on');
  if (clockEl) clockEl.classList.remove('is-on');
  bgmStop();
  applyReveal();
  if (complete) flyTo(HOME_POS, HOME_TGT, 2.2);
}

/* --- 재생을 여는 순서 ------------------------------------------------
 * ▶ 를 누르면 곧장 시작하지 않고 **배경음을 틀지 먼저 묻는다** (그 페이지에서 한 번).
 *
 *   소리 없이   → 유튜브를 아예 안 물고 바로 시작
 *   소리와 함께 → 유튜브를 먼저 물려 놓고, **광고가 끝나 곡이 실제로 시작되는 순간**
 *                 시간선이 자라기 시작한다. 광고 보는 동안 연출이 혼자 지나가 버리면
 *                 데뷔도 거제 야호도 소리 없이 지나간 셈이 되기 때문이다.
 *
 * 한 번 지나가고 나면(waitDone) 다시 기다리지 않는다 — 프리롤은 처음 물 때 한 번이다.
 * 유튜브가 아예 안 뜨는 환경(차단·오프라인)에서도 멈춰 있지 않게 WAIT_MAX 뒤엔 그냥 시작한다.
 * ------------------------------------------------------------------ */
const askEl = document.getElementById('bgm-ask');
let bgmChoice = null;      // null=아직 안 물었다 · true=소리와 함께 · false=소리 없이
let waitOn = false;        // 광고가 끝나기를 기다리는 중
let waitT = 0;
let waitDone = false;      // 한 번 지나갔으면 다음 재생부터는 안 기다린다
const WAIT_MAX = 40;

function askShow(waiting) {
  if (!askEl) return;
  askEl.classList.toggle('is-wait', !!waiting);
  askEl.classList.add('is-on');
  askEl.setAttribute('aria-hidden', 'false');
}
function askHide() {
  if (!askEl) return;
  askEl.classList.remove('is-on', 'is-wait');
  askEl.setAttribute('aria-hidden', 'true');
}
const askOpen = () => askEl && askEl.classList.contains('is-on');

function waitStart() {
  waitOn = true;
  waitT = 0;
  bgmStart();               // 유튜브는 여기서 문다 — 아직 사용자 클릭 안이라 소리까지 자동재생된다
  askShow(true);
  playBtn.textContent = '■ 취소';
}
/** go=true 면 이어서 시간선을 연다, false 면 없던 일로 */
function waitEnd(go) {
  if (!waitOn) return;
  waitOn = false;
  waitDone = true;
  askHide();
  if (go) startPlay();
  else { bgmStop(); playBtn.textContent = '▶ 재생'; }
}
function waitTick(dt) {
  if (!waitOn) return;
  waitT += dt;
  if (ytContentLive() || waitT >= WAIT_MAX) waitEnd(true);
}
function askCancel() {
  if (waitOn) waitEnd(false);
  else askHide();
}
function beginPlay() {
  if (bgmChoice && !waitDone) waitStart();
  else startPlay();
}
function togglePlay() {
  if (askOpen()) { askCancel(); return; }
  if (play.active) { stopPlay(false); return; }
  if (bgmChoice === null) { askShow(false); return; }
  beginPlay();
}
{
  const wire = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  };
  wire('ask-yes', () => { bgmChoice = true; setMuted(false); askHide(); beginPlay(); });
  wire('ask-no', () => { bgmChoice = false; setMuted(true); askHide(); startPlay(); });
  wire('ask-skip', () => waitEnd(true));
  wire('ask-cancel', () => waitEnd(false));
  if (askEl) {
    askEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    // 바탕을 누르면 없던 일로 (카드 안쪽 클릭은 안 샌다)
    askEl.addEventListener('click', (e) => { if (e.target === askEl) askCancel(); });
  }
}
const fly = {
  active: false, t: 0, dur: 1.1,
  fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
  fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(),
};
function flyTo(toPos, toTgt, dur = 1.1) {
  fly.active = true;
  fly.t = 0;
  fly.dur = dur;
  fly.fromPos.copy(camera.position).sub(drift);
  fly.fromTgt.copy(controls.target);
  fly.toPos.copy(toPos);
  fly.toTgt.copy(toTgt);
}

const HOME_POS = new THREE.Vector3(...HOME_CAM.pos);
const HOME_TGT = new THREE.Vector3(...HOME_CAM.tgt);

function focusBranch(b) {
  const tgt = b.tip.clone();
  const view = camera.position.clone().sub(drift).sub(controls.target);
  if (view.lengthSq() < 1e-4) view.set(0, 0.2, 1);
  view.normalize();
  const dist = b.ev.nexus ? 210 : 96;
  const off = view.multiplyScalar(dist).addScaledVector(b.dir, b.ev.nexus ? 30 : 20);
  flyTo(tgt.clone().add(off), tgt, 1.2);
}

function selectEvent(index, doFly = true) {
  selected = index;
  selectedRadio = -1;
  selectedDrive = -1;
  radios.forEach((r) => r.el.classList.remove('is-selected'));
  drives.forEach((d) => d.el.classList.remove('is-selected'));
  const b = branches[index];
  branches.forEach((x) => {
    const on = x.index === index;
    x.el.classList.toggle('is-selected', on);
    x.el.classList.toggle('is-dimmed', !on);
  });

  const ev = b.ev;
  els.kind.textContent = b.kind.label;
  els.kind.className = `kind-chip kind-${ev.kind}`;
  els.date.textContent = formatDate(ev.date);
  els.title.textContent = ev.title;
  els.meta.textContent = ev.meta || '';
  els.desc.textContent = ev.desc;
  els.index.textContent = `${String(index + 1).padStart(2, '0')} / ${String(EVENTS.length).padStart(2, '0')}`;
  renderVideos(ev);
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  scrubDots.forEach((d, i) => d.classList.toggle('is-on', i === index));

  fireShock(b.tip, b.kind.glow);
  if (doFly) focusBranch(b);
}

let selectedRadio = -1;

function selectRadio(index, doFly = true) {
  selected = -1;
  branches.forEach((b) => b.el.classList.remove('is-selected', 'is-dimmed'));
  staffs.forEach((t) => t.el.classList.remove('is-selected'));
  staffs.forEach((t) => t.el.classList.remove('is-selected'));
  sideLines.forEach((sl) => sl.items.forEach((t) => t.el.classList.remove('is-selected')));
  sideLines.forEach((sl) => sl.items.forEach((t) => t.el.classList.remove('is-selected')));
  scrubDots.forEach((d) => d.classList.remove('is-on'));

  selectedRadio = index;
  selectedDrive = -1;
  drives.forEach((d) => d.el.classList.remove('is-selected'));
  radios.forEach((r) => r.el.classList.toggle('is-selected', r.i === index));

  const r = radios[index];
  els.kind.textContent = RADIO.label;
  els.kind.className = 'kind-chip kind-radio';
  els.date.textContent = formatDate(r.ep.date);
  els.title.textContent = r.ep.title;
  els.meta.textContent = `${index + 1}번째 방송 · 메이(MAY) · 조회수 ${formatViews(r.ep.views)}`;
  els.desc.textContent = RADIO.caption;
  els.index.textContent = `MERADIO ${String(index + 1).padStart(2, '0')} / ${String(r.total).padStart(2, '0')}`;
  renderVideos({ videos: [{ id: r.ep.id, t: r.ep.title, c: `${formatDate(r.ep.date)} 라이브 · RESCENE 공식 유튜브` }] });
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');

  fireShock(r.pos, RADIO.color);
  if (doFly) {
    const view = camera.position.clone().sub(drift).sub(controls.target);
    if (view.lengthSq() < 1e-4) view.set(0, 0.2, 1);
    flyTo(r.pos.clone().add(view.normalize().multiplyScalar(120)), r.pos.clone(), 1.2);
  }
}

let selectedShame = null;

function selectShame(mi, i) {
  selected = -1;
  selectedRadio = -1;
  selectedDrive = -1;
  branches.forEach((b) => b.el.classList.remove('is-selected', 'is-dimmed'));
  radios.forEach((r) => r.el.classList.remove('is-selected'));
  drives.forEach((d) => d.el.classList.remove('is-selected'));
  scrubDots.forEach((d) => d.classList.remove('is-on'));

  selectedShame = `${mi}:${i}`;
  shames.forEach((sh) => sh.el.classList.toggle('is-selected', sh.mi === mi && sh.i === i));

  const sh = shames.find((v) => v.mi === mi && v.i === i);
  if (!sh) return;
  els.kind.textContent = `${sh.mem.name} · ${SHAME.label}`;
  els.kind.className = 'kind-chip kind-shame';
  els.date.textContent = formatDate(sh.mo.date);
  els.title.textContent = sh.mo.title;
  els.meta.textContent = sh.mo.note || '';
  els.desc.textContent = `${sh.mem.name}의 굴욕 타임라인 · ${SHAME.sub}`;
  const total = sh.mem.moments.length;
  els.index.textContent = `${sh.mem.name.toUpperCase()} ${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  renderVideos({ videos: [{ id: sh.mo.id, t: sh.mo.title, c: sh.mo.note || '', s: true }] });
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');

  fireShock(sh.pos, sh.mem.color);
  const view = camera.position.clone().sub(drift).sub(controls.target);
  if (view.lengthSq() < 1e-4) view.set(0, 0.2, 1);
  flyTo(sh.pos.clone().add(view.normalize().multiplyScalar(150)), sh.pos.clone(), 1.2);
}

let selectedDrive = -1;
let selectedStaff = -1;
let selectedSide = null;

function selectDrive(index, doFly = true) {
  selected = -1;
  selectedRadio = -1;
  branches.forEach((b) => b.el.classList.remove('is-selected', 'is-dimmed'));
  radios.forEach((r) => r.el.classList.remove('is-selected'));
  staffs.forEach((t) => t.el.classList.remove('is-selected'));
  sideLines.forEach((sl) => sl.items.forEach((t) => t.el.classList.remove('is-selected')));
  scrubDots.forEach((d) => d.classList.remove('is-on'));

  selectedDrive = index;
  drives.forEach((d) => d.el.classList.toggle('is-selected', d.i === index));

  const d = drives[index];
  els.kind.textContent = DRIVE.label;
  els.kind.className = 'kind-chip kind-drive';
  els.date.textContent = formatDate(d.ep.date);
  els.title.textContent = d.ep.title;
  els.meta.textContent = `${index + 1}화 · 원이 · 조회수 ${formatViews(d.ep.views)}`;
  els.desc.textContent = DRIVE.caption;
  els.index.textContent = `DRIVING ${String(index + 1).padStart(2, '0')} / ${String(d.total).padStart(2, '0')}`;
  renderVideos({ videos: [{ id: d.ep.id, t: d.ep.title, c: `${formatDate(d.ep.date)} · 스튜디오ㅋㅇㅋ` }] });
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');

  fireShock(d.pos, DRIVE.color);
  if (doFly) {
    const view = camera.position.clone().sub(drift).sub(controls.target);
    if (view.lengthSq() < 1e-4) view.set(0, 0.2, 1);
    flyTo(d.pos.clone().add(view.normalize().multiplyScalar(150)), d.pos.clone(), 1.2);
  }
}

function selectStaff(index, doFly = true) {
  selected = -1;
  selectedRadio = -1;
  selectedDrive = -1;
  branches.forEach((b) => b.el.classList.remove('is-selected', 'is-dimmed'));
  radios.forEach((r) => r.el.classList.remove('is-selected'));
  drives.forEach((d) => d.el.classList.remove('is-selected'));
  sideLines.forEach((sl) => sl.items.forEach((t) => t.el.classList.remove('is-selected')));
  scrubDots.forEach((d) => d.classList.remove('is-on'));

  selectedStaff = index;
  staffs.forEach((t) => t.el.classList.toggle('is-selected', t.i === index));

  const t = staffs[index];
  els.kind.textContent = STAFF.label;
  els.kind.className = 'kind-chip kind-staff';
  els.date.textContent = formatDate(t.ep.date);
  els.title.textContent = t.ep.title;
  els.meta.textContent = `${t.ep.who || ''} · 조회수 ${formatViews(t.ep.views)}`;
  els.desc.textContent = STAFF.caption;
  els.index.textContent = `THE MUZE ${String(index + 1).padStart(2, '0')} / ${String(t.total).padStart(2, '0')}`;
  renderVideos({ videos: [{ id: t.ep.id, t: t.ep.title, c: formatDate(t.ep.date), hi: t.ep.hi }] });
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');

  fireShock(t.pos, STAFF.color);
  if (doFly) {
    const view = camera.position.clone().sub(drift).sub(controls.target);
    if (view.lengthSq() < 1e-4) view.set(0, 0.2, 1);
    flyTo(t.pos.clone().add(view.normalize().multiplyScalar(150)), t.pos.clone(), 1.2);
  }
}

function selectSide(si, index, doFly = true) {
  selected = -1;
  selectedRadio = -1;
  selectedDrive = -1;
  selectedStaff = -1;
  branches.forEach((b) => b.el.classList.remove('is-selected', 'is-dimmed'));
  radios.forEach((r) => r.el.classList.remove('is-selected'));
  drives.forEach((d) => d.el.classList.remove('is-selected'));
  staffs.forEach((t) => t.el.classList.remove('is-selected'));
  scrubDots.forEach((d) => d.classList.remove('is-on'));

  selectedSide = { si, index };
  sideLines.forEach((s, j) => s.items.forEach((t) => t.el.classList.toggle('is-selected', j === si && t.i === index)));

  const side = sideLines[si];
  const t = side.items[index];
  els.kind.textContent = side.data.label;
  els.kind.className = `kind-chip kind-${side.cls}`;
  els.date.textContent = formatDate(t.ep.date);
  els.title.textContent = t.ep.title;
  els.meta.textContent = [t.ep.ppl ? 'PPL' : null, t.ep.brand || t.ep.who, `조회수 ${formatViews(t.ep.views)}`]
    .filter(Boolean).join(' · ');
  els.desc.textContent = side.data.caption;
  els.index.textContent = `${side.data.sub} ${String(index + 1).padStart(2, '0')} / ${String(side.items.length).padStart(2, '0')}`;
  renderVideos({ videos: [{ id: t.ep.id, t: t.ep.title, c: formatDate(t.ep.date), hi: t.ep.hi }] });
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');

  fireShock(t.pos, side.data.color);
  if (doFly) {
    const view = camera.position.clone().sub(drift).sub(controls.target);
    if (view.lengthSq() < 1e-4) view.set(0, 0.2, 1);
    flyTo(t.pos.clone().add(view.normalize().multiplyScalar(150)), t.pos.clone(), 1.2);
  }
}

function clearSelection() {
  selected = -1;
  selectedRadio = -1;
  selectedDrive = -1;
  drives.forEach((d) => d.el.classList.remove('is-selected'));
  radios.forEach((r) => r.el.classList.remove('is-selected'));
  branches.forEach((b) => b.el.classList.remove('is-selected', 'is-dimmed'));
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  scrubDots.forEach((d) => d.classList.remove('is-on'));
}

function resetView() {
  clearSelection();
  flyTo(HOME_POS, HOME_TGT, 1.3);
}

let downPos = null;
canvas.addEventListener('pointerdown', (e) => {
  fly.active = false;
  if (play.active) { skipCue(); return; }
  if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('wheel', () => { fly.active = false; if (play.active) stopPlay(false); }, { passive: true });
canvas.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 5) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length) {
    const ud = hits[0].object.userData;
    if (ud.mvIndex !== undefined) openMv(ud.mvIndex);
    else if (ud.shame) selectShame(ud.shame.mi, ud.shame.i);
    else if (ud.driveIndex !== undefined) selectDrive(ud.driveIndex, true);
    else if (ud.staffIndex !== undefined) selectStaff(ud.staffIndex, true);
    else if (ud.side) selectSide(ud.side.si, ud.side.i, true);
    else if (ud.radioIndex !== undefined) selectRadio(ud.radioIndex, true);
    else selectEvent(ud.eventIndex, true);
  } else clearSelection();
});
canvas.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

/* 재생 중 UI 자동 숨김 — 마우스를 움직이면 잠깐 돌아온다 */
let uiTimer = null;
function pokeUI() {
  if (!play.active) return;
  document.body.classList.add('show-ui');
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => document.body.classList.remove('show-ui'), 2600);
}
window.addEventListener('pointermove', pokeUI, { passive: true });
window.addEventListener('pointerdown', pokeUI, { passive: true });
canvas.addEventListener('pointerleave', () => pointer.set(-2, -2));

document.getElementById('panel-close').addEventListener('click', clearSelection);
document.getElementById('btn-reset').addEventListener('click', resetView);
for (const era of [PAST, ...ERAS]) {
  const btn = document.getElementById(`btn-era-${era.id}`);
  if (!btn) continue;
  btn.addEventListener('click', () => {
    clearSelection();
    flyTo(new THREE.Vector3(...era.cam.pos), new THREE.Vector3(...era.cam.tgt), 1.3);
  });
}
playBtn.addEventListener('click', togglePlay);
const bgmBtn = document.getElementById('play-mute');
/**
 * 소리 켜기/끄기. 「소리 없이」로 시작했다가 여기서 켜면 그제서야 유튜브를 문다 —
 * 그 경우엔 프리롤이 그때 붙을 수 있으니 기다리지 않고 그냥 깔아 준다.
 */
function setMuted(on) {
  bgmMuted = !!on;
  if (bgmBtn) {
    bgmBtn.textContent = bgmMuted ? '🔇' : '🔊';
    bgmBtn.classList.toggle('is-off', bgmMuted);
    bgmBtn.title = bgmMuted ? '배경음 켜기' : '배경음 끄기';
  }
}
if (bgmBtn) {
  bgmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMuted(!bgmMuted);
    // 여기서 켠 사람은 이미 기다릴 만큼 기다린 셈이다 — 다음 재생에서 또 붙잡지 않는다
    if (!bgmMuted && bgmChoice === false && play.active) { bgmChoice = true; waitDone = true; bgmStart(); }
  });
}
if (playSpeedBtn) {
  playSpeedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    play.speed = play.speed >= 3 ? 1 : play.speed === 1 ? 2 : 3;
    playSpeedBtn.textContent = `${play.speed}×`;
  });
}
document.getElementById('btn-prev').addEventListener('click', () => (play.active ? jumpCue(-1) : step(-1)));
document.getElementById('btn-next').addEventListener('click', () => (play.active ? jumpCue(1) : step(1)));

function step(dir) {
  const next = selected < 0 ? (dir > 0 ? 0 : EVENTS.length - 1) : (selected + dir + EVENTS.length) % EVENTS.length;
  selectEvent(next, true);
}

window.addEventListener('keydown', (e) => {
  // 재생 전 물음이 떠 있으면 그것부터 — Esc / Space 는 없던 일로
  if (askOpen()) {
    if (e.key === 'Escape') askCancel();
    else if (e.key === ' ') { e.preventDefault(); askCancel(); }
    return;
  }
  if (playerEl.classList.contains('is-open')) {
    if (e.key === 'Escape') closePlayer();
    return;
  }
  if (galEl.classList.contains('is-open')) {
    if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') closeGallery();
    return;
  }
  if (memEl && memEl.classList.contains('is-open')) {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') closeMembers();
    return;
  }
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'm' || e.key === 'M') openGallery();
  else if (e.key === 'p' || e.key === 'P') openMembers();
  else if (e.key === 'c' || e.key === 'C') toggleHelp();
  else if (e.key === 'b' || e.key === 'B') toggleLegend();
  // 재생 중에는 좌우 키가 사건 단위 건너뛰기, 아닐 때는 사건 선택 이동
  else if (e.key === 'ArrowRight') (play.active ? jumpCue(1) : step(1));
  else if (e.key === 'ArrowLeft') (play.active ? jumpCue(-1) : step(-1));
  else if (e.key === 'Escape') clearSelection();
  else if (e.key === '0' || e.key === 'Home') resetView();
});

/* ==================================================================
 * 10. 루프
 * ================================================================== */

const clock = new THREE.Clock();
let booted = false;

/* --- 라벨 LOD ------------------------------------------------------- */

/**
 * 라벨 LOD — 멀리서는 굵직한 것만, 다가갈수록 자세해진다.
 *
 *   > LOD_WIDE  전체 조망: 주요 사건 + 대박 분기점 + MV 만
 *   > LOD_NEAR  구간 조망: 사건 전부, 날짜만
 *   ≤ LOD_NEAR  가까이:   제목까지 펼치고 보조 시간선 회차도 보인다
 */
const LOD_NEAR = 620;    // 이보다 가까우면 제목까지 펼친다
const LOD_FAR = 620;     // 보조 시간선 회차 칩이 보이기 시작하는 거리
const LOD_WIDE = 1900;   // 이보다 멀면 굵직한 것만 남긴다
const lodState = new Map();

function setLod(el, key, on) {
  let st = lodState.get(el);
  if (!st) { st = {}; lodState.set(el, st); }
  if (st[key] === on) return;
  st[key] = on;
  el.classList.toggle(key, on);
}

/* --- 라벨 겹침 해소 ------------------------------------------------ */

const dcProj = new THREE.Vector3();
const dcRight = new THREE.Vector3();
const dcUp = new THREE.Vector3();
const dcPos = new THREE.Vector3();
let dcMeasure = 0;

function updateDeclutter(dt) {
  // 투영은 카메라 행렬이 최신이어야 맞다. 렌더 전에 돌기 때문에 여기서 직접 갱신한다.
  camera.updateMatrixWorld();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const halfFov = Math.tan((camera.fov * 0.5) * DEG);
  dcRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  dcUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

  // 라벨 크기는 매 프레임 재면 레이아웃이 튄다 — 가끔만 다시 잰다
  dcMeasure -= dt;
  const measure = dcMeasure <= 0;
  if (measure) dcMeasure = 0.4;

  const live = [];
  for (const d of declutter) {
    if (measure || d.w === undefined) {
      d.w = d.el.offsetWidth || 150;
      d.h = d.el.offsetHeight || 44;
    }
    d.cur = d.cur || { x: 0, y: 0 };
    d.tgt = d.tgt || { x: 0, y: 0 };

    const cls = d.el.classList;
    const visible =
      d.obj.visible !== false &&
      d.el.style.display !== 'none' &&
      !cls.contains('is-minor') &&
      !cls.contains('is-far') &&
      d.w > 0;
    if (!visible) { d.tgt.x = 0; d.tgt.y = 0; continue; }

    if (d.baseFn) d.baseFn(d.base);
    dcProj.copy(d.base).project(camera);
    if (dcProj.z > 1) { d.tgt.x = 0; d.tgt.y = 0; continue; }
    d.sx = (dcProj.x * 0.5 + 0.5) * W;
    d.sy = (-dcProj.y * 0.5 + 0.5) * H;
    d.dist = camera.position.distanceTo(d.base);
    live.push(d);
  }

  // 화면 좌표에서 서로 밀어낸다 (겹침이 적은 축으로, 세로 우선)
  for (const d of live) { d.px = d.sx + d.cur.x; d.py = d.sy + d.cur.y; }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        const mw = (a.w + b.w) * 0.5 + 8;
        const mh = (a.h + b.h) * 0.5 + 7;
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const ox = mw - Math.abs(dx);
        const oy = mh - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        // 세로로 여는 게 자연스럽다. 가로 겹침이 훨씬 클 때만 옆으로 민다.
        // 고정 라벨(MV 스크린 캡션)은 안 움직이고 상대만 밀어낸다
        const wa = a.fixed ? 0 : b.fixed ? 2 : 1;
        const wb = b.fixed ? 0 : a.fixed ? 2 : 1;
        if (oy <= ox * 0.75) {
          const push = (oy * 0.5 + 0.3) * (dy >= 0 ? 1 : -1);
          a.py -= push * wa; b.py += push * wb;
        } else {
          const push = (ox * 0.5 + 0.3) * (dx >= 0 ? 1 : -1);
          a.px -= push * wa; b.px += push * wb;
        }
      }
    }
  }

  const k = 1 - Math.pow(0.0015, dt);   // 부드럽게 따라간다
  for (const d of declutter) {
    if (d.fixed) { d.px = undefined; continue; }
    if (d.px !== undefined && live.includes(d)) {
      d.tgt.x = clamp(d.px - d.sx, -120, 120);
      d.tgt.y = clamp(d.py - d.sy, -190, 190);
      d.px = undefined;
    }
    d.cur.x += (d.tgt.x - d.cur.x) * k;
    d.cur.y += (d.tgt.y - d.cur.y) * k;

    if (Math.abs(d.cur.x) < 0.05 && Math.abs(d.cur.y) < 0.05) {
      d.obj.position.copy(d.base);
    } else {
      // 화면 픽셀 → 그 깊이에서의 월드 단위
      const wpp = (2 * (d.dist || camera.position.distanceTo(d.base)) * halfFov) / H;
      dcPos.copy(d.base)
        .addScaledVector(dcRight, d.cur.x * wpp)
        .addScaledVector(dcUp, -d.cur.y * wpp);
      d.obj.position.copy(dcPos);
    }

    // 연결선이 옮겨진 라벨을 따라간다
    if (d.leader && d.leader.userData.setEnds) d.leader.userData.setEnds(d.from, d.obj.position);
  }
}

function updateLabelLod() {
  const p = camera.position;
  // 구간 이름표는 멀리서 보면 이름만 남긴다 — 다섯 개가 같은 높이에 서 있어서
  // 설명줄까지 펼치면 왼쪽 끝(파묘·연습생)이 서로 먹는다.
  for (const e of eraLabels) setLod(e.el, 'is-compact', e.pos.distanceTo(p) > LOD_WIDE);
  for (const b of branches) {
    const d = b.tip.distanceTo(p);
    setLod(b.el, 'is-compact', d > LOD_NEAR);
    // 전체를 조망할 땐 굵직한 사건만 남긴다
    setLod(b.el, 'is-minor', d > LOD_WIDE && !(b.ev.major || b.ev.nexus));
    // 분기점에서 갈라져 나온 「거제편」·「사투리편」 꼬리표는 전체 조망에서 접는다.
    // 구간 이름표·역주행 밴드·채널 표식과 한자리에 겹쳐 붙어서 글자가 서로 먹는다.
    if (b.forks) for (const f of b.forks) setLod(f.el, 'is-minor', d > LOD_WIDE);
  }
  for (const s of mvScreens) {
    const d = s.anchor.distanceTo(p);
    setLod(s.el, 'is-compact', d > LOD_NEAR);
    // 전체 조망에선 캡션을 접는다. 썸네일만으로 충분하고, 글자끼리 엉키지 않는다.
    setLod(s.el, 'is-minor', d > LOD_WIDE);
  }
  for (const r of radios) setLod(r.el, 'is-far', r.pos.distanceTo(p) > LOD_FAR);
  for (const d of drives) setLod(d.el, 'is-far', d.pos.distanceTo(p) > LOD_FAR);
  for (const t of staffs) setLod(t.el, 'is-far', t.pos.distanceTo(p) > LOD_FAR);
  for (const sl of sideLines) for (const t of sl.items) setLod(t.el, 'is-far', t.pos.distanceTo(p) > LOD_FAR);
  for (const sh of shames) setLod(sh.el, 'is-far', sh.pos.distanceTo(p) > LOD_FAR * 1.5);
  for (const d of digThreads) setLod(d.el, 'is-far', d.chipPos.distanceTo(p) > LOD_FAR * 1.6);
  // 데뷔가 들어 있는 2024 조망까지는 남기고, 전체 조망에서만 접는다
  for (const a of arcThreads) setLod(a.el, 'is-far', a.chipPos.distanceTo(p) > LOD_WIDE);
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  for (const t of timelineMats) t.m.uniforms.uTime.value = time;
  for (const m of leaderMats) m.uniforms.uTime.value = time;
  for (const p of periodMats) {
    p.m.uniforms.uTime.value = time;
    p.m.uniforms.uIntensity.value = p.gain * (0.85 + Math.sin(time * 0.9) * 0.25);
  }
  stars.mat.uniforms.uTime.value = time;

  // 재생 중 "지금 이 사건" 세기 — 들어올 때/나갈 때 부드럽게
  const focusK =
    play.active && play.hold > 0 && (play.focus >= 0 || play.focusMv >= 0)
      ? clamp(Math.min(play.holdMax - play.hold, play.hold) / 0.45, 0, 1)
      : 0;
  const fdimAll = 1 - focusK * 0.7;   // 사건을 비추는 동안 나머지는 물린다

  for (const b of branches) {
    const on = b.index === selected;
    const hov = b.index === hovered;
    const fk = play.focus === b.index ? focusK : 0;
    // 비추는 사건 말고는 확실히 죽여서 어디를 보는지 헷갈리지 않게
    // 비추는 분기는 어둡히지 않을 뿐 아니라 실제로 더 밝게 태운다
    const dim =
      (selected >= 0 && !on ? 0.34 : 1) *
      (focusK > 0 && fk === 0 ? 1 - focusK * 0.72 : 1) *
      (1 + fk * 1.3);
    for (const m of b.mats) {
      m.uniforms.uTime.value = time;
      m.uniforms.uSelected.value = lerp(m.uniforms.uSelected.value, Math.max(fk, on ? 1 : hov ? 0.45 : 0), 0.12);
      m.uniforms.uFlicker.value = lerp(m.uniforms.uFlicker.value, dim, 0.1);
    }
    b.dimTarget = lerp(b.dimTarget, dim, 0.1);
    if (play.active) {
      b.el.classList.toggle('is-focus', fk > 0.35);
      b.el.classList.toggle('is-faded', focusK > 0.35 && fk === 0);
    }

    const pulse = 1 + Math.sin(time * 2.1 + b.phase) * 0.07;
    const boost = (on ? 1.24 : hov ? 1.12 : 1) + fk * 0.85;
    b.node.scale.setScalar(b.nodeR * pulse * boost);
    b.node.rotation.y += dt * 0.35;
    b.node.rotation.x += dt * 0.21;
    b.halo.scale.setScalar(b.haloBase * (0.94 + Math.sin(time * 1.6 + b.phase) * 0.06) * boost);
    b.halo.material.opacity = clamp(0.5 * (1 + fk * 1.2), 0, 1);
    b.junction.material.opacity = clamp(((b.ev.nexus ? 0.6 : 0.38) + Math.sin(time * 2.6 + b.phase) * 0.16) * (1 + fk * 1.1), 0, 1);
    if (b.jRing) {
      b.jRing.quaternion.copy(camera.quaternion);
      b.jRing.scale.setScalar(11 * (1 + Math.sin(time * 1.7) * 0.1));
      b.jRing.material.opacity = 0.45 * dim;
    }
    for (const r of b.rings) {
      r.mesh.rotation.x += dt * r.sx;
      r.mesh.rotation.y += dt * r.sy;
      r.mesh.scale.setScalar(r.base * boost * (1 + Math.sin(time * 1.9 + b.phase) * 0.05));
      r.mesh.material.opacity = clamp((on ? 0.62 : hov ? 0.5 : 0.38) * dim, 0, 1);
    }
    for (const l of b.leaders) {
      if (l.material.uniforms) l.material.uniforms.uFlicker.value = clamp((on ? 1.8 : hov ? 1.3 : 0.85) * dim, 0, 2.4);
    }
    for (const f of b.forks) {
      f.node.scale.setScalar(1.6 * (1 + Math.sin(time * 2.4 + f.phase) * 0.1) * boost);
      f.halo.scale.setScalar(22 * (0.92 + Math.sin(time * 1.8 + f.phase) * 0.08) * boost);
      f.el.classList.toggle('is-dimmed', selected >= 0 && !on);
    }
    for (const r of b.hiRings || []) {
      const k = (time * 0.22 + r.off) % 1;
      r.mesh.quaternion.copy(camera.quaternion);
      r.mesh.scale.setScalar(8 + easeOutQuint(k) * (b.nodeR * 11));
      r.mesh.material.opacity = Math.sin(k * Math.PI) * (on ? 0.3 : hov ? 0.24 : 0.16) * dim;
    }
    if (b.hiStack) {
      b.hiStack.quaternion.copy(camera.quaternion);
      pulseGlowStack(b.hiStack, time, (on ? 1.45 : hov ? 1.2 : 1) * dim);
      b.hiStreak.quaternion.copy(camera.quaternion);
      b.hiStreak.material.opacity = 0.22 * (0.75 + Math.sin(time * 0.5 + b.phase) * 0.25) * boost * dim;
    }
    if (b.flare) {
      b.flare.quaternion.copy(camera.quaternion);
      const br = (on ? 1.45 : hov ? 1.18 : 1) * dim;
      pulseGlowStack(b.glowStack, time, br);
      for (const bar of b.bars) {
        // 길이가 아주 느리게 늘었다 줄었다 — 렌즈가 숨쉬는 느낌
        const k = 0.9 + Math.sin(time * bar.rate) * 0.1;
        bar.m.scale.set(k, 1, 1);
        bar.m.material.opacity = bar.o * (0.82 + Math.sin(time * bar.rate * 1.3) * 0.18) * br;
      }
      for (const g of b.ghostsFx) g.sp.material.opacity = g.o * (0.7 + Math.sin(time * 0.45) * 0.3) * br;
      for (const a of b.arcs) {
        a.mesh.rotation.z += dt * a.spin;
        a.mesh.material.opacity = (0.34 + Math.sin(time * 0.9 + a.phase) * 0.16) * br;
      }
    }
  }

  for (const r of radios) {
    const on = r.i === selectedRadio;
    const pl = 1 + Math.sin(time * 2.6 + r.phase) * 0.12;
    r.node.scale.setScalar(r.nr * pl * (on ? 1.7 : 1));
    r.node.rotation.y += dt * 0.5;
    r.halo.scale.setScalar(r.hr * pl * (on ? 2.1 : 1));
    r.halo.material.opacity = (on ? 0.9 : 0.45) * fdimAll;
  }

  for (const d of drives) {
    const on = d.i === selectedDrive;
    const pl = 1 + Math.sin(time * 2.4 + d.phase) * 0.12;
    d.node.scale.setScalar(d.nr * pl * (on ? 1.7 : 1));
    d.node.rotation.y += dt * 0.45;
    d.halo.scale.setScalar(d.hr * pl * (on ? 2.1 : 1));
    d.halo.material.opacity = (on ? 0.9 : 0.45) * fdimAll;
  }

  for (const sh of shames) {
    const on = selectedShame === `${sh.mi}:${sh.i}`;
    const pl = 1 + Math.sin(time * 2.5 + sh.phase) * 0.13;
    sh.node.scale.setScalar(2.2 * pl * (on ? 1.7 : 1));
    sh.node.rotation.y += dt * 0.5;
    sh.halo.scale.setScalar(20 * pl * (on ? 1.9 : 1));
    sh.halo.material.opacity = (on ? 0.95 : 0.5) * fdimAll;
  }

  for (const g of ghosts) {
    g.mat.uniforms.uTime.value = time;
    g.mat.uniforms.uFlicker.value = 0.5 + 0.5 * Math.abs(Math.sin(time * g.rate + g.phase));
  }

  if (shock.t <= 1) {
    shock.t += dt * 0.85;
    const k = clamp(shock.t, 0, 1);
    const e = easeOutQuint(k);
    shockRing.quaternion.copy(camera.quaternion);
    shockRing.scale.setScalar(6 + e * 52);
    // 뜨자마자 사라지지 않고 천천히 번지며 사그라든다
    shockRing.material.opacity = Math.sin(k * Math.PI) * 0.22;
    shockGlow.scale.setScalar(14 + e * 62);
    shockGlow.material.opacity = Math.pow(1 - k, 2.2) * 0.3;
    if (k >= 1) { shockRing.visible = false; shockGlow.visible = false; }
  }

  bgmUpdate(dt);
  updateBigBang(dt, time);
  futureFan.update(dt, time);
  petalField(dt, time);
  debutPetals(dt, time);
  scentField(time);
  for (const f of flowUpdaters) f(dt, time);
  updateSparks(dt);
  updateMeteors(dt);
  dust.rotation.y = time * 0.005;
  stars.pts.rotation.y = time * 0.0016;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  const hitUd = hits.length ? hits[0].object.userData : null;
  const nowHovered = scrubHover >= 0 ? scrubHover : hitUd && hitUd.eventIndex !== undefined ? hitUd.eventIndex : -1;
  if (nowHovered !== hovered) {
    hovered = nowHovered;
  }
  const hoveredMv = hitUd && hitUd.mvIndex !== undefined ? hitUd.mvIndex : -1;
  canvas.style.cursor = hovered >= 0 || hitUd ? 'pointer' : 'grab';

  // MV 스크린 — 카메라 up 방향으로 띄우므로 어느 각도에서 봐도 시간선에 붙어 보인다
  camUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  // 배경 가스는 어느 방향에서 봐도 덩어리로 보이게 카메라를 향해 세운다.
  // 그리고 재생 중에는 **빅뱅이 터진 뒤에야** 서서히 차오른다 — 색이 세상에 번지는 게
  // 거제 야호의 결과이지 원래 있던 배경이 아니기 때문이다.
  {
    const want = play.active ? (gasWake ? 1 : 0) : 1;
    // 차오를 땐 2.6초, 물러날 땐 0.8초 — 사라지는 건 빨라야 "원래 없었던" 것으로 읽힌다
    gasT = clamp(gasT + (want ? dt / 2.6 : -dt / 0.8), 0, 1);
    const k = 1 - Math.pow(1 - gasT, 3);
    for (const b of gasBlobs) {
      b.quaternion.copy(camera.quaternion).multiply(b.userData.spin);
      b.material.opacity = b.material.userData.baseOpacity * k;
      b.visible = k > 0.002;
    }
  }
  // 지금 비추는 사건 자리에 스포트라이트
  if (focusK > 0.002) {
    const e = focusK * focusK * (3 - 2 * focusK);
    if (cueAnchor) cueAnchor.position.copy(focusPos).addScaledVector(camUp, 118);
    focusFx.visible = true;
    focusStreak.visible = true;
    focusFx.position.copy(focusPos);
    focusFx.quaternion.copy(camera.quaternion);
    pulseGlowStack(focusFx, time, e * 1.25);
    focusStreak.position.copy(focusPos);
    focusStreak.quaternion.copy(camera.quaternion);
    focusStreak.material.opacity = e * 0.34 * (0.82 + Math.sin(time * 1.6) * 0.18);
    focusStreak.scale.setScalar(0.9 + e * 0.18);
  } else if (focusFx.visible) {
    focusFx.visible = false;
    focusStreak.visible = false;
    if (cueAnchor) cueAnchor.visible = false;
  }

  for (const s of mvScreens) {
    const on = s.i === hoveredMv;
    const mk = play.focusMv === s.i ? focusK : 0;   // 재생 중 지금 이 MV
    const fdim = mk > 0 ? 1 : 1 - focusK * 0.7;
    s.holder.quaternion.copy(camera.quaternion);
    s.holder.position.copy(s.anchor).addScaledVector(camUp, s.lift);
    const k = 1 + Math.sin(time * 1.5 + s.phase) * 0.02 + (on ? 0.07 : 0) + mk * 0.22;
    s.holder.scale.setScalar(k);
    s.frameMat.opacity = ((on ? 0.9 : 0.42) + Math.sin(time * 2.2 + s.phase) * 0.07) * fdim;
    s.glow.material.opacity = ((on ? 0.4 : 0.18) + Math.sin(time * 1.3 + s.phase) * 0.04) * fdim;
    s.el.classList.toggle('is-hot', on || mk > 0.35);

    const pl = 1 + Math.sin(time * 2.2 + s.phase) * 0.08;
    s.node.scale.setScalar(s.nodeR * pl * (on ? 1.5 : 1) * (1 + mk * 0.8));
    s.node.rotation.y += dt * 0.4;
    s.halo.scale.setScalar(s.haloR * pl * (on ? 1.5 : 1) * (1 + mk * 0.9));
    s.ring.quaternion.copy(camera.quaternion);
    s.ring.material.opacity = (on ? 0.85 : 0.42) * fdim;

    // 연결선: 노드에서 스크린 아래 모서리까지
    mvEnd.copy(s.holder.position).addScaledVector(camUp, -(s.halfH * k + 3));
    s.leader.userData.setEnds(s.anchor, mvEnd);
    s.leader.material.uniforms.uFlicker.value = (on ? 1.7 : 0.85) * fdim;
  }

  for (const d of digThreads) {
    d.mat.uniforms.uTime.value = time;
    const on = d.b.index === selected;
    d.mat.uniforms.uSelected.value = lerp(d.mat.uniforms.uSelected.value, on ? 1 : 0, 0.12);
    const pl = 1 + Math.sin(time * 2.4 + d.phase) * 0.12;
    d.node.scale.setScalar(1.6 * pl * (on ? 1.8 : 1));
    d.halo.scale.setScalar(22 * pl * (on ? 1.9 : 1));
    d.el.classList.toggle('is-selected', on);
  }

  for (const a of arcThreads) {
    a.mat.uniforms.uTime.value = time;
    // 어느 쪽 MV 를 짚어도 같이 살아난다 — 둘이 한 쌍이라는 걸 그 자리에서 알린다
    const on =
      hoveredMv === a.src.i || hoveredMv === a.dst.i ||
      play.focusMv === a.src.i || play.focusMv === a.dst.i;
    a.mat.uniforms.uSelected.value = lerp(a.mat.uniforms.uSelected.value, on ? 1 : 0, 0.12);
    a.mat.uniforms.uFlicker.value = (on ? 1.7 : 0.9) + Math.sin(time * 2.1 + a.phase) * 0.08;
    a.el.classList.toggle('is-selected', on);
  }

  // 재생 — 진행선을 밀고, 카메라가 따라간다
  if (play.active && watchingVideo()) {
    // 영상 보는 중 — 진행선도 카메라도 소개 카드도 그 자리에 세워 둔다.
    // 배경음은 openPlayer 가 이미 물려 놨고, 창을 닫으면 그대로 이어진다.
  } else if (play.active) {
    const base = (PLAY_TO - PLAY_FROM) / play.dur;
    if (play.hold > 0) {
      // 소개 중에는 완전히 멈춘다.
      // 조금씩이라도 흐르게 두면 다음 사건을 지나쳐 버려서,
      // 사건이 발동할 때 진행선이 뒤로 되감기며 속도가 튄다.
      play.hold -= dt * play.speed;
      // 빅뱅이 잦아들면 그때 소개 카드를 띄운다
      if (play.pendingCue && play.holdMax - play.hold >= BANG_LEAD) {
        showCue(play.pendingCue);
        play.pendingCue = null;
      }
    } else {
      const cue = PLAY_CUES[play.next];
      // 사건에 다가갈수록 부드럽게 늦추고, 떠날 땐 부드럽게 붙인다.
      // 구간 길이에 맞춰 완급 폭을 잡아서 사건이 촘촘한 데서 기어가지 않게 한다.
      // 마지막 사건 뒤에는 끝점을 목표로 삼아 마무리도 같은 곡선으로 잦아든다.
      const target = cue ? cue.x : PLAY_TO;
      const from = play.lastCueX;
      const span = clamp((target - from) * 0.42, 55, 190);   // 최소 폭 = 여러 프레임에 걸치게
      const out = clamp((play.front - from) / span, 0, 1);   // 출발 가속
      const into = clamp((target - play.front) / span, 0, 1); // 도착 감속
      const ease = (t) => t * t * (3 - 2 * t);
      const mul = 0.1 + 0.9 * ease(out) * ease(into);
      play.front += base * play.speed * dt * mul;
      // 시간선이 갈라지는 지점에서는 먼저 터지고, 잦아든 뒤에 소개한다
      if (cue && play.front >= cue.x - 0.5) fireCueAt(play.next);
    }
    if (play.front >= PLAY_TO) {
      play.front = PLAY_TO;
      applyReveal();
      futureFan.fire();   // 사방으로 뻗는 가능성 → 그 연출이 끝나면 전체 보기로
      stopPlay(false);
    } else {
      applyReveal();
      // 평소에는 본류를 화면 중앙에 두고 진행선을 따라 가로로만 흐른다.
      // 사건을 소개하는 동안에는 **그 사건이 화면 한가운데 오도록** 카메라가 옮겨 간다 —
      // 확대는 하지 않는다(거리를 그대로 두면 크기가 안 변해서 눈이 안 피곤하다).
      // 오가는 곡선은 스포트라이트(focusK)와 같은 것을 쓴다. 그래서 사건이 밝아지는
      // 속도로 다가가고, 잦아드는 속도로 본류에 돌아온다 — 따로 어긋나 보이지 않는다.
      const fp = pointAtX(MAIN, clamp(play.front, TIME.xTailHead, TIME.xTailEnd)).point;
      // 진행 방향을 조금 앞서 본다. 다만 얼마나 앞서 볼지는 **화면에 담기는 폭의 비율**로
      // 잡는다 — 고정된 world 값을 쓰면 세로로 긴 손전화에서 화면 절반을 넘어 버린다.
      const halfW = PLAY_DIST * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
      // 그리고 **다음 사건까지 남은 거리를 미리 보고** 그만큼만 편다.
      // 사건 사이 한가운데서 가장 넓게 펴고 사건에 닿는 순간 0 으로 거둔다 —
      // 소개가 시작될 때 카메라가 뒤로 물러섰다 나올 일이 없다.
      // 거두는 속도가 진행 속도보다 빠르면 그 자체가 「뒤로 감」이 되므로,
      // 사건 간격의 1/3.2 을 넘지 않게 묶는다. 사건이 촘촘한 구간에서는 알아서 0 에 가까워진다.
      const nextCue = PLAY_CUES[play.next];
      const gap = Math.max((nextCue ? nextCue.x : PLAY_TO) - play.lastCueX, 1);
      const leadMax = Math.min(halfW * 0.19, gap / 3.2, 170);
      const half = gap * 0.5;
      const toNext = clamp(((nextCue ? nextCue.x : PLAY_TO) - play.front) / half, 0, 1);
      const fromLast = clamp((play.front - play.lastCueX) / half, 0, 1);
      const leadK = Math.min(toNext, fromLast);
      const lead = leadMax * leadK * leadK * (3 - 2 * leadK);
      const aimX = fp.x + lead;
      const aimY = fp.y + 40;
      playTgt.set(aimX, aimY, 0);
      if (focusK > 0.001) {
        playTgt.lerp(focusPos, focusK);
        // 정가운데에 딱 놓으면 사건 위에 붙는 이름표와 안내 칩이 잘린다.
        // 화면 높이의 한 자락만큼 올려 두면 사건·이름표가 한 덩어리로 가운데 온다.
        playTgt.y += focusK * 62;
      }
      playPos.copy(playTgt).add(PLAY_OFF);
      // 빅뱅 순간엔 카메라가 잠깐 흔들린다
      const sh = bangShake();
      if (sh > 0) {
        playPos.x += Math.sin(time * 71) * 46 * sh;
        playPos.y += Math.sin(time * 53 + 1.7) * 38 * sh;
        playTgt.x += Math.sin(time * 67 + 0.9) * 24 * sh;
        playTgt.y += Math.sin(time * 59 + 2.4) * 20 * sh;
      }
      controls.target.lerp(playTgt, 1 - Math.pow(0.05, dt));
      camera.position.lerp(playPos, 1 - Math.pow(0.09, dt));
      // 하단 큰 날짜 — 해가 바뀌면 한 번 번쩍인다
      // 지나온 마지막 MV 를 배경음으로 깐다
      bgmWant(play.front);
      const pt = xToParts(play.front);
      if (clkYear) {
        if (pt.y !== clkLastY) {
          clkLastY = pt.y;
          // 해가 바뀔 땐 구르면서 한 번 번쩍인다
          clkYear.classList.remove('is-roll');
          void clkYear.offsetWidth;
          clkYear.classList.add('is-roll');
          if (clkEra) clkEra.textContent = `${pt.era.caption || ''}`;
        }
        if (pt.m !== clkLastM) {
          clkLastM = pt.m;
          if (clkEra) clkEra.textContent = `${pt.era.caption || ''}`;
        }
        rollTo(clkYear, pt.y);
        rollTo(clkMonth, pt.m);
        rollTo(clkDay, pt.d);
      }
      if (playDate) playDate.textContent = `${pt.y}. ${pt.m}. ${pt.d}`;
      // 자라나는 시간선 끝에도 같은 날짜를 붙인다 — 지금 어디까지 왔는지가 선 위에서 보여야 한다
      if (headDate) {
        const hl = play.front >= NEXUS_X ? NEXUS_LINE : MAIN;
        const hp = pointAtX(hl, clamp(play.front, TIME.xTailHead, TIME.xTailEnd)).point;
        headAnchor.position.copy(hp).addScaledVector(camUp, 30);
        headAnchor.visible = true;
        headDate.textContent = `${pt.y}. ${pt.m}. ${pt.d}`;
      }
      if (playBar) playBar.style.width = `${((play.front - PLAY_FROM) / (PLAY_TO - PLAY_FROM)) * 100}%`;
    }
  }

  camera.position.sub(drift);
  if (fly.active) {
    fly.t += dt / fly.dur;
    const k = easeInOutCubic(clamp(fly.t, 0, 1));
    camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
    controls.target.lerpVectors(fly.fromTgt, fly.toTgt, k);
    if (fly.t >= 1) fly.active = false;
  }
  controls.update();
  const amp = clamp(camera.position.distanceTo(controls.target) * 0.004, 0.2, 2.4);
  drift.set(Math.sin(time * 0.31) * amp, Math.cos(time * 0.24) * amp * 0.8, Math.sin(time * 0.19 + 1.1) * amp * 0.6);
  camera.position.add(drift);

  // 라벨 LOD — 화면 전체가 아니라 라벨마다 카메라와의 거리로 판단한다.
  // 한 구간을 들여다볼 때 그 구간만 제목이 펼쳐지고 나머지는 날짜/점으로 접힌다.
  updateLabelLod();
  updateDeclutter(dt);

  composer.render();
  labelRenderer.render(scene, camera);

  if (!booted) {
    booted = true;
    document.body.classList.add('is-ready');
  }
}

/* --- 크기 바뀔 때 ----------------------------------------------------
 * 모바일에서 화면이 번쩍이던 이유가 여기 있었다. 주소창이 접혔다 펴질 때마다
 * resize 가 연달아 날아오는데, 그때마다 렌더타깃(MSAA·블룸·SMAA)을 통째로 다시 잡으면
 * 프레임마다 빈 화면이 한 장씩 끼어든다 — 그게 「번쩍번쩍」이다.
 *
 * 그래서 **카메라 비율만 즉시** 맞추고(캔버스는 CSS 로 100% 라 그동안 살짝 늘어날 뿐),
 * 무거운 버퍼 재할당은 잠잠해진 뒤에 한 번만 한다.
 * ------------------------------------------------------------------ */
let sizeW = window.innerWidth;
let sizeH = window.innerHeight;
let sizeTimer = 0;

function applySize(w, h) {
  sizeW = w;
  sizeH = h;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  labelRenderer.setSize(w, h);
  bgmLayout();
}
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w === sizeW && h === sizeH) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  bgmLayout();
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(() => applySize(window.innerWidth, window.innerHeight), 220);
}
window.addEventListener('resize', onResize);
// 화면을 돌리면 innerWidth/Height 가 한 박자 늦게 바뀌는 기기가 있다
window.addEventListener('orientationchange', () => setTimeout(onResize, 260));

/* --- 부팅 ---------------------------------------------------------- */

bgmLayout();   // 화면은 아직 안 보이지만 자리는 미리 잡아 둔다
setMuted(false);

document.getElementById('meta-members').textContent = GROUP.members.join(' · ');
document.getElementById('meta-agency').textContent = GROUP.agency;
document.getElementById('meta-fandom').textContent = GROUP.fandom;

camera.position.copy(HOME_POS);
controls.target.copy(HOME_TGT);

const eraParam = [PAST, ...ERAS].find((e) => e.id === params.get('era'));
if (eraParam) {
  camera.position.set(...eraParam.cam.pos);
  controls.target.set(...eraParam.cam.tgt);
}

if (!eraParam && params.get('intro') !== '0') {
  camera.position.set(-360, 560, 1560);
  controls.target.set(-60, 0, 0);
  flyTo(HOME_POS, HOME_TGT, 3.2);
}

const startId = params.get('e');
if (startId) {
  const i = EVENTS.findIndex((e) => e.id === startId);
  if (i >= 0) setTimeout(() => selectEvent(i, !eraParam), eraParam || params.get('intro') === '0' ? 0 : 2800);
}

// 콘솔·검사기에서 상태를 들여다보기 위한 읽기용 핸들
const bgmMode = {
  ONE_I: BGM_ONE_I,
  el: bgmModeEl,
  set: (v) => setBgmOne(v),
  want: (x) => bgmWant(x),
  get one() { return bgmOne; },
  get track() { return bgmTrack; },
  get pending() { return bgmPending; },
};
/** 배경음 화면이 어디에 앉아 있는지 (모니터 / 우주) */
const bgmStageApi = {
  el: bgmStage,
  frame: bgmFrame,
  layout: bgmLayout,
  rect: () => bgmStageRect(),
  set: (v) => setBgmStage(v),
  hold: (v) => setBgmHeld(v),
  get space() { return bgmSpace; },
  get held() { return bgmHeld; },
};
/** 재생을 열기 전 물음 · 광고 대기 */
const askGate = {
  el: askEl,
  open: () => askOpen(),
  get choice() { return bgmChoice; },
  get waiting() { return waitOn; },
  get done() { return waitDone; },
  get t() { return waitT; },
  MAX: WAIT_MAX,
  AD_MIN_RUN,
  // 검사기가 「소리 없이」 길도 재 볼 수 있게 열어 둔다
  reset: () => { bgmChoice = null; waitDone = false; },
};
window.__rescene = { declutter, branches, mvScreens, arcThreads, radios, drives, shames, staffs, sideLines, bgm, bgmMode, bgmStage: bgmStageApi, askGate, LOW_GPU, AA_SAMPLES, get glLost() { return glLost; }, focusPos, MV_BY_X, play, futureFan, revealables, gasBlobs, headAnchor, headDate, camera, controls, THREE };

tick();
