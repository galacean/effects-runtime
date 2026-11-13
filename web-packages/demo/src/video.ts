import type { Texture } from '@galacean/effects';
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';
import { attachVideoReplayCapture } from './common/video-replay-capture';
const allVideos = [
  // 合成重播
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*VJMvSYFHqBgAAAAAQDAAAAgAelB4AQ', desc: '合成重播 视频销毁' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*Bo19SqnCGP8AAAAAQDAAAAgAelB4AQ', desc: '合成重播 视频重播' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*8t8vRKsoon0AAAAAQDAAAAgAelB4AQ', desc: '合成重播 视频冻结' },
  // 合成无限
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*FkDGRYxT3MkAAAAAQDAAAAgAelB4AQ', desc: '合成无限 视频销毁' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*eLlnS7RaogoAAAAAQDAAAAgAelB4AQ', desc: '合成无限 视频重播' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*PHWLR44J9ZcAAAAAQDAAAAgAelB4AQ', desc: '合成无限 视频冻结' },
  // 合成冻结
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*OVTDRaYuBs4AAAAAQDAAAAgAelB4AQ', desc: '合成冻结 视频销毁' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*V4fNRIAEalcAAAAAQDAAAAgAelB4AQ', desc: '合成冻结 视频重播' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*hiL7SYfNdpQAAAAAQDAAAAgAelB4AQ', desc: '合成冻结 视频冻结' },
  // 合成销毁
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*wbEISYCBzLoAAAAAQDAAAAgAelB4AQ', desc: '合成销毁 视频销毁' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*uLoEQ6JTIQAAAAAAQDAAAAgAelB4AQ', desc: '合成销毁 视频重播' },
  { url: 'https://mdn.alipayobjects.com/mars/afts/file/A*TyPlT4dEQJcAAAAAQDAAAAgAelB4AQ', desc: '合成销毁 视频冻结' },
];

