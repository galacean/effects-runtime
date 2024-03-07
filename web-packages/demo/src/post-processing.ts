//@ts-nocheck
import type { Composition } from '@galacean/effects';
import { POST_PROCESS_SETTINGS, Player, defaultGlobalVolume, setConfig } from '@galacean/effects';
import { InspireList } from './common/inspire-list';
import { InspectorGui } from './gui/inspector-gui';

const url = 'https://mdn.alipayobjects.com/mars/afts/file/A*YIKpS69QTaoAAAAAAAAAAAAADlB4AQ';
//const url = 'https://mdn.alipayobjects.com/mars/afts/file/A*6j_ZQan_MhMAAAAAAAAAAAAADlB4AQ'; // BloomTest
const container = document.getElementById('J-container');
const speed = 0.5;
const inspireList = new InspireList();

const inspectorGui = new InspectorGui();

setInterval(()=>{
  inspectorGui.update();
}, 100);

let gui = new GUI();
let player;

// DATUI 参数面板
const postProcessSettings = {
  // Particle
  color: [0, 0, 0],
  intensity: 1.0,
  // Bloom
  useBloom: 1.0,
  threshold: 1.0,
  bloomIntensity: 1.0,
  // ColorAdjustments
  brightness: 0,
  saturation: 0,
  contrast: 0,
  // ToneMapping
  useToneMapping: 1, // 1: true, 0: false
};

(async () => {
  setConfig(POST_PROCESS_SETTINGS, postProcessSettings);
  player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
  });
  await handlePlay(url);
})();

bindEventListeners();

function bindEventListeners () {
  inspireList.handleStart = () => {
    handlePause();
    void handlePlay(inspireList.currentInspire);
  };
  inspireList.handlePause = handlePause;
}

async function handlePlay (url) {
  try {
    const json = await (await fetch(url)).json();

    hackGlobalVolume(json);
    player.destroyCurrentCompositions();
    const comp = await player.loadScene(json);

    void player.play(comp, { speed });
    setDatGUI(comp);

  } catch (e) {
    console.error('biz', e);
  }
}

function handlePause () {
  player.pause();
}

// dat gui 参数及修改
function setDatGUI (composition: Composition) {
  gui.destroy();
  gui = new GUI();
  const ParticleFolder = gui.addFolder('Particle');
  const BloomFolder = gui.addFolder('Bloom');
  const ToneMappingFlolder = gui.addFolder('ToneMapping');
  const ColorAdjustmentsFolder = gui.addFolder('ColorAdjustments');

  const globalVolume = composition.renderFrame.globalVolume;

  ParticleFolder.addColor(postProcessSettings, 'color');
  ParticleFolder.add(postProcessSettings, 'intensity', -10, 10).step(0.1);
  ParticleFolder.open();

  BloomFolder.add(globalVolume, 'useBloom', 0, 1).step(1);
  BloomFolder.add(globalVolume, 'threshold', 0, 40).step(0.1);
  BloomFolder.add(globalVolume, 'bloomIntensity', 0, 10);
  BloomFolder.open();

  ColorAdjustmentsFolder.add(globalVolume, 'brightness', -5, 5).step(0.1);
  ColorAdjustmentsFolder.add(globalVolume, 'saturation', 0, 2);
  ColorAdjustmentsFolder.add(globalVolume, 'contrast', 0, 2);
  ColorAdjustmentsFolder.open();

  ToneMappingFlolder.add(globalVolume, 'useToneMapping', 0, 1).step(1);
  ToneMappingFlolder.open();
}

// TODO: 临时 hack globalVolume
function hackGlobalVolume (json) {
  json.compositions.forEach(composition => {
    composition.globalVolume = {
      ...defaultGlobalVolume,
      usePostProcessing: true,
      useHDR: true,
    };
  });
}
