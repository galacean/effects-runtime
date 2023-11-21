// @ts-nocheck
import { Player, POST_PROCESS_SETTINGS, setConfig, defaultGlobalVolume } from '@galacean/effects';
import { InspireList } from './common/inspire-list';

const url = 'https://mdn.alipayobjects.com/mars/afts/file/A*YIKpS69QTaoAAAAAAAAAAAAADlB4AQ';
//const url = 'https://mdn.alipayobjects.com/mars/afts/file/A*6j_ZQan_MhMAAAAAAAAAAAAADlB4AQ'; // BloomTest
const container = document.getElementById('J-container');
let player;
const speed = 0.5;
const inspireList = new InspireList();

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
  setDatGUI();
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
    const scene = await player.loadScene(json);

    void player.play(scene, { speed });
  } catch (e) {
    console.error('biz', e);
  }
}

function handlePause () {
  player.pause();
}

// dat gui 参数及修改
function setDatGUI () {
  const gui = new dat.GUI();
  const ParticleFolder = gui.addFolder('Particle');
  const BloomFolder = gui.addFolder('Bloom');
  const ToneMappingFlolder = gui.addFolder('ToneMapping');
  const ColorAdjustmentsFolder = gui.addFolder('ColorAdjustments');

  ParticleFolder.addColor(postProcessSettings, 'color');
  ParticleFolder.add(postProcessSettings, 'intensity', -10, 10).step(0.1);
  ParticleFolder.open();

  BloomFolder.add(postProcessSettings, 'useBloom', 0, 1).step(1);
  BloomFolder.add(postProcessSettings, 'threshold', 0, 40).step(0.1);
  BloomFolder.add(postProcessSettings, 'bloomIntensity', 0, 10);
  BloomFolder.open();

  ColorAdjustmentsFolder.add(postProcessSettings, 'brightness', -5, 5).step(0.1);
  ColorAdjustmentsFolder.add(postProcessSettings, 'saturation', -100, 100);
  ColorAdjustmentsFolder.add(postProcessSettings, 'contrast', -100, 100);
  ColorAdjustmentsFolder.open();

  ToneMappingFlolder.add(postProcessSettings, 'useToneMapping', 0, 1).step(1);
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
