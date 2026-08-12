/* three/addons/* 스텁 — 구조만 맞추고 실제 GL 작업은 하지 않는다 */
import * as T from './three.module.js';
const noop = () => {};

export class OrbitControls {
  constructor(cam, dom) {
    this.object = cam; this.domElement = dom;
    this.target = new T.Vector3();
    this.enabled = true; this.enableDamping = false; this.dampingFactor = 0.05;
    this.screenSpacePanning = true; this.minDistance = 0; this.maxDistance = Infinity;
    this.minPolarAngle = 0; this.maxPolarAngle = Math.PI; this.zoomSpeed = 1;
    this.rotateSpeed = 1; this.panSpeed = 1; this.enableZoom = true; this.enableRotate = true;
    this.enablePan = true; this.autoRotate = false;
    this.mouseButtons = {}; this.touches = {};
  }
  update() { return true; } addEventListener() {} removeEventListener() {}
  saveState() {} reset() {} dispose() {}
}
export class EffectComposer {
  constructor() { this.passes = []; this.renderTarget1 = {}; }
  addPass(p) { this.passes.push(p); } insertPass() {} removePass() {}
  setSize() {} setPixelRatio() {} render() {} dispose() {}
}
export class RenderPass { constructor() { this.enabled = true; } setSize() {} dispose() {} }
export class OutputPass { constructor() { this.enabled = true; } setSize() {} dispose() {} }
export class SMAAPass { constructor() { this.enabled = true; } setSize() {} dispose() {} }
export class UnrealBloomPass {
  constructor(res, strength, radius, threshold) {
    this.enabled = true; this.strength = strength; this.radius = radius; this.threshold = threshold;
    this.resolution = res;
  }
  setSize() {} dispose() {}
}
export class CSS2DRenderer {
  constructor() {
    this.domElement = globalThis.document.createElement('div');
  }
  setSize() {} render() {} getSize() { return { width: 1280, height: 720 }; }
}
export class CSS2DObject extends T.Object3D {
  constructor(element) { super(); this.element = element || globalThis.document.createElement('div'); this.isCSS2DObject = true; }
}
