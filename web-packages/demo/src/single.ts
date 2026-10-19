import type { Composition } from '@galacean/effects';
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-dom-content';
import '@galacean/effects-plugin-ffd';
import '@galacean/effects-plugin-gui';
import '@galacean/effects-plugin-ktx2';
import '@galacean/effects-plugin-model';
import '@galacean/effects-plugin-multimedia';
import '@galacean/effects-plugin-orientation-transformer';
import '@galacean/effects-plugin-rich-text';
import '@galacean/effects-plugin-spine';

const container = document.getElementById('J-container')!;
const form = document.querySelector<HTMLFormElement>('#scene-form')!;
const sourceControls = document.querySelector<HTMLFieldSetElement>('#source-controls')!;
const playbackControls = document.querySelector<HTMLFieldSetElement>('#playback-controls')!;
const input = document.querySelector<HTMLInputElement>('#scene-source')!;
const label = document.querySelector<HTMLLabelElement>('#source-label')!;
const toggle = document.querySelector<HTMLButtonElement>('#source-toggle')!;
const hint = document.getElementById('source-hint')!;
const status = document.getElementById('status')!;
let localMode = false;
let urlInput = new URLSearchParams(location.search).get('url')
  || 'https://mdn.alipayobjects.com/mars/afts/file/A*IErLSZ4kVt8AAAAARoAAAAgAelB4AQ';
let fileInput = '';
let player: Player | undefined;
let composition: Composition | undefined;

function showStatus (message: string, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function updateSourceMode () {
  input.value = localMode ? fileInput : urlInput;
  input.type = localMode ? 'text' : 'url';
  input.placeholder = localMode ? 'find-flower/flower.json' : 'https://example.com/scene.json';
  label.textContent = localMode ? '本地文件名' : 'GE URL';
  toggle.textContent = localMode ? '切换为 URL' : '切换为本地文件';
  hint.textContent = localMode
    ? '文件放在 web-packages/demo/public/assets 下，输入文件名或子目录路径，保留配套资源的目录结构。'
    : '粘贴 GE 文件链接即可播放，常用插件已内置。';
}

toggle.addEventListener('click', () => {
  if (localMode) {
    fileInput = input.value;
  } else {
    urlInput = input.value;
  }
  localMode = !localMode;
  updateSourceMode();
  input.focus();
});

async function loadScene () {
  if (sourceControls.disabled) { return; }
  let url: URL;

  try {
    const value = input.value.trim();

    if (!value) { throw new Error(localMode ? '请输入本地文件名。' : '请输入 GE URL。'); }
    if (localMode) {
      const path = value.replace(/^\/?assets\//, '');
      const segments = path.split('/');

      if (segments.some(segment => !segment || segment === '.' || segment === '..') || path.includes('\\')) {
        throw new Error('请输入 assets 目录下的文件名或子目录路径。');
      }
      url = new URL(segments.map(encodeURIComponent).join('/'), new URL('../assets/', location.href));
    } else {
      url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) { throw new Error('请输入 HTTP 或 HTTPS 链接。'); }
    }
  } catch (error) {
    showStatus(`无法加载：${error instanceof Error ? error.message : String(error)}`, true);

    return;
  }

  sourceControls.disabled = true;
  playbackControls.disabled = true;
  showStatus('正在加载 GE 文件…');
  let loadError: Error | undefined;

  try {
    composition = undefined;
    player?.dispose();
    player = undefined;
    player = new Player({
      container,
      interactive: true,
      onError: error => {
        loadError = error;
        console.error(error);
        showStatus(`播放失败：${error.message}`, true);
      },
    });
    composition = await player.loadScene(url.href, { autoplay: true, reusable: true });
    if (!composition) { throw loadError || new Error('未能加载场景，请检查文件地址和内容。'); }
    playbackControls.disabled = false;
    showStatus(`正在播放：${composition.name}`);
  } catch (error) {
    player?.dispose();
    player = undefined;
    composition = undefined;
    showStatus(`加载失败：${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    sourceControls.disabled = false;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void loadScene();
});
document.querySelector('#play')!.addEventListener('click', () => composition?.resume());
document.querySelector('#pause')!.addEventListener('click', () => composition?.pause());
document.querySelector('#restart')!.addEventListener('click', () => composition?.gotoAndPlay(0));

const resizeObserver = new ResizeObserver(() => player?.resize());

resizeObserver.observe(container);
window.addEventListener('pagehide', () => {
  resizeObserver.disconnect();
  player?.dispose();
});
updateSourceMode();
if (urlInput) { void loadScene(); }
