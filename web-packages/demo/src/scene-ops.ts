import { Player, type spec } from '@galacean/effects';
import {
  clone, findElement, patchElementTransform, patchTransformAnimation, replaceTexture,
} from '@galacean/effects-helper';

type MutationResult = {
  ok: boolean,
  scene?: spec.JSONScene,
  data?: unknown,
  code?: string,
  message?: string,
};

const renderSceneButton = document.getElementById('render-scene') as HTMLButtonElement;
const previewContainer = document.getElementById('preview-container') as HTMLDivElement;

const findIdInput = document.getElementById('find-id') as HTMLInputElement;
const transformIdInput = document.getElementById('transform-id') as HTMLInputElement;
const posXInput = document.getElementById('pos-x') as HTMLInputElement;
const posYInput = document.getElementById('pos-y') as HTMLInputElement;
const posZInput = document.getElementById('pos-z') as HTMLInputElement;
const textureIdInput = document.getElementById('texture-id') as HTMLInputElement;
const textureUrlInput = document.getElementById('texture-url') as HTMLInputElement;
const textureReuseSelect = document.getElementById('texture-reuse') as HTMLSelectElement;
const cleanupUnusedInput = document.getElementById('cleanup-unused') as HTMLInputElement;
const animationIdInput = document.getElementById('animation-id') as HTMLInputElement;
const animationXInput = document.getElementById('anim-x') as HTMLInputElement;

const runFindButton = document.getElementById('run-find') as HTMLButtonElement;
const runTransformButton = document.getElementById('run-transform') as HTMLButtonElement;
const runTextureButton = document.getElementById('run-texture') as HTMLButtonElement;
const runAnimationButton = document.getElementById('run-animation') as HTMLButtonElement;

const url = 'https://mdn.alipayobjects.com/mars/afts/file/A*U47LQ7QY9YYAAAAARMAAAAgAelB4AQ';
let json: spec.JSONScene;
let player: Player | null = null;

void main();

async function main (): Promise<void> {
  const response = await fetch(url);

  json = await response.json() as spec.JSONScene;

  await renderScene(json);
}

renderSceneButton.addEventListener('click', async () => {
  await renderScene(json);
});

runFindButton.addEventListener('click', () => {
  const value = findIdInput.value.trim();
  const result = findElement(json, value);

  console.info(result);
});

runTransformButton.addEventListener('click', async () => {
  const elementId = transformIdInput.value.trim();
  const result = patchElementTransform({
    scene: json,
    elementId,
    transform: {
      position: {
        x: toNumber(posXInput.value),
        y: toNumber(posYInput.value),
        z: toNumber(posZInput.value),
      },
    },
  });

  if (result.ok) {
    await renderScene(result.scene);
  }
});

// runTextureButton.addEventListener('click', async () => {
//   await runMutation(scene => {
//     const elementId = textureIdInput.value.trim();
//     const url = textureUrlInput.value.trim();

//     if (!elementId || !url) {
//       throw new Error('请输入 Element ID 和 Texture URL');
//     }

//     return replaceTexture({
//       scene,
//       elementId,
//       url,
//       reuseBy: textureReuseSelect.value as 'textureId' | 'url' | 'none',
//       cleanupUnused: cleanupUnusedInput.checked,
//     });
//   });
// });

// runAnimationButton.addEventListener('click', async () => {
//   await runMutation(scene => {
//     const elementId = animationIdInput.value.trim();

//     if (!elementId) {
//       throw new Error('请输入 Element ID');
//     }

//     return patchTransformAnimation({
//       scene,
//       elementId,
//       patch: {
//         positionOverLifetime: {
//           path: [
//             { key: 0, value: [0, 0, 0] },
//             { key: 1, value: [toNumber(animationXInput.value || '10'), 0, 0] },
//           ],
//         },
//       },
//     });
//   });
// });

async function renderScene (scene: spec.JSONScene): Promise<void> {
  const nextScene = clone(scene);

  if (!player) {
    player = new Player({
      container: previewContainer,
    });
  }

  await player.loadScene(nextScene);
}

function toNumber (value: string): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}