// 视频卡顿案例 JSON
const stuckVideoJson = {
  'playerVersion': {
    'web': '2.7.3',
    'native': '0.0.1.202311221223',
  },
  'images': [],
  'fonts': [],
  'version': '3.5',
  'plugins': [
    'video',
  ],
  'type': 'ge',
  'compositions': [
    {
      'id': 'e5986d7f83ed4e039fd59a7a9e092560',
      'name': 'Video',
      'duration': 5,
      'startTime': 0,
      'endBehavior': 2,
      'previewSize': [750, 1624],
      'camera': {
        'fov': 60,
        'far': 40,
        'near': 0.1,
        'clipMode': 1,
        'position': [0, 0, 8],
        'rotation': [0, 0, 0],
      },
      'components': [
        {
          'id': 'ca56beffc4234299be41f713d0607731',
        },
      ],
    },
  ],
  'components': [
    {
      'id': 'ca56beffc4234299be41f713d0607731',
      'item': {
        'id': 'e5986d7f83ed4e039fd59a7a9e092560',
      },
      'dataType': 'CompositionComponent',
      'items': [
        {
          'id': '94516c5160b3406bb94018cf80c40fb8',
        },
      ],
      'timelineAsset': {
        'id': 'a315d02f8a224910a9ff81730cf7f6f1',
      },
      'sceneBindings': [
        {
          'key': {
            'id': '2d257034b37a4b28ada8124fb183266b',
          },
          'value': {
            'id': '94516c5160b3406bb94018cf80c40fb8',
          },
        },
      ],
    },
    {
      'id': '6795a161365d45dea41493f56ae1ed85',
      'item': {
        'id': '94516c5160b3406bb94018cf80c40fb8',
      },
      'dataType': 'VideoComponent',
      'options': {
        'startColor': [1, 1, 1, 1],
        'muted': true,
        'video': {
          'id': '6c171a94bea9476a858d3d63d9c5aa46',
        },
        'volume': 1,
        'playbackRate': 1,
        'transparent': true,
      },
      'renderer': {
        'renderMode': 1,
        'texture': {
          'id': 'fb1e2989c7e94c8199b6dd63bfd2032f',
        },
      },
    },
  ],
  'geometries': [],
  'materials': [],
  'items': [
    {
      'id': '94516c5160b3406bb94018cf80c40fb8',
      'name': 'video_2',
      'duration': 1.84,
      'type': 'video',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '6795a161365d45dea41493f56ae1ed85',
        },
      ],
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'size': {
          'x': 9.2271,
          'y': 11.0725,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },
  ],
  'shaders': [],
  'bins': [],
  'textures': [
    {
      'id': 'fb1e2989c7e94c8199b6dd63bfd2032f',
      'source': {
        'id': '6c171a94bea9476a858d3d63d9c5aa46',
      },
      'flipY': true,
    },
  ],
  'animations': [],
  'miscs': [
    {
      'id': 'a315d02f8a224910a9ff81730cf7f6f1',
      'dataType': 'TimelineAsset',
      'tracks': [
        {
          'id': '2d257034b37a4b28ada8124fb183266b',
        },
      ],
    },
    {
      'id': '49f3553ba1fc4d8cade9e1518e45b408',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': 'f2db194025414fe39e3f28d3ac93f853',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {

      },
    },
    {
      'id': 'd387215f2d9a42239d36468cfc315999',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [1, 1, 1, 1],
    },
    {
      'id': 'e50d35bbdd014aa9beb96ac3825cf25e',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 3.3333,
          'endBehavior': 0,
          'asset': {
            'id': '49f3553ba1fc4d8cade9e1518e45b408',
          },
        },
      ],
    },
    {
      'id': 'f500a503eb95469f854e31cbb5a271b0',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 3.3333,
          'endBehavior': 0,
          'asset': {
            'id': 'f2db194025414fe39e3f28d3ac93f853',
          },
        },
      ],
    },
    {
      'id': 'd26750f879834911808c50402f37598d',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 3.3333,
          'endBehavior': 0,
          'asset': {
            'id': 'd387215f2d9a42239d36468cfc315999',
          },
        },
      ],
    },
    {
      'id': '2d257034b37a4b28ada8124fb183266b',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': 'e50d35bbdd014aa9beb96ac3825cf25e',
        },
        {
          'id': 'f500a503eb95469f854e31cbb5a271b0',
        },
        {
          'id': 'd26750f879834911808c50402f37598d',
        },
      ],
      'clips': [],
    },
  ],
  'compositionId': 'e5986d7f83ed4e039fd59a7a9e092560',
  'videos': [
    {
      'id': '6c171a94bea9476a858d3d63d9c5aa46',
      'url': 'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*RHk_SYRqMMwAAAAAYaAAAAgAesF2AQ',
    },
  ],
};

