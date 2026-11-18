import type { Composition, Player } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

const FRAMES_PER_ROUND = 5;
const CAPTURE_DURATION = 0.8;
const SAMPLE_INTERVAL = CAPTURE_DURATION / FRAMES_PER_ROUND;
const MAX_ROUNDS = 8;
const THUMBNAIL_WIDTH = 180;

interface FrameInfo {
  compositionTime: number,
  videoTime?: number,
  seeking?: boolean,
  readyState?: number,
  scriptSeeks?: number,
}

/**
 * 在首次播放前挂载，在合成绘制后的 overlay 阶段读取尚未清空的绘图缓冲。
 */
export function attachVideoReplayCapture (player: Player, composition: Composition, panel: HTMLElement): () => void {
  const status = panel.querySelector<HTMLElement>('#capture-status')!;
  const rounds = panel.querySelector<HTMLElement>('#capture-rounds')!;
  const clearButton = panel.querySelector<HTMLButtonElement>('#clear-captures')!;
  const videoComponent = composition.items.map(item => item.getComponent(VideoComponent)).find(Boolean);
  const video = videoComponent?.video;
  let scriptSeeks: number | undefined;
  let restoreVideoTime = () => {};

  if (video) {
    const ownDescriptor = Object.getOwnPropertyDescriptor(video, 'currentTime');
    const descriptor = ownDescriptor ?? Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');

    if (descriptor?.get && descriptor.set) {
      const getTime = descriptor.get;
      const setTime = descriptor.set;

      try {
        Object.defineProperty(video, 'currentTime', {
          configurable: true,
          get: () => getTime.call(video),
          set: (time: number) => {
            scriptSeeks = (scriptSeeks ?? 0) + 1;
            setTime.call(video, time);
          },
        });
        scriptSeeks = 0;
        restoreVideoTime = () => {
          if (ownDescriptor) {
            Object.defineProperty(video, 'currentTime', ownDescriptor);
          } else {
            delete (video as Partial<HTMLVideoElement>).currentTime;
          }
        };
      } catch {
        // 部分容器不允许覆盖媒体属性；截图仍正常工作，计数显示为不可用。
      }
    }
  }
  let roundCount = 0;
  let previousTime: number | undefined;
  let activeRound: { heading: HTMLElement, frames: HTMLElement, count: number } | undefined;

  panel.hidden = false;
  rounds.textContent = '';
  status.textContent = `等待视频开始播放，每轮在开头 ${CAPTURE_DURATION} 秒采样 ${FRAMES_PER_ROUND} 张，最多采集 ${MAX_ROUNDS} 轮。`;

  function frameInfo (): FrameInfo {
    const video = videoComponent?.video;

    return {
      compositionTime: composition.time,
      videoTime: video?.currentTime,
      seeking: video?.seeking,
      readyState: video?.readyState,
      scriptSeeks,
    };
  }

  function captureFrame (title: string, info: FrameInfo): HTMLElement {
    const figure = document.createElement('figure');
    const canvas = document.createElement('canvas');
    const caption = document.createElement('figcaption');
    const label = document.createElement('strong');
    const details = document.createElement('span');
    const source = player.canvas;

    figure.className = 'capture-frame';
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = Math.max(1, Math.round(THUMBNAIL_WIDTH * source.height / source.width));
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('无法创建截图的 2D Canvas。');
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.setAttribute('aria-label', title);
    label.textContent = title;
    details.textContent = `合成 ${info.compositionTime.toFixed(3)}s · 视频 ${info.videoTime?.toFixed(3) ?? '—'}s` +
      `\nseeking=${info.seeking ?? '—'} · readyState=${info.readyState ?? '—'}` +
      `\n脚本 seek 累计 ${info.scriptSeeks ?? '—'} 次`;
    caption.append(label, details);
    figure.append(canvas, caption);

    return figure;
  }

  function captureRenderedFrame (): void {
    if (composition.isDestroyed || composition.getPaused() ||
      (roundCount === MAX_ROUNDS && (!activeRound || activeRound.count === FRAMES_PER_ROUND))) {
      return;
    }
    const info = frameInfo();

    try {
      if (previousTime === undefined || info.compositionTime < previousTime) {
        if (roundCount === MAX_ROUNDS) {
          return;
        }
        const section = document.createElement('section');
        const heading = document.createElement('h2');
        const frames = document.createElement('div');

        roundCount++;
        section.className = 'capture-round';
        frames.className = 'capture-frames';
        section.append(heading, frames);
        rounds.prepend(section);
        activeRound = { heading, frames, count: 0 };
        status.textContent = `正在采集第 ${roundCount} 轮视频开头 ${CAPTURE_DURATION} 秒的播放过程…`;
      }
      previousTime = info.compositionTime;

      const video = videoComponent?.video;

      if (!activeRound || activeRound.count === FRAMES_PER_ROUND || !videoComponent?.isVideoActive ||
        !video || video.paused || video.seeking || video.readyState < 2) {
        return;
      }
      if (video.currentTime > CAPTURE_DURATION) {
        activeRound.heading.textContent = `第 ${roundCount} 轮播放 · ${activeRound.count} / ${FRAMES_PER_ROUND} 张（未采满）`;
        status.textContent = `第 ${roundCount} 轮采样时间已结束，仅采集 ${activeRound.count} 张。` +
          (roundCount === MAX_ROUNDS ? '已停止采集；视频和合成继续播放。' : '合成重播时将继续采集。');
        activeRound = undefined;

        return;
      }
      if (video.currentTime >= activeRound.count * SAMPLE_INTERVAL) {
        const index = activeRound.count + 1;

        activeRound.frames.appendChild(captureFrame(`采样第 ${index} 张`, info));
        activeRound.count = index;
        activeRound.heading.textContent = `第 ${roundCount} 轮播放 · ${index} / ${FRAMES_PER_ROUND} 张`;
        if (index === FRAMES_PER_ROUND) {
          if (roundCount === MAX_ROUNDS) {
            status.textContent = `已完成 ${MAX_ROUNDS} 轮截图，已停止采集；视频和合成继续播放。`;
          } else {
            status.textContent = `已完成第 ${roundCount} 轮视频开头 ${CAPTURE_DURATION} 秒的 ${FRAMES_PER_ROUND} 张采样，合成重播时将继续采集。`;
          }
        }
      }
    } catch (error) {
      status.textContent = `截图失败：${error instanceof Error ? error.message : String(error)}`;
      dispose();
    }
  }

  const capture = { render: captureRenderedFrame };

  player.engine.renderer.addOverlayRenderer(capture);

  clearButton.onclick = () => {
    rounds.textContent = '';
    activeRound = undefined;
    previousTime = composition.time;
    roundCount = 0;
    if (scriptSeeks !== undefined) {
      scriptSeeks = 0;
    }
    status.textContent = '截图已清空，等待合成重播，或切换案例重新采集。';
  };

  function dispose (): void {
    player.engine.renderer.removeOverlayRenderer(capture);
    restoreVideoTime();
    clearButton.onclick = null;
  }

  return dispose;
}
