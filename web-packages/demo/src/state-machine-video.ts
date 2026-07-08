import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';

const container = document.getElementById('J-container');
const twoVideosButton = document.getElementById('J-two-videos') as HTMLButtonElement | null;
const oneVideoButton = document.getElementById('J-one-video') as HTMLButtonElement | null;
const currentSceneLabel = document.getElementById('J-current-scene');

const scenes = {
  twoVideos: {
    label: '多视频状态机',
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*K4S8QI1g7Q0AAAAAQGAAAAgAelB4AQ',
  },
  oneVideo: {
    label: '单视频状态机',
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*khBxQ7pq5nEAAAAAQFAAAAgAelB4AQ',
  },
};

type SceneKey = keyof typeof scenes;

const player = new Player({
  container,
  pixelRatio: window.devicePixelRatio,
  onError: (err, ...args) => {
    console.error('biz', err.message);
  },
});

let activeScene: SceneKey | null = null;

async function loadStateMachineVideo (sceneKey: SceneKey) {
  if (activeScene === sceneKey) {
    return;
  }

  activeScene = sceneKey;
  updateToolbar();
  player.destroyCurrentCompositions();
  await player.loadScene(scenes[sceneKey].url, { useHevcVideo: true });
}

function updateToolbar () {
  if (twoVideosButton) {
    twoVideosButton.classList.toggle('active', activeScene === 'twoVideos');
  }
  if (oneVideoButton) {
    oneVideoButton.classList.toggle('active', activeScene === 'oneVideo');
  }
  if (currentSceneLabel) {
    currentSceneLabel.textContent = activeScene ? scenes[activeScene].label : '';
  }
}

twoVideosButton?.addEventListener('click', () => {
  void loadStateMachineVideo('twoVideos');
});

oneVideoButton?.addEventListener('click', () => {
  void loadStateMachineVideo('oneVideo');
});

void loadStateMachineVideo('twoVideos');