// 视频卡顿案例 JSON 2
const stuckVideoJson2 = {
  'playerVersion': {
    'web': '2.7.3',
    'native': '0.0.1.202311221223',
  },
  'images': [],
  'fonts': [],
  'version': '3.5',
  'plugins': [
    'video',
  ],
  'type': 'ge',
  'compositions': [
    {
      'id': 'e5986d7f83ed4e039fd59a7a9e092560',
      'name': 'Video',
      'duration': 5,
      'startTime': 0,
      'endBehavior': 2,
      'previewSize': [750, 1624],
      'camera': {
        'fov': 60,
        'far': 40,
        'near': 0.1,
        'clipMode': 1,
        'position': [0, 0, 8],
        'rotation': [0, 0, 0],
      },
      'components': [
        {
          'id': 'ca56beffc4234299be41f713d0607731',
        },
      ],
    },
  ],
  'components': [
    {
      'id': 'ca56beffc4234299be41f713d0607731',
      'item': {
        'id': 'e5986d7f83ed4e039fd59a7a9e092560',
      },
      'dataType': 'CompositionComponent',
      'items': [
        {
          'id': '94516c5160b3406bb94018cf80c40fb8',
        },
      ],
      'timelineAsset': {
        'id': 'a315d02f8a224910a9ff81730cf7f6f1',
      },
      'sceneBindings': [
        {
          'key': {
            'id': '2d257034b37a4b28ada8124fb183266b',
          },
          'value': {
            'id': '94516c5160b3406bb94018cf80c40fb8',
          },
        },
      ],
    },
    {
      'id': '6795a161365d45dea41493f56ae1ed85',
      'item': {
        'id': '94516c5160b3406bb94018cf80c40fb8',
      },
      'dataType': 'VideoComponent',
      'options': {
        'startColor': [1, 1, 1, 1],
        'muted': true,
        'video': {
          'id': '6c171a94bea9476a858d3d63d9c5aa46',
        },
        'volume': 1,
        'playbackRate': 1,
        'transparent': true,
      },
      'renderer': {
        'renderMode': 1,
        'texture': {
          'id': 'fb1e2989c7e94c8199b6dd63bfd2032f',
        },
      },
    },
  ],
  'geometries': [],
  'materials': [],
  'items': [
    {
      'id': '94516c5160b3406bb94018cf80c40fb8',
      'name': 'video_2',
      'duration': 1.84,
      'type': 'video',
      'visible': true,
      'endBehavior': 0,
      'delay': 0,
      'renderLevel': 'B+',
      'components': [
        {
          'id': '6795a161365d45dea41493f56ae1ed85',
        },
      ],
      'transform': {
        'position': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'eulerHint': {
          'x': 0,
          'y': 0,
          'z': 0,
        },
        'anchor': {
          'x': 0,
          'y': 0,
        },
        'size': {
          'x': 9.2271,
          'y': 11.0725,
        },
        'scale': {
          'x': 1,
          'y': 1,
          'z': 1,
        },
      },
      'dataType': 'VFXItemData',
    },
  ],
  'shaders': [],
  'bins': [],
  'textures': [
    {
      'id': 'fb1e2989c7e94c8199b6dd63bfd2032f',
      'source': {
        'id': '6c171a94bea9476a858d3d63d9c5aa46',
      },
      'flipY': true,
    },
  ],
  'animations': [],
  'miscs': [
    {
      'id': 'a315d02f8a224910a9ff81730cf7f6f1',
      'dataType': 'TimelineAsset',
      'tracks': [
        {
          'id': '2d257034b37a4b28ada8124fb183266b',
        },
      ],
    },
    {
      'id': '49f3553ba1fc4d8cade9e1518e45b408',
      'dataType': 'ActivationPlayableAsset',
    },
    {
      'id': 'f2db194025414fe39e3f28d3ac93f853',
      'dataType': 'TransformPlayableAsset',
      'positionOverLifetime': {

      },
    },
    {
      'id': 'd387215f2d9a42239d36468cfc315999',
      'dataType': 'SpriteColorPlayableAsset',
      'startColor': [1, 1, 1, 1],
    },
    {
      'id': 'e50d35bbdd014aa9beb96ac3825cf25e',
      'dataType': 'ActivationTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 1.84,
          'endBehavior': 0,
          'asset': {
            'id': '49f3553ba1fc4d8cade9e1518e45b408',
          },
        },
      ],
    },
    {
      'id': 'f500a503eb95469f854e31cbb5a271b0',
      'dataType': 'TransformTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 1.84,
          'endBehavior': 0,
          'asset': {
            'id': 'f2db194025414fe39e3f28d3ac93f853',
          },
        },
      ],
    },
    {
      'id': 'd26750f879834911808c50402f37598d',
      'dataType': 'SpriteColorTrack',
      'children': [],
      'clips': [
        {
          'start': 0,
          'duration': 1.84,
          'endBehavior': 0,
          'asset': {
            'id': 'd387215f2d9a42239d36468cfc315999',
          },
        },
      ],
    },
    {
      'id': '2d257034b37a4b28ada8124fb183266b',
      'dataType': 'ObjectBindingTrack',
      'children': [
        {
          'id': 'e50d35bbdd014aa9beb96ac3825cf25e',
        },
        {
          'id': 'f500a503eb95469f854e31cbb5a271b0',
        },
        {
          'id': 'd26750f879834911808c50402f37598d',
        },
      ],
      'clips': [],
    },
  ],
  'compositionId': 'e5986d7f83ed4e039fd59a7a9e092560',
  'videos': [
    {
      'id': '6c171a94bea9476a858d3d63d9c5aa46',
      'url': 'https://mdn.alipayobjects.com/graph_jupiter/afts/file/A*Mk3WTIl_CIsAAAAARkAAAAgAesF2AQ',
    },
  ],
};

