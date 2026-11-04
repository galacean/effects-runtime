const FALLBACK_FRAME_INTERVAL = 1000 / 30;

/**
 * 跟踪单张视频纹理的待上传帧，GPU 上传仍由引擎更新流程执行。
 */
export class VideoFrameTracker {
  private dirty = true;
  private disposed = false;
  private callbackId: number | null = null;
  private usesVideoFrameCallback = false;
  private lastUploadedTime = -1;
  private nextUploadTime = 0;

  constructor (readonly video: HTMLVideoElement) {
    video.addEventListener('loadeddata', this.invalidate);
    video.addEventListener('seeked', this.invalidate);
    this.requestFrame();
  }

  shouldUpload (): boolean {
    if (this.dirty) {
      return true;
    }
    if (this.usesVideoFrameCallback) {
      return false;
    }

    // currentTime 不是帧标识；旧环境只用它跳过静止画面，再按实际时间限频。
    return this.video.currentTime !== this.lastUploadedTime && performance.now() >= this.nextUploadTime;
  }

  markUploaded (): void {
    this.dirty = false;
    this.lastUploadedTime = this.video.currentTime;

    const time = performance.now();

    if (this.nextUploadTime <= 0) {
      this.nextUploadTime = time + FALLBACK_FRAME_INTERVAL;
    } else if (this.nextUploadTime <= time) {
      // 保留时间余量，避免 60 Hz 等渲染循环中的采样误差让回退频率持续降低。
      this.nextUploadTime += (Math.floor((time - this.nextUploadTime) / FALLBACK_FRAME_INTERVAL) + 1) * FALLBACK_FRAME_INTERVAL;
    }
  }

  dispose (): void {
    this.disposed = true;
    const { video, callbackId } = this;

    if (callbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
      try {
        video.cancelVideoFrameCallback(callbackId);
      } catch {
        // 部分容器的取消接口不可用，disposed 仍会阻止旧回调继续注册。
      }
    }
    this.callbackId = null;
    video.removeEventListener('loadeddata', this.invalidate);
    video.removeEventListener('seeked', this.invalidate);
  }

  private invalidate = (): void => {
    this.dirty = true;
  };

  private onVideoFrame = (): void => {
    if (this.disposed) {
      return;
    }
    this.callbackId = null;
    this.dirty = true;
    this.requestFrame();
  };

  private requestFrame (): void {
    const { video } = this;

    if (typeof video.requestVideoFrameCallback !== 'function') {
      return;
    }
    try {
      this.callbackId = video.requestVideoFrameCallback(this.onVideoFrame);
      this.usesVideoFrameCallback = true;
    } catch {
      this.callbackId = null;
      this.usesVideoFrameCallback = false;
    }
  }
}
