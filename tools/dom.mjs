/* 브라우저 없이 main.js 를 그대로 실행하기 위한 최소 DOM 스텁 */
const noop = () => {};
export const handlers = [];   // {el, type, fn}
const rec = (el) => (type, fn) => { if (typeof fn === 'function') handlers.push({ el, type, fn }); };
export const frames = [];     // requestAnimationFrame 콜백
function ctx2d() {
  const grad = { addColorStop: noop };
  return new Proxy({
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    fillRect: noop, clearRect: noop, beginPath: noop, arc: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop, drawImage: noop,
    moveTo: noop, lineTo: noop, closePath: noop, ellipse: noop, rect: noop,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop,
  }, { get: (t, k) => (k in t ? t[k] : undefined), set: () => true });
}
function el(tag = 'div') {
  const classes = new Set();
  const node = {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], style: {}, dataset: {},
    width: 512, height: 512, title: '', value: '',
    className: '', id: '', hidden: false, type: '', href: '', target: '', rel: '',
    allow: '', src: '', referrerPolicy: '', allowFullscreen: false,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on) => (on === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : on ? classes.add(c) : classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    appendChild: (c) => (node.children.push(c), c),
    append: (...c) => node.children.push(...c),
    removeChild: noop, remove: noop, insertBefore: (c) => c,
    addEventListener: (t, f) => rec(node)(t, f), removeEventListener: noop, setAttribute: noop,
    getAttribute: () => null, removeAttribute: noop, focus: noop, blur: noop, click: noop,
    querySelector: () => el(), querySelectorAll: () => [],
    getContext: () => ctx2d(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
    setPointerCapture: noop, releasePointerCapture: noop,
    _classes: classes,
  };
  // innerHTML 에 값을 넣으면 실제 브라우저처럼 자식이 날아가고,
  // textContent 는 태그를 걷어낸 글자만 남는다 (둘이 어긋나면 검사기가 헛것을 본다)
  let _html = '';
  let _text = '';
  Object.defineProperty(node, 'innerHTML', {
    get: () => _html,
    set: (v) => {
      _html = String(v);
      node.children.length = 0;
      _text = _html.replace(/<[^>]*>/g, '');
    },
    enumerable: true, configurable: true,
  });
  Object.defineProperty(node, 'textContent', {
    get: () => _text,
    set: (v) => { _text = v == null ? '' : String(v); _html = _text; node.children.length = 0; },
    enumerable: true, configurable: true,
  });
  return node;
}
const byId = new Map();
const document = {
  createElement: (t) => el(t),
  createElementNS: (ns, t) => el(t),
  getElementById: (id) => { if (!byId.has(id)) { const e = el(); e.id = id; byId.set(id, e); } return byId.get(id); },
  querySelector: () => el(), querySelectorAll: () => [],
  addEventListener: (t, f) => rec(document)(t, f), removeEventListener: noop,
  body: el('body'), documentElement: el('html'), head: el('head'),
};
const window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener: (t, f) => rec(window)(t, f), removeEventListener: noop,
  requestAnimationFrame: (f) => (frames.push(f), frames.length), cancelAnimationFrame: noop,
  setTimeout: (fn) => 0, clearTimeout: noop,
  location: { search: '', href: 'http://localhost:8123/' },
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  document,
};
globalThis.document = document;
globalThis.window = window;
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true }); } catch {}
globalThis.self = window;
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.location = window.location;
// 검사기가 시간을 직접 밀 수 있게 가짜 시계를 쓴다 (재생 연출을 끝까지 돌려보려고)
export const fakeClock = { t: 0 };
Object.defineProperty(globalThis, 'performance', {
  value: { now: () => fakeClock.t },
  configurable: true, writable: true,
});
globalThis.URLSearchParams = globalThis.URLSearchParams || class { get() { return null; } };
globalThis.HTMLCanvasElement = function () {};
globalThis.HTMLElement = function () {};
globalThis.Image = function () {};
// 재생 배경음 검증용 오디오 스텁
export const audios = [];
globalThis.Audio = function (src) {
  const a = {
    src: src || '', loop: false, preload: '', volume: 0, paused: true, currentTime: 0,
    play() { a.paused = false; a.plays = (a.plays || 0) + 1; return Promise.resolve(); },
    pause() { a.paused = true; a.pauses = (a.pauses || 0) + 1; },
    addEventListener: noop, removeEventListener: noop,
  };
  audios.push(a);
  return a;
};
export { document, window, byId };