let currentIndex = 0;
let player: Player;
let disposeReplayCapture: (() => void) | undefined;
const container = document.getElementById('J-container');
const replayCapturePanel = document.getElementById('replay-capture-panel')!;
const captureEnabled = new URLSearchParams(location.search).get('capture') === '1';
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const currentUrl = document.querySelector<HTMLDivElement>('#current-url')!;
const playback = document.querySelector<HTMLDivElement>('#playback')!;
const textureHistory = document.querySelector<HTMLTableSectionElement>('#texture-history')!;
const textureSummary = document.querySelector<HTMLParagraphElement>('#texture-summary')!;
const trackedTextures: { texture?: Texture, sceneOwned: boolean, status: HTMLTableCellElement }[] = [];

function getVideoComponent () {
  return player?.getCompositions()[0]?.items
    .map(item => item.getComponent(VideoComponent))
    .find(Boolean);
}

function showStatus (message: string, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function syncVideoInfo () {
  const component = getVideoComponent();
  const video = component?.video;

  currentUrl.textContent = video?.src || '—';
}

function trackTexture (texture: Texture, label: string, sceneOwned = false) {
  const row = document.createElement('tr');

  row.insertCell().textContent = texture.id;
  row.insertCell().textContent = label;
  trackedTextures.push({ texture, sceneOwned, status: row.insertCell() });
  textureHistory.prepend(row);
  updateTextureStatus();
}

function updateTextureStatus () {
  const current = getVideoComponent()?.renderer.texture;
  let destroyed = 0;

  for (const record of trackedTextures) {
    let state: string;
    let text: string;

    if (!record.texture || record.texture.isDestroyed) {
      record.texture = undefined;
      destroyed++;
      state = 'destroyed';
      text = '已销毁';
    } else if (record.texture === current) {
      state = 'current';
      text = '当前使用';
    } else {
      state = record.sceneOwned ? 'retained' : 'pending';
      text = record.sceneOwned ? '合成持有' : '未销毁';
    }
    if (record.status.dataset.state !== state) {
      record.status.dataset.state = state;
      record.status.textContent = text;
    }
  }
  const summary = `已销毁 ${destroyed} / ${trackedTextures.length} 个纹理`;

  if (textureSummary.textContent !== summary) {
    textureSummary.textContent = summary;
  }
}

async function runSceneAction (action: () => Promise<void>) {
  if (controlPanel.disabled) { return; }
  controlPanel.disabled = true;
  showStatus('正在加载场景…');
  try {
    await action();
    const component = getVideoComponent();

    if (component?.video) {
      trackTexture(component.renderer.texture, '初始视频（场景）', true);
    }
    syncVideoInfo();
    showStatus('点击“更换视频 A / B”，可在下方查看旧纹理是否已销毁。');
  } catch (error) {
    showStatus(`场景加载失败：${String(error)}`, true);
  } finally {
    controlPanel.disabled = false;
  }
}

async function replaceVideo (url: string, label: string) {
  if (controlPanel.disabled) { return; }
  const component = getVideoComponent();

  if (!component) {
    showStatus('当前场景没有可替换的视频，请先选择视频案例。', true);

    return;
  }
  controlPanel.disabled = true;
  showStatus(`正在加载${label}…`);
  try {
    await component.setVideo(url);
    if (component !== getVideoComponent() || !component.video) {
      showStatus('合成已销毁，请先选择视频案例。', true);

      return;
    }
    trackTexture(component.renderer.texture, `${label}（URL）`);
    if (disposeReplayCapture) {
      disposeReplayCapture();
      disposeReplayCapture = attachVideoReplayCapture(player, component.item.composition!, replayCapturePanel);
    }
    syncVideoInfo();
    showStatus(`已更换为${label}，播放位置已归零。`);
  } catch (error) {
    showStatus(`更换失败，已保留当前视频：${String(error)}`, true);
  } finally {
    updateTextureStatus();
    controlPanel.disabled = false;
  }
}

document.querySelector('#replace-video-a')!.addEventListener('click', () => {
  void replaceVideo(stuckVideoJson.videos[0].url, '视频 A');
});
document.querySelector('#replace-video-b')!.addEventListener('click', () => {
  void replaceVideo(stuckVideoJson2.videos[0].url, '视频 B');
});

const timer = window.setInterval(() => {
  const video = getVideoComponent()?.video;

  playback.textContent = video
    ? `${video.paused ? '已暂停' : '播放中'} · ${video.currentTime.toFixed(2)} / ${video.duration.toFixed(2)} 秒`
    : '当前场景没有可播放的视频';
  updateTextureStatus();
}, 100);

const resizeObserver = new ResizeObserver(() => player?.resize());

resizeObserver.observe(container!);
window.addEventListener('pagehide', () => {
  window.clearInterval(timer);
  resizeObserver.disconnect();
  disposePlayer();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    window.location.reload();
  }
});

