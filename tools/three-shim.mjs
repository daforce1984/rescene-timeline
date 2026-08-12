/* 실제 three 를 그대로 쓰되, GL 컨텍스트가 필요한 것만 스텁으로 가린다.
   명시적 export 가 export * 보다 우선하므로 WebGLRenderer 만 갈아끼워진다. */
export * from './three.module.js';
import * as T from './three.module.js';

export class WebGLRenderer {
  constructor(p = {}) {
    this.domElement = p.canvas || { style: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
    this.outputColorSpace = T.SRGBColorSpace;
    this.toneMapping = T.NoToneMapping;
    this.toneMappingExposure = 1;
    this.shadowMap = { enabled: false };
    this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 1, maxTextureSize: 4096 };
    this.info = { render: {}, memory: {} };
  }
  setPixelRatio() {} setSize() {} setClearColor() {} setClearAlpha() {}
  setRenderTarget() {} clear() {}
  // 실제 렌더러는 렌더할 때 카메라 행렬을 갱신한다 — 스텁도 맞춰 준다
  render(scene, camera) { if (scene) scene.updateMatrixWorld(); if (camera) camera.updateMatrixWorld(); }
  dispose() {}
  getSize(v) { return (v || new T.Vector2()).set(1280, 720); }
  getPixelRatio() { return 1; }
  getContext() { return {}; }
}
