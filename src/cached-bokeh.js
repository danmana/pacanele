import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

// Reuse the depth image while only the LCD texture or lighting changes.
// The composite, depth precision, blur kernel and resolution are unchanged.
export class CachedBokehPass extends BokehPass {
  constructor(...args) { super(...args); this.depthNeedsUpdate = true; }
  setSize(width, height) { super.setSize(width, height); this.depthNeedsUpdate = true; }
  render(renderer, writeBuffer, readBuffer) {
    renderer.getClearColor(this._oldClearColor);
    const alpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
    const override = this.scene.overrideMaterial;
    renderer.autoClear = false;
    try {
      if (this.depthNeedsUpdate) {
        this.scene.overrideMaterial = this._materialDepth;
        renderer.setClearColor(0xffffff, 1);
        renderer.setRenderTarget(this._renderTargetDepth);
        renderer.clear(); renderer.render(this.scene, this.camera);
        this.scene.overrideMaterial = override;
        this.depthNeedsUpdate = false;
      }
      this.uniforms.tColor.value = readBuffer.texture;
      this.uniforms.nearClip.value = this.camera.near;
      this.uniforms.farClip.value = this.camera.far;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      if (!this.renderToScreen) renderer.clear();
      this._fsQuad.render(renderer);
    } finally {
      this.scene.overrideMaterial = override;
      renderer.setClearColor(this._oldClearColor, alpha);
      renderer.autoClear = autoClear;
    }
  }
}