function disposePlayer () {
  disposeReplayCapture?.();
  disposeReplayCapture = undefined;
  replayCapturePanel.hidden = true;
  player?.dispose();
  updateTextureStatus();
}

// 显示当前视频信息
function updateInfo () {
  const info = document.getElementById('video-info');

  if (info) {
    info.textContent = `[${currentIndex + 1}/${allVideos.length}] ${allVideos[currentIndex].desc}`;
  }
}

// 切换视频
async function switchVideo (index: number) {
  currentIndex = ((index % allVideos.length) + allVideos.length) % allVideos.length;
  const video = allVideos[currentIndex];

  updateInfo();

  disposePlayer();
  player = new Player({
    container,
    interactive: true,
    onError: (err, ...args) => {
      console.error(err.message);
    },
  });
  const currentPlayer = player;

  const composition = await currentPlayer.loadScene(video.url, { autoplay: false });

  if (player !== currentPlayer) {
    return;
  }
  if (captureEnabled) {
    disposeReplayCapture = attachVideoReplayCapture(currentPlayer, composition, replayCapturePanel);
  }
  currentPlayer.play();
}

// 播放视频卡顿案例
async function playStuckVideo () {
  const info = document.getElementById('video-info');

  if (info) {
    info.textContent = '视频卡顿案例';
  }

  disposePlayer();
  player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onError: (err, ...args) => {
      console.error('biz', err.message);
    },
  });

  await player.loadScene(stuckVideoJson as any as string, { useHevcVideo: true });
  const casePlayer = player;

  setTimeout(() => {
    if (player !== casePlayer) { return; }
    player.gotoAndPlay(1);
  }, 1000);
  setTimeout(() => {
    if (player !== casePlayer) { return; }
    player.gotoAndPlay(2);
  }, 2000);
}

// 播放视频卡顿案例2
async function playStuckVideo2 () {
  const info = document.getElementById('video-info');

  if (info) {
    info.textContent = '视频卡顿案例2';
  }

  disposePlayer();
  player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    onError: (err, ...args) => {
      console.error('biz', err.message);
    },
  });

  await player.loadScene(stuckVideoJson2 as any as string, { useHevcVideo: true });
  const casePlayer = player;

  player.gotoAndPlay(0);
  setTimeout(() => {
    if (player !== casePlayer) { return; }
    player.gotoAndPlay(0);
  }, 1300);
}

// 创建控制面板
const controlPanel = document.createElement('fieldset');

controlPanel.className = 'control-panel';

controlPanel.style.cssText = 'display:flex;flex-direction:column;gap:8px;background:rgba(0,0,0,0.7);color:#fff;padding:8px 12px;border-radius:4px;font-size:14px;';

// 第一行：导航按钮
const navRow = document.createElement('div');

navRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

// 上一个按钮
const prevBtn = document.createElement('button');

prevBtn.textContent = '◀ 上一个';
prevBtn.style.cssText = 'background:#4a90d9;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
prevBtn.onclick = () => runSceneAction(() => switchVideo(currentIndex - 1));

// 视频信息
const infoEl = document.createElement('span');

