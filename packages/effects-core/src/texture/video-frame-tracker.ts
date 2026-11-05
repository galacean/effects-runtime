const FALLBACK_FRAME_INTERVAL = 1000 / 30;

/**
 * Tracks pending frames per texture; the engine still controls frame submission.
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

    // currentTime is not a frame ID; only use it to skip stationary fallback frames.
    return this.video.currentTime !== this.lastUploadedTime && performance.now() >= this.nextUploadTime;
  }

  markUploaded (): void {
    this.dirty = false;
    this.lastUploadedTime = this.video.currentTime;

    const time = performance.now();

    if (this.nextUploadTime <= 0) {
      this.nextUploadTime = time + FALLBACK_FRAME_INTERVAL;
    } else if (this.nextUploadTime <= time) {
      // Preserve the remainder so render-loop sampling does not lower the fallback rate.
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
        // The disposed guard also handles containers whose cancellation API fails.
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
