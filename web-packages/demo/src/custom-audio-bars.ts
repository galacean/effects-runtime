import type { Material } from '@galacean/effects';
import { Player, RendererComponent, setBlendMode, spec } from '@galacean/effects';

const jsonUrl = 'https://mdn.alipayobjects.com/mars/afts/file/A*xNoxSpP63Y8AAAAAQaAAAAgAelB4AQ';
const container = document.getElementById('J-container') as HTMLElement;

const DEBUG = true;

// 顶点 shader - 修复：使用 aPos 而不是 aPoint
const vertex = `
precision highp float;

attribute vec3 aPos;
attribute vec2 aUV;

uniform mat4 effects_ObjectToWorld;
uniform mat4 effects_MatrixVP;

varying vec2 vUV;

void main() {
    vUV = aUV;
    vec4 localPos = vec4(aPos.xy, 0.0, 1.0);
    vec4 worldPos = effects_ObjectToWorld * localPos;
    gl_Position = effects_MatrixVP * worldPos;
}
`;

// 片元 shader
const fragment = `
precision mediump float;

varying vec2 vUV;

uniform float uRatio;          // width / height
uniform float volumeData0;
uniform float volumeData1;
uniform float volumeData2;
uniform float volumeData3;
uniform float volumeData4;
uniform float volumeData5;
uniform float volumeData6;
uniform float volumeData7;
uniform float volumeData8;
uniform float volumeData9;
uniform float volumeData10;
uniform float volumeData11;
uniform float volumeData12;
uniform float volumeData13;
uniform float volumeData14;
uniform float volumeData15;
uniform float volumeData16;
uniform float volumeData17;
uniform float volumeData18;
uniform float volumeData19;
uniform float volumeData20;
uniform float volumeData21;
uniform float volumeData22;
uniform float volumeData23;
uniform float volumeData24;
uniform float volumeData25;
uniform float volumeData26;
uniform float volumeData27;
uniform float volumeData28;
uniform float volumeData29;
uniform float volumeData30;
uniform float volumeData31;

void main() {
    vec2 uv = vUV;
    float ratio = uRatio;

    float fVBars = 65.0;
    float fHSpacing = 1.00;
    float fHFreq = (uv.x * 3.14159);
    float waveVal = sin(fHFreq * fVBars) + 1.0 - fHSpacing;
    float squarewave = sign(waveVal);

    float minHeight = ratio / fVBars;
    float maxHeight = 1.0;

    float x = floor(uv.x * fVBars) / fVBars;
    int index = int(abs(2.0 * x - 1.0) * 32.0);
    float fSample;

    if      (index == 0)  fSample = volumeData0;
    else if (index == 1)  fSample = volumeData1;
    else if (index == 2)  fSample = volumeData2;
    else if (index == 3)  fSample = volumeData3;
    else if (index == 4)  fSample = volumeData4;
    else if (index == 5)  fSample = volumeData5;
    else if (index == 6)  fSample = volumeData6;
    else if (index == 7)  fSample = volumeData7;
    else if (index == 8)  fSample = volumeData8;
    else if (index == 9)  fSample = volumeData9;
    else if (index == 10) fSample = volumeData10;
    else if (index == 11) fSample = volumeData11;
    else if (index == 12) fSample = volumeData12;
    else if (index == 13) fSample = volumeData13;
    else if (index == 14) fSample = volumeData14;
    else if (index == 15) fSample = volumeData15;
    else if (index == 16) fSample = volumeData16;
    else if (index == 17) fSample = volumeData17;
    else if (index == 18) fSample = volumeData18;
    else if (index == 19) fSample = volumeData19;
    else if (index == 20) fSample = volumeData20;
    else if (index == 21) fSample = volumeData21;
    else if (index == 22) fSample = volumeData22;
    else if (index == 23) fSample = volumeData23;
    else if (index == 24) fSample = volumeData24;
    else if (index == 25) fSample = volumeData25;
    else if (index == 26) fSample = volumeData26;
    else if (index == 27) fSample = volumeData27;
    else if (index == 28) fSample = volumeData28;
    else if (index == 29) fSample = volumeData29;
    else if (index == 30) fSample = volumeData30;
    else                  fSample = volumeData31;

    fSample = (fSample - 0.1) / 0.8;
    fSample = clamp(fSample, 0.0, 1.0);
    fSample = mix(minHeight, maxHeight, fSample);

    float fft = squarewave * fSample * 0.5;

    if (fft <= 0.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec3 col;
    int rectIdx = int(uv.x * fVBars);
    float offsetY = abs(0.5 - uv.y);
    float oY;

    if (offsetY < fft - minHeight * 0.5) {
        oY = 0.0;
    } else {
        oY = (offsetY * 2.0 - (fSample - minHeight)) * (fVBars / ratio);
    }

    float _x = uv.x - (float(rectIdx) + 0.5) / fVBars;
    float oX = abs(_x) * fVBars * 2.0;

    if (offsetY < fft && sqrt(oX * oX + oY * oY) < 1.0) {
        col = vec3(1.0, 1.0, 1.0);

        float alpha = 1.0;
        float distance = abs(uv.x - 0.5) - 0.4;
        alpha *= 1.0 - smoothstep(0.0, 0.1, distance);

        gl_FragColor = vec4(col * alpha, alpha);
    } else {
        gl_FragColor = vec4(0.0);
    }
}
`;

let material: Material | undefined;

(async () => {
  const player = new Player({
    container,
    interactive: false,
    onError: (err: Error) => console.error('Player error:', err),
  });

  const json = await fetch(jsonUrl).then(r => r.json());

  // 确保结构存在
  json.materials[0].floats = json.materials[0].floats || {};
  json.shaders[0].vertex = vertex;
  json.shaders[0].fragment = fragment;

  const composition = await player.loadScene(json);
  const item = composition.getItemByName('effect_2');

  if (!item) {
    console.error('No item named "effect_2" found in scene');

    return;
  }

  const rendererComponents = item.getComponents(RendererComponent);

  if (!rendererComponents.length) {return;}

  const mats = rendererComponents[0].materials;

  if (!mats.length) {return;}

  material = mats[0];

  // 混合模式和深度
  setBlendMode(material, spec.BlendingMode.ALPHA);
  material.depthMask = false;

  // 设置初始 uniform
  const rect = container.getBoundingClientRect();
  const ratio = rect.width / rect.height;

  material.setFloat('uRatio', ratio);

  for (let i = 0; i < 32; i++) {
    material.setFloat(`volumeData${i}`, 0.0);
  }

  let lastTime = performance.now() / 1000;

  function updateLoop () {
    const now = performance.now() / 1000;
    const t = now - lastTime;

    // 简单的模拟音频数据：32 段正弦 + 一点随机扰动
    if (material) {
      for (let i = 0; i < 32; i++) {
        const phase = now * 1.5 + i * 0.2;
        const base = Math.sin(phase) * 0.5 + 0.5; // 0~1
        const noise = (Math.sin(phase * 3.7) * 0.2 + 0.2); // 0~0.4
        const v = Math.max(0.1, Math.min(0.9, base * 0.7 + noise * 0.3));

        material.setFloat(`volumeData${i}`, v);
      }
    }

    lastTime = now;
    requestAnimationFrame(updateLoop);
  }

  updateLoop();
  player.play();
})().catch(err => {
  console.error(err);
});