infoEl.id = 'video-info';

const nextBtn = document.createElement('button');

nextBtn.textContent = '下一个 ▶';
nextBtn.style.cssText = 'background:#4a90d9;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
nextBtn.onclick = () => runSceneAction(() => switchVideo(currentIndex + 1));

navRow.appendChild(prevBtn);
navRow.appendChild(infoEl);
navRow.appendChild(nextBtn);

// 第二行：卡顿案例按钮
const stuckRow = document.createElement('div');

stuckRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

// 视频卡顿案例按钮
const stuckBtn = document.createElement('button');

stuckBtn.textContent = '视频卡顿案例1';
stuckBtn.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
stuckBtn.onclick = () => runSceneAction(playStuckVideo);

// 视频卡顿案例按钮2
const stuckBtn2 = document.createElement('button');

stuckBtn2.textContent = '视频卡顿案例2';
stuckBtn2.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
stuckBtn2.onclick = () => runSceneAction(playStuckVideo2);

stuckRow.appendChild(stuckBtn);
stuckRow.appendChild(stuckBtn2);

// 第三行：视频控制按钮
const videoControlRow = document.createElement('div');

videoControlRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

// 视频暂停按钮
const videoPauseBtn = document.createElement('button');

videoPauseBtn.textContent = '视频暂停';
videoPauseBtn.style.cssText = 'background:#27ae60;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
videoPauseBtn.onclick = () => {
  const videoComp = getVideoComponent();

  videoComp?.pauseVideo();
};

// 视频播放按钮
const videoPlayBtn = document.createElement('button');

videoPlayBtn.textContent = '视频播放';
videoPlayBtn.style.cssText = 'background:#27ae60;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
videoPlayBtn.onclick = () => {
  const videoComp = getVideoComponent();

  videoComp?.playVideo();
};

// 合成暂停按钮
const compPauseBtn = document.createElement('button');

compPauseBtn.textContent = '合成暂停';
compPauseBtn.style.cssText = 'background:#9b59b6;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
compPauseBtn.onclick = () => {
  player.pause();
};

// 合成播放按钮
const compPlayBtn = document.createElement('button');

compPlayBtn.textContent = '合成播放';
compPlayBtn.style.cssText = 'background:#9b59b6;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
compPlayBtn.onclick = async () => {
  await player.resume();
};

videoControlRow.appendChild(videoPauseBtn);
videoControlRow.appendChild(videoPlayBtn);
videoControlRow.appendChild(compPauseBtn);
videoControlRow.appendChild(compPlayBtn);

// 第四行：视频倍速控制按钮
const speedRow = document.createElement('div');

speedRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

// 视频倍速0.5倍按钮
const speed05Btn = document.createElement('button');

speed05Btn.textContent = '视频0.5x';
speed05Btn.style.cssText = 'background:#f39c12;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
speed05Btn.onclick = () => {
  const videoComp = getVideoComponent();

  videoComp?.setPlaybackRate(0.5);
};

// 视频倍速1倍按钮
const speed1Btn = document.createElement('button');

speed1Btn.textContent = '视频1x';
speed1Btn.style.cssText = 'background:#f39c12;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
speed1Btn.onclick = () => {
  const videoComp = getVideoComponent();

  videoComp?.setPlaybackRate(1);
};

// 视频倍速2倍按钮
const speed2Btn = document.createElement('button');

speed2Btn.textContent = '视频2x';
speed2Btn.style.cssText = 'background:#f39c12;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;';
speed2Btn.onclick = () => {
  const videoComp = getVideoComponent();

  videoComp?.setPlaybackRate(2);
};

speedRow.appendChild(speed05Btn);
speedRow.appendChild(speed1Btn);
speedRow.appendChild(speed2Btn);

controlPanel.appendChild(navRow);
controlPanel.appendChild(stuckRow);
controlPanel.appendChild(videoControlRow);
controlPanel.appendChild(speedRow);
controlPanel.appendChild(document.getElementById('replacement-panel')!);
document.getElementById('video-controls')!.appendChild(controlPanel);

void runSceneAction(() => switchVideo(currentIndex));
