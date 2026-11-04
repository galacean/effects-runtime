import type { Composition, Player } from '@galacean/effects';
import { VideoComponent } from '@galacean/effects-plugin-multimedia';

const FRAMES_PER_REPLAY = 5;
const MAX_REPLAYS = 8;
const THUMBNAIL_WIDTH = 180;

interface FrameInfo {
  compositionTime: number,
  videoTime?: number,
  seeking?: boolean,
  readyState?: number,
  scriptSeeks?: number,
}

/**
 * 截取重播边界的实际合成画面；调用方需开启 willCaptureImage 以读取重播前的绘图缓冲。
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
  let replayCount = 0;
  let captureComplete = false;
  let previousFrame: FrameInfo | undefined;
  let activeRound: { heading: HTMLElement, frames: HTMLElement, count: number } | undefined;

  panel.hidden = false;
  rounds.textContent = '';
  status.textContent = `等待合成自然重播，每轮截取前 ${FRAMES_PER_REPLAY} 个渲染帧，共采集 ${MAX_REPLAYS} 轮。`;

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

  function captureFrame (title: string, info: FrameInfo, reference = false): HTMLElement {
    const figure = document.createElement('figure');
    const canvas = document.createElement('canvas');
    const caption = document.createElement('figcaption');
    const label = document.createElement('strong');
    const details = document.createElement('span');
    const source = player.canvas;

    figure.className = reference ? 'capture-frame capture-reference' : 'capture-frame';
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

  function captureError (error: unknown): void {
    status.textContent = `截图失败：${error instanceof Error ? error.message : String(error)}`;
    dispose();
  }

  // end 在本轮 update 中触发、早于下一次绘制；缓冲中仍是上一轮最后一个渲染帧。
  const removeEndListener = composition.on('end', () => {
    if (captureComplete || replayCount >= MAX_REPLAYS) {
      return;
    }
    try {
      const section = document.createElement('section');
      const heading = document.createElement('h2');
      const frames = document.createElement('div');

      replayCount++;
      section.className = 'capture-round';
      frames.className = 'capture-frames';
      heading.textContent = `第 ${replayCount} 次重播 · 0 / ${FRAMES_PER_REPLAY} 帧`;
      if (previousFrame) {
        frames.appendChild(captureFrame('重播前最后一帧', previousFrame, true));
      }
      section.append(heading, frames);
      rounds.insertBefore(section, rounds.firstChild);
      while (rounds.children.length > MAX_REPLAYS) {
        rounds.lastElementChild?.remove();
      }
      activeRound = { heading, frames, count: 0 };
      status.textContent = `正在截取第 ${replayCount} 次重播的前 ${FRAMES_PER_REPLAY} 帧…`;
    } catch (error) {
      captureError(error);
    }
  });

  const removeRenderListener = player.engine.on('postrender', () => {
    if (captureComplete) {
      return;
    }
    const info = frameInfo();

    try {
      // 不等待 seek 或视频新帧，以免漏掉真正需要排查的旧帧 / 空白帧。
      if (activeRound && activeRound.count < FRAMES_PER_REPLAY) {
        const index = activeRound.count + 1;

        activeRound.frames.appendChild(captureFrame(`重播后第 ${index} 帧`, info));
        activeRound.count = index;
        activeRound.heading.textContent = `第 ${replayCount} 次重播 · ${index} / ${FRAMES_PER_REPLAY} 帧`;
        if (index === FRAMES_PER_REPLAY) {
          if (replayCount === MAX_REPLAYS) {
            captureComplete = true;
            status.textContent = `已完成 ${MAX_REPLAYS} 轮截图，已停止采集；视频和合成继续播放。清空截图后可重新采集。`;
          } else {
            status.textContent = `已完成 ${replayCount} / ${MAX_REPLAYS} 轮截图，等待下一次重播。`;
          }
        }
      }
      previousFrame = info;
    } catch (error) {
      captureError(error);
    }
  });

  clearButton.onclick = () => {
    rounds.textContent = '';
    activeRound = undefined;
    previousFrame = undefined;
    replayCount = 0;
    captureComplete = false;
    if (scriptSeeks !== undefined) {
      scriptSeeks = 0;
    }
    status.textContent = `截图已清空，等待下一次合成重播，重新采集 ${MAX_REPLAYS} 轮。`;
  };

  function dispose (): void {
    removeEndListener();
    removeRenderListener();
    restoreVideoTime();
    clearButton.onclick = null;
  }

  return dispose;
}
