import type { Composition } from '@galacean/effects';
import { POST_PROCESS_SETTINGS, Player, PostProcessVolume, setConfig } from '@galacean/effects';
import postProcessingList from './assets/post-processing-list';

// DATUI 参数面板
const postProcessSettings = {
  // Particle
  color: [0, 0, 0],
  intensity: 1.0,
};
const container = document.getElementById('J-container');
const resumeBtn = document.getElementById('J-resume');
const url = postProcessingList['bloomTest'].url;
let player: Player;
let gui: any;

initSelectList();
setConfig(POST_PROCESS_SETTINGS, postProcessSettings);

(async () => {
  try {
    player = new Player({
      container,
    });

    await handleLoadScene(url);
  } catch (e) {
    console.error('biz', e);
  }
})();

resumeBtn?.addEventListener('click', () => handleLoadScene(url));

async function handleLoadScene (url: string) {
  const json = await (await fetch(url)).json();

  json.renderSettings = {
    postProcessingEnabled: true,
  };
  player.destroyCurrentCompositions();

  const composition = await player.loadScene(json);

  composition.rootItem.addComponent(PostProcessVolume);
  setDatGUI(composition);
}

function initSelectList () {
  const selectEle = document.getElementById('J-select') as HTMLSelectElement;
  const options: string[] = [];

  Object.entries(postProcessingList).map(([key, object]) => {
    options.push(`<option value="${key}" ${object.name === 'ribbons' ? 'selected' : ''}>${object.name}</option>`);
  });
  selectEle.innerHTML = options.join('');
  selectEle.onchange = () => {
    const name = selectEle.value as keyof typeof postProcessingList;

    void handleLoadScene(postProcessingList[name].url);
  };
}

// dat gui 参数及修改
function setDatGUI (composition: Composition) {
  if (gui) {
    gui.destroy();
  }
  // @ts-expect-error
  gui = new window.GUI();
  const ParticleFolder = gui.addFolder('Particle');
  const BloomFolder = gui.addFolder('Bloom');
  const ToneMappingFlolder = gui.addFolder('ToneMapping');
  const VignetteFolder = gui.addFolder('Vignette');
  const ColorAdjustmentsFolder = gui.addFolder('ColorAdjustments');

  const globalVolume = composition.renderFrame.globalVolume;

  if (!globalVolume) {
    return;
  }

  ParticleFolder.addColor(postProcessSettings, 'color');
  ParticleFolder.add(postProcessSettings, 'intensity', -10, 10).step(0.1);
  ParticleFolder.open();

  BloomFolder.add(globalVolume, 'bloomEnabled', 0, 1).step(1);
  BloomFolder.add(globalVolume, 'threshold', 0, 40).step(0.1);
  BloomFolder.add(globalVolume, 'bloomIntensity', 0, 10);
  BloomFolder.open();

  VignetteFolder.add(globalVolume, 'vignetteIntensity', 0, 2);
  VignetteFolder.add(globalVolume, 'vignetteSmoothness', 0, 2);
  VignetteFolder.add(globalVolume, 'vignetteRoundness', 0, 1.5);

  ColorAdjustmentsFolder.add(globalVolume, 'brightness', -5, 5).step(0.1);
  ColorAdjustmentsFolder.add(globalVolume, 'saturation', 0, 2);
  ColorAdjustmentsFolder.add(globalVolume, 'contrast', 0, 2);
  ColorAdjustmentsFolder.open();

  ToneMappingFlolder.add(globalVolume, 'toneMappingEnabled', 0, 1).step(1);
  ToneMappingFlolder.open();
}
